import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CapabilityEdge, CapabilityNode, CapabilityTree } from '../entities';
import { buildCapabilityTreeSnapshot } from './capability-tree';
import { CreateCapabilityTreeDto, UpdateCapabilityTreeDto } from './dto';

@Injectable()
export class CapabilitiesService {
  constructor(
    @InjectRepository(CapabilityTree)
    private readonly treeRepository: Repository<CapabilityTree>,
    @InjectRepository(CapabilityNode)
    private readonly nodeRepository: Repository<CapabilityNode>,
    @InjectRepository(CapabilityEdge)
    private readonly edgeRepository: Repository<CapabilityEdge>,
  ) {}

  async findAll() {
    const [items, total] = await this.treeRepository.findAndCount({
      order: { updatedAt: 'DESC' },
    });
    return { items, total };
  }

  async findOne(id: number) {
    const tree = await this.treeRepository.findOne({ where: { id } });
    if (!tree) {
      throw new NotFoundException(`CapabilityTree #${id} not found`);
    }

    const [nodes, edges] = await Promise.all([
      this.nodeRepository.find({ where: { treeId: id }, order: { orderIndex: 'ASC', id: 'ASC' } }),
      this.edgeRepository.find({ where: { treeId: id }, order: { priority: 'ASC', id: 'ASC' } }),
    ]);

    return {
      ...tree,
      nodes,
      edges,
      snapshot: buildCapabilityTreeSnapshot(nodes),
    };
  }

  async create(dto: CreateCapabilityTreeDto, ownerId: number) {
    const tree = await this.treeRepository.save(this.treeRepository.create({
      name: dto.name,
      description: dto.description || null,
      ownerId,
      scope: dto.scope || 'business',
      version: dto.version || '1.0.0',
      status: dto.status || 'draft',
    }));

    await this.replaceChildren(tree.id, dto);
    return this.findOne(tree.id);
  }

  async update(id: number, dto: UpdateCapabilityTreeDto, userId: number, isAdmin: boolean) {
    const existing = await this.treeRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`CapabilityTree #${id} not found`);
    }
    if (!isAdmin && existing.ownerId !== userId) {
      throw new ForbiddenException('只能编辑自己的能力树');
    }

    await this.treeRepository.update(id, {
      name: dto.name ?? existing.name,
      description: dto.description ?? existing.description,
      scope: dto.scope ?? existing.scope,
      version: dto.version ?? existing.version,
      status: dto.status ?? existing.status,
    });

    if (dto.nodes || dto.edges) {
      await this.replaceChildren(id, dto);
    }

    return this.findOne(id);
  }

  async remove(id: number, userId: number, isAdmin: boolean) {
    const existing = await this.treeRepository.findOne({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`CapabilityTree #${id} not found`);
    }
    if (!isAdmin && existing.ownerId !== userId) {
      throw new ForbiddenException('只能删除自己的能力树');
    }

    await this.treeRepository.delete(id);
    return { success: true };
  }

  private async replaceChildren(treeId: number, dto: Pick<CreateCapabilityTreeDto, 'nodes' | 'edges'>) {
    await this.edgeRepository.delete({ treeId });
    await this.nodeRepository.delete({ treeId });

    if (dto.nodes?.length) {
      await this.nodeRepository.save(dto.nodes.map((node, index) => this.nodeRepository.create({
        treeId,
        parentId: node.parentId ?? null,
        nodeType: node.nodeType || 'group',
        label: node.label,
        domain: node.domain || null,
        subDomain: node.subDomain || null,
        skillId: node.skillId ?? null,
        namespace: node.namespace || null,
        orderIndex: node.orderIndex ?? index,
        loopPolicy: node.loopPolicy === undefined ? null : JSON.stringify(node.loopPolicy),
        conditionExpression: node.conditionExpression || null,
      })));
    }

    if (dto.edges?.length) {
      await this.edgeRepository.save(dto.edges.map((edge, index) => this.edgeRepository.create({
        treeId,
        sourceNodeId: edge.sourceNodeId,
        targetNodeId: edge.targetNodeId,
        edgeType: edge.edgeType || 'sequence',
        conditionExpression: edge.conditionExpression || null,
        priority: edge.priority ?? index,
      })));
    }
  }
}
