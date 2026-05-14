import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Agent,
  KnowledgeDocument,
  ProcessArchitectureNode,
  ProcessArchitectureTree,
  Skill,
} from '../entities';
import {
  buildProcessArchitectureSnapshot,
  collectDescendantNodeIds,
  parseProcessArchitectureBinding,
  summarizeProcessArchitectureCoverage,
} from './process-architecture.logic';
import {
  CreateProcessArchitectureNodeDto,
  CreateProcessArchitectureTreeDto,
  UpdateProcessArchitectureNodeDto,
  UpdateProcessArchitectureTreeDto,
} from './dto';

@Injectable()
export class ProcessArchitecturesService {
  constructor(
    @InjectRepository(ProcessArchitectureTree)
    private readonly treeRepository: Repository<ProcessArchitectureTree>,
    @InjectRepository(ProcessArchitectureNode)
    private readonly nodeRepository: Repository<ProcessArchitectureNode>,
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    @InjectRepository(Skill)
    private readonly skillRepository: Repository<Skill>,
    @InjectRepository(KnowledgeDocument)
    private readonly knowledgeDocumentRepository: Repository<KnowledgeDocument>,
  ) {}

  async findAll() {
    await this.ensureDefaultTree();
    const [items, total] = await this.treeRepository.findAndCount({
      order: { updatedAt: 'DESC' },
    });
    return { items, total };
  }

  async findActive() {
    const tree = await this.getActiveTree();
    return this.findOne(tree.id);
  }

  async findOne(id: number) {
    const tree = await this.treeRepository.findOne({ where: { id } });
    if (!tree) {
      throw new NotFoundException(`ProcessArchitectureTree #${id} not found`);
    }

    const nodes = await this.getNodes(id);
    return {
      ...tree,
      nodes,
      snapshot: buildProcessArchitectureSnapshot(nodes),
    };
  }

  async getCoverage(treeId?: number, selectedNodeId?: number | null) {
    const tree = treeId ? await this.findTreeOrThrow(treeId) : await this.getActiveTree();
    const nodes = await this.getNodes(tree.id);
    const [agents, skills, knowledgeDocuments] = await Promise.all([
      this.agentRepository.find({
        select: ['id', 'name', 'description', 'model', 'avatar', 'status', 'processArchitectureNodeIds', 'updatedAt'],
        order: { updatedAt: 'DESC' },
      } as any),
      this.skillRepository.find({
        select: [
          'id',
          'namespace',
          'name',
          'description',
          'domain',
          'subDomain',
          'abilityName',
          'status',
          'processArchitectureNodeIds',
          'updatedAt',
        ],
        order: { updatedAt: 'DESC' },
      } as any),
      this.knowledgeDocumentRepository.find({
        select: ['id', 'name', 'status', 'chunkCount', 'processArchitectureNodeIds', 'updatedAt'],
        order: { updatedAt: 'DESC' },
      } as any),
    ]);

    const summary = summarizeProcessArchitectureCoverage({
      nodes,
      selectedNodeId: selectedNodeId ?? null,
      agents: agents as any,
      skills: skills as any,
      knowledgeDocuments: knowledgeDocuments as any,
    });

    return {
      tree,
      nodes,
      snapshot: buildProcessArchitectureSnapshot(nodes),
      ...summary,
      unboundAgentCount: agents.filter((agent) => parseProcessArchitectureBinding(agent.processArchitectureNodeIds).length === 0).length,
      unboundSkillCount: skills.filter((skill) => parseProcessArchitectureBinding(skill.processArchitectureNodeIds).length === 0).length,
      unboundKnowledgeDocumentCount: knowledgeDocuments.filter((document) => parseProcessArchitectureBinding(document.processArchitectureNodeIds).length === 0).length,
    };
  }

  async create(dto: CreateProcessArchitectureTreeDto, ownerId: number) {
    const tree = await this.treeRepository.save(this.treeRepository.create({
      name: dto.name,
      description: dto.description || null,
      ownerId,
      source: dto.source || 'local',
      version: dto.version || '1.0.0',
      status: dto.status || 'active',
    }));

    if (dto.nodes?.length) {
      await this.createNodesFromDto(tree.id, dto.nodes);
    }
    return this.findOne(tree.id);
  }

  async update(id: number, dto: UpdateProcessArchitectureTreeDto, userId: number, isAdmin: boolean) {
    const existing = await this.findTreeOrThrow(id);
    this.assertCanEdit(existing, userId, isAdmin);

    await this.treeRepository.update(id, {
      name: dto.name ?? existing.name,
      description: dto.description ?? existing.description,
      source: dto.source ?? existing.source,
      version: dto.version ?? existing.version,
      status: dto.status ?? existing.status,
    });

    if (dto.nodes) {
      await this.nodeRepository.delete({ treeId: id });
      await this.createNodesFromDto(id, dto.nodes);
    }

    return this.findOne(id);
  }

  async remove(id: number, userId: number, isAdmin: boolean) {
    const existing = await this.findTreeOrThrow(id);
    this.assertCanEdit(existing, userId, isAdmin);
    await this.treeRepository.delete(id);
    return { success: true };
  }

