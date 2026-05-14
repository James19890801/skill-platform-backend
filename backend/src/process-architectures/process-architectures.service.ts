import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Agent,
  KnowledgeBase,
  KnowledgeChunk,
  KnowledgeDocument,
  ProcessArchitectureNode,
  ProcessArchitectureTree,
  Skill,
  SkillVersion,
  User,
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
import {
  defaultProcessArchitectureNodes,
  defaultProcessArchitectureTree,
} from './default-process-architecture';
import {
  ARCHITECTURE_BINDING_DOC_NAME,
  DEMO_AGENT_PREFIX,
  DEMO_KNOWLEDGE_PREFIX,
  DEMO_SKILL_NAMESPACE_PREFIX,
  ProcessArchitectureAssetNode,
  buildArchitectureBindingDocument,
  buildDemoAgentSeeds,
  buildDemoKnowledgeBaseSeeds,
  buildDemoSkillSeeds,
  createDeterministicEmbedding,
  getBindableProcessNodes,
  pickProcessNodeForText,
} from './process-architecture-assets';

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
    @InjectRepository(SkillVersion)
    private readonly skillVersionRepository: Repository<SkillVersion>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(KnowledgeBase)
    private readonly knowledgeBaseRepository: Repository<KnowledgeBase>,
    @InjectRepository(KnowledgeDocument)
    private readonly knowledgeDocumentRepository: Repository<KnowledgeDocument>,
    @InjectRepository(KnowledgeChunk)
    private readonly knowledgeChunkRepository: Repository<KnowledgeChunk>,
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
    await this.ensureDefaultAssets(tree, nodes);
    return {
      ...tree,
      nodes,
      snapshot: buildProcessArchitectureSnapshot(nodes),
    };
  }

  async getCoverage(treeId?: number, selectedNodeId?: number | null) {
    const tree = treeId ? await this.findTreeOrThrow(treeId) : await this.getActiveTree();
    const nodes = await this.getNodes(tree.id);
    await this.ensureDefaultAssets(tree, nodes);
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
    if (count === 0) {
      await this.createDefaultArchitecture();
      return;
    }

    const activeTree = await this.treeRepository.findOne({
      where: { status: 'active' },
      order: { updatedAt: 'DESC' },
    });
    if (activeTree) {
      await this.upgradeLegacyFallbackArchitecture(activeTree);
    }
  }

  private async createDefaultArchitecture() {
    const tree = await this.treeRepository.save(this.treeRepository.create({
      name: defaultProcessArchitectureTree.name,
      description: defaultProcessArchitectureTree.description,
      ownerId: null,
      source: defaultProcessArchitectureTree.source,
      version: defaultProcessArchitectureTree.version,
      status: defaultProcessArchitectureTree.status,
    }));
    await this.createDefaultNodes(tree.id);
  }

  private async upgradeLegacyFallbackArchitecture(tree: ProcessArchitectureTree) {
    const nodes = await this.getNodes(tree.id);
    const isLegacyFallback =
      nodes.length <= 1 &&
      (tree.name === '本地流程架构' ||
        nodes.some((node) => node.code === 'L1' && node.name === 'L1'));

    if (!isLegacyFallback) return;

    await this.treeRepository.update(tree.id, {
      name: defaultProcessArchitectureTree.name,
      description: defaultProcessArchitectureTree.description,
      source: defaultProcessArchitectureTree.source,
      version: defaultProcessArchitectureTree.version,
      status: defaultProcessArchitectureTree.status,
    });
    await this.nodeRepository.delete({ treeId: tree.id } as any);
    await this.createDefaultNodes(tree.id);
  }

  private async createDefaultNodes(treeId: number) {
    await this.createNodesFromDto(
      treeId,
      defaultProcessArchitectureNodes.map((node) => ({
        id: node.id,
        parentId: node.parentId,
        code: node.code ?? undefined,
        name: node.name,
        level: node.level,
        sortOrder: node.sortOrder,
        description: node.description ?? undefined,
      })),
    );
  }

  private async ensureDefaultAssets(tree: ProcessArchitectureTree, nodes: ProcessArchitectureNode[]) {
    if (tree.ownerId !== null || tree.source !== defaultProcessArchitectureTree.source) return;
    const bindableNodes = getBindableProcessNodes(nodes);
    if (bindableNodes.length === 0) return;

    const ownerId = await this.ensureSeedOwnerId();
    await this.attachExistingAgents(bindableNodes);
    await this.attachExistingSkills(bindableNodes);
    await this.attachExistingKnowledgeBases(bindableNodes, ownerId);
    await this.ensureDemoAgents(bindableNodes, ownerId);
    await this.ensureDemoSkills(bindableNodes, ownerId);
    await this.ensureDemoKnowledgeBases(bindableNodes, ownerId);
  }

  private async attachExistingAgents(nodes: ProcessArchitectureAssetNode[]) {
    const agents = await this.agentRepository.find();
    await Promise.all(agents
      .filter((agent) => !agent.name.startsWith(DEMO_AGENT_PREFIX))
      .filter((agent) => !this.hasBindableArchitectureBinding(agent.processArchitectureNodeIds, nodes))
      .map((agent, index) => {
        const node = pickProcessNodeForText(nodes, `${agent.name} ${agent.description || ''}`, index);
        return this.agentRepository.update(agent.id, {
          processArchitectureNodeIds: JSON.stringify([node.id]),
        });
      }));
  }

  private async attachExistingSkills(nodes: ProcessArchitectureAssetNode[]) {
    const skills = await this.skillRepository.find();
    await Promise.all(skills
      .filter((skill) => !skill.namespace.startsWith(DEMO_SKILL_NAMESPACE_PREFIX))
      .filter((skill) => !this.hasBindableArchitectureBinding(skill.processArchitectureNodeIds, nodes))
      .map((skill, index) => {
        const node = pickProcessNodeForText(
          nodes,
          `${skill.namespace} ${skill.name} ${skill.domain} ${skill.subDomain} ${skill.description || ''}`,
          index,
        );
        return this.skillRepository.update(skill.id, {
          processArchitectureNodeIds: JSON.stringify([node.id]),
        });
      }));
  }

  private async attachExistingKnowledgeBases(nodes: ProcessArchitectureAssetNode[], ownerId: number) {
    const knowledgeBases = await this.knowledgeBaseRepository.find({ order: { id: 'ASC' } });
    for (let index = 0; index < knowledgeBases.length; index += 1) {
      const knowledgeBase = knowledgeBases[index];
      const node = pickProcessNodeForText(
        nodes,
        `${knowledgeBase.name} ${knowledgeBase.description || ''}`,
        index,
      );
      await this.ensureKnowledgeBaseHasArchitectureDocument(knowledgeBase, node, ownerId);
    }
  }

  private async ensureDemoAgents(nodes: ProcessArchitectureAssetNode[], ownerId: number) {
    const existingAgents = await this.agentRepository.find();
    const existingNames = new Set(existingAgents.map((agent) => agent.name));
    const demoCount = existingAgents.filter((agent) => agent.name.startsWith(DEMO_AGENT_PREFIX)).length;
    if (demoCount >= 30) return;

    const seeds = buildDemoAgentSeeds(nodes).filter((seed) => !existingNames.has(seed.name));
    await this.agentRepository.save(seeds.slice(0, 30 - demoCount).map((seed) => this.agentRepository.create({
      name: seed.name,
      description: seed.description,
      avatar: 'icon:process',
      model: seed.model,
      systemPrompt: seed.systemPrompt,
      skills: '[]',
      processArchitectureNodeIds: JSON.stringify(seed.processArchitectureNodeIds),
      knowledgeBases: '[]',
      mcpServers: '[]',
      memoryEnabled: true,
      temperature: 0.7,
      maxTokens: 4096,
      status: 'active',
      ownerId,
    })));
  }

  private async ensureDemoSkills(nodes: ProcessArchitectureAssetNode[], ownerId: number) {
    const existingSkills = await this.skillRepository.find();
    const existingNamespaces = new Set(existingSkills.map((skill) => skill.namespace));
    const demoCount = existingSkills.filter((skill) => skill.namespace.startsWith(DEMO_SKILL_NAMESPACE_PREFIX)).length;
    if (demoCount >= 60) return;

    const seeds = buildDemoSkillSeeds(nodes).filter((seed) => !existingNamespaces.has(seed.namespace));
    const created = await this.skillRepository.save(seeds.slice(0, 60 - demoCount).map((seed) => this.skillRepository.create({
      namespace: seed.namespace,
      name: seed.name,
      domain: seed.domain,
      subDomain: seed.subDomain,
      abilityName: seed.abilityName,
      description: seed.description,
      scope: 'platform',
      type: 'pure-business',
      status: 'published',
      ownerId,
      sopSource: 'process-architecture-demo',
      currentVersion: '1.0.0',
      executionType: 'manual',
      content: seed.content,
      agentPrompt: seed.content,
      files: '[]',
      toolDefinition: seed.toolDefinition,
      manifest: JSON.stringify({
        id: seed.namespace,
        version: '1.0.0',
        entrypoint: 'SKILL.md',
        triggers: JSON.parse(seed.triggerRules),
      }),
      runtimePolicy: JSON.stringify({ network: 'none', filesystem: 'read-only' }),
      triggerRules: seed.triggerRules,
      processArchitectureNodeIds: JSON.stringify(seed.processArchitectureNodeIds),
    })));

    await this.skillVersionRepository.save(created.map((skill) => this.skillVersionRepository.create({
      skillId: skill.id,
      version: '1.0.0',
      description: skill.description,
      changelog: '流程架构演示资产初始化',
      isLatest: true,
    })));
  }

  private async ensureDemoKnowledgeBases(nodes: ProcessArchitectureAssetNode[], ownerId: number) {
    const existingKnowledgeBases = await this.knowledgeBaseRepository.find({ order: { id: 'ASC' } });
    const existingNames = new Set(existingKnowledgeBases.map((knowledgeBase) => knowledgeBase.name));
    const demoCount = existingKnowledgeBases.filter((knowledgeBase) => knowledgeBase.name.startsWith(DEMO_KNOWLEDGE_PREFIX)).length;
    if (demoCount >= 60) return;

    const seeds = buildDemoKnowledgeBaseSeeds(nodes).filter((seed) => !existingNames.has(seed.name));
    for (const seed of seeds.slice(0, 60 - demoCount)) {
      const knowledgeBase = await this.knowledgeBaseRepository.save(this.knowledgeBaseRepository.create({
        name: seed.name,
        description: seed.description,
        source: 'local',
        documents: [seed.document.name],
        documentCount: 1,
        status: 'connected',
        userId: ownerId,
      }));
      await this.createSeedKnowledgeDocument(knowledgeBase, seed.node, seed.document);
    }
  }

  private async ensureKnowledgeBaseHasArchitectureDocument(
    knowledgeBase: KnowledgeBase,
    node: ProcessArchitectureAssetNode,
    ownerId: number,
  ) {
    if (!knowledgeBase.userId) {
      await this.knowledgeBaseRepository.update(knowledgeBase.id, { userId: ownerId });
    }

    const documents = await this.knowledgeDocumentRepository.find({
      where: { knowledgeBaseId: knowledgeBase.id },
      order: { id: 'ASC' },
    });
    const hasBindableDocument = documents.some((document) =>
      this.hasBindableArchitectureBinding(document.processArchitectureNodeIds, [node]),
    );

    if (documents.length === 0) {
      const document = buildArchitectureBindingDocument(knowledgeBase.name, node);
      await this.createSeedKnowledgeDocument(knowledgeBase, node, document);
      await this.knowledgeBaseRepository.update(knowledgeBase.id, {
        documents: [document.name],
        documentCount: 1,
      });
      return;
    }

    if (!hasBindableDocument) {
      await Promise.all(documents.map((document) => this.knowledgeDocumentRepository.update(document.id, {
        processArchitectureNodeIds: [node.id],
      })));
      await this.knowledgeChunkRepository.update({ knowledgeBaseId: knowledgeBase.id } as any, {
        processArchitectureNodeIds: [node.id],
      });
    }
  }

  private async createSeedKnowledgeDocument(
    knowledgeBase: KnowledgeBase,
    node: ProcessArchitectureAssetNode,
    document: { name: string; content: string },
  ) {
    const savedDocument = await this.knowledgeDocumentRepository.save(this.knowledgeDocumentRepository.create({
      knowledgeBaseId: knowledgeBase.id,
      name: document.name,
      mimeType: 'text/markdown',
      size: Buffer.byteLength(document.content),
      status: 'indexed',
      textPreview: document.content.slice(0, 500),
      chunkCount: 1,
      processArchitectureNodeIds: [node.id],
    }));
    await this.knowledgeChunkRepository.save(this.knowledgeChunkRepository.create({
      knowledgeBaseId: knowledgeBase.id,
      documentId: savedDocument.id,
      chunkIndex: 0,
      content: document.content,
      embedding: createDeterministicEmbedding(document.content),
      processArchitectureNodeIds: [node.id],
      metadata: {
        documentName: document.name,
        processArchitectureNodeIds: [node.id],
        processName: node.name,
        processCode: node.code,
        sectionTitle: node.name,
        source: 'process-architecture-demo',
      },
    }));
  }

  private async ensureSeedOwnerId() {
    const configuredAdminEmail = (process.env.ADMIN_EMAIL || '494161546@qq.com').trim().toLowerCase();
    const existing =
      await this.userRepository.findOne({ where: { email: configuredAdminEmail } }) ||
      await this.userRepository.findOne({ where: { isAdmin: true } }) ||
      await this.userRepository.findOne({ order: { id: 'ASC' } });
    if (existing) return existing.id;

    const systemUser = await this.userRepository.save(this.userRepository.create({
      email: 'process.seed@skill-platform.local',
      phone: null,
      isAdmin: true,
      firstLoginAt: new Date(),
      lastLoginAt: new Date(),
      loginCount: 0,
    }));
    return systemUser.id;
  }

  private hasBindableArchitectureBinding(value: unknown, nodes: ProcessArchitectureAssetNode[]) {
    const bindableNodeIds = new Set(nodes.map((node) => node.id));
    return parseProcessArchitectureBinding(value).some((id) => bindableNodeIds.has(id));
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