  async createNode(treeId: number, dto: CreateProcessArchitectureNodeDto, userId: number, isAdmin: boolean) {
    const tree = await this.findTreeOrThrow(treeId);
    this.assertCanEdit(tree, userId, isAdmin);
    const node = await this.nodeRepository.save(this.nodeRepository.create({
      treeId,
      parentId: dto.parentId ?? null,
      code: dto.code || null,
      name: dto.name,
      level: dto.level ?? await this.inferLevel(treeId, dto.parentId ?? null),
      sortOrder: dto.sortOrder ?? await this.nextSortOrder(treeId, dto.parentId ?? null),
      description: dto.description || null,
    }));
    return node;
  }

  async updateNode(
    treeId: number,
    nodeId: number,
    dto: UpdateProcessArchitectureNodeDto,
    userId: number,
    isAdmin: boolean,
  ) {
    const tree = await this.findTreeOrThrow(treeId);
    this.assertCanEdit(tree, userId, isAdmin);
    const existing = await this.nodeRepository.findOne({ where: { id: nodeId, treeId } });
    if (!existing) throw new NotFoundException(`ProcessArchitectureNode #${nodeId} not found`);

    await this.nodeRepository.update(nodeId, {
      parentId: dto.parentId === undefined ? existing.parentId : dto.parentId,
      code: dto.code === undefined ? existing.code : dto.code || null,
      name: dto.name ?? existing.name,
      level: dto.level ?? existing.level,
      sortOrder: dto.sortOrder ?? existing.sortOrder,
      description: dto.description === undefined ? existing.description : dto.description || null,
    });

    return this.nodeRepository.findOne({ where: { id: nodeId, treeId } });
  }

  async removeNode(treeId: number, nodeId: number, userId: number, isAdmin: boolean) {
    const tree = await this.findTreeOrThrow(treeId);
    this.assertCanEdit(tree, userId, isAdmin);
    const nodes = await this.getNodes(treeId);
    if (!nodes.some((node) => node.id === nodeId)) {
      throw new NotFoundException(`ProcessArchitectureNode #${nodeId} not found`);
    }
    const subtreeIds = collectDescendantNodeIds(nodes, nodeId);
    await this.nodeRepository.delete(subtreeIds);
    return { success: true, deletedNodeIds: subtreeIds };
  }

  private async ensureDefaultTree() {
    const count = await this.treeRepository.count();
    if (count > 0) return;

    const tree = await this.treeRepository.save(this.treeRepository.create({
      name: '本地流程架构',
      description: '本地公司流程架构。当前导入文件只包含 L1，后续可继续增删改节点。',
      ownerId: null,
      source: 'local',
      version: '1.0.0',
      status: 'active',
    }));
    await this.nodeRepository.save(this.nodeRepository.create({
      treeId: tree.id,
      parentId: null,
      code: 'L1',
      name: 'L1',
      level: 1,
      sortOrder: 0,
      description: null,
    }));
  }

  private async getActiveTree() {
    await this.ensureDefaultTree();
    const tree = await this.treeRepository.findOne({
      where: { status: 'active' },
      order: { updatedAt: 'DESC' },
    });
    if (tree) return tree;

    const [fallback] = await this.treeRepository.find({ order: { updatedAt: 'DESC' }, take: 1 });
    if (!fallback) throw new NotFoundException('Process architecture tree not found');
    return fallback;
  }

  private async findTreeOrThrow(id: number) {
    const tree = await this.treeRepository.findOne({ where: { id } });
    if (!tree) throw new NotFoundException(`ProcessArchitectureTree #${id} not found`);
    return tree;
  }

  private getNodes(treeId: number) {
    return this.nodeRepository.find({
      where: { treeId },
      order: { level: 'ASC', sortOrder: 'ASC', id: 'ASC' },
    });
  }

  private assertCanEdit(tree: ProcessArchitectureTree, userId: number, isAdmin: boolean) {
    if (!isAdmin && tree.ownerId !== null && tree.ownerId !== userId) {
      throw new ForbiddenException('只能编辑自己的流程架构');
    }
  }

  private async createNodesFromDto(treeId: number, nodes: CreateProcessArchitectureNodeDto[]) {
    const clientNodeIdToSavedId = new Map<number, number>();
    const savedNodes = await this.nodeRepository.save(nodes.map((node, index) => this.nodeRepository.create({
      treeId,
      parentId: null,
      code: node.code || null,
      name: node.name,
      level: node.level ?? 1,
      sortOrder: node.sortOrder ?? index,
      description: node.description || null,
    })));

    savedNodes.forEach((node, index) => {
      const clientId = nodes[index]?.id ?? index + 1;
      clientNodeIdToSavedId.set(clientId, node.id);
    });

    const nodesWithParents = savedNodes
      .map((savedNode, index) => {
        const parentId = nodes[index]?.parentId;
        if (parentId == null) return null;
        savedNode.parentId = clientNodeIdToSavedId.get(parentId) ?? parentId;
        return savedNode;
      })
      .filter((node): node is ProcessArchitectureNode => Boolean(node));

    if (nodesWithParents.length) {
      await this.nodeRepository.save(nodesWithParents);
    }
  }

  private async inferLevel(treeId: number, parentId: number | null) {
    if (!parentId) return 1;
    const parent = await this.nodeRepository.findOne({ where: { id: parentId, treeId } });
    return parent ? parent.level + 1 : 1;
  }

  private async nextSortOrder(treeId: number, parentId: number | null) {
    const siblings = await this.nodeRepository.find({
      where: { treeId, parentId } as any,
      order: { sortOrder: 'DESC' },
      take: 1,
    });
    return (siblings[0]?.sortOrder ?? -1) + 1;
  }
}
