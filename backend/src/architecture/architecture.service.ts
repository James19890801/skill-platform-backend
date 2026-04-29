import { Injectable, NotFoundException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import {
  Skill,
  Organization,
  ArchitectureTree,
  ArchitectureNode,
  ArchitectureFile,
} from '../entities';

export interface TreeNodeWithChildren extends ArchitectureNode {
  children?: TreeNodeWithChildren[];
  skillCoverage?: number;
}

@Injectable()
export class ArchitectureService implements OnModuleInit {
  constructor(
    @InjectRepository(Skill)
    private skillRepository: Repository<Skill>,
    @InjectRepository(Organization)
    private orgRepository: Repository<Organization>,
    @InjectRepository(ArchitectureTree)
    private treeRepository: Repository<ArchitectureTree>,
    @InjectRepository(ArchitectureNode)
    private nodeRepository: Repository<ArchitectureNode>,
    @InjectRepository(ArchitectureFile)
    private fileRepository: Repository<ArchitectureFile>,
  ) {}

  async onModuleInit() {
    await this.seedArchitectureData();
  }

  /**
   * 初始化架构树种子数据
   * 如果已存在足够的节点数据则跳过
   */
  private async seedArchitectureData() {
    // 检查是否已有足够的节点数据（超过5个节点说明已初始化）
    const nodeCount = await this.nodeRepository.count();
    if (nodeCount > 5) {
      console.log('[ArchitectureService] 架构树数据已存在，跳过初始化');
      return;
    }

    console.log('[ArchitectureService] 开始初始化架构树种子数据...');

    // 获取或创建架构树
    let tree = await this.treeRepository.findOne({ where: { isActive: true } });
    if (!tree) {
      tree = await this.treeRepository.save({
        name: '企业业务架构',
        version: '1.0.0',
        versionLabel: '初始架构',
        isActive: true,
        tenantId: 1,
      });
    }

    // 清理现有节点（如果有少量的）
    if (nodeCount > 0 && nodeCount <= 5) {
      await this.nodeRepository.delete({ treeId: tree.id });
    }

    // 定义6个L1域及其子节点
    const domains = [
      {
        name: '法务管理', children: [
          { name: '合同管理', children: [
            { name: '合同审批流程', totalSkills: 5, coveredSkills: 3 },
            { name: '合同归档流程', totalSkills: 3, coveredSkills: 0 },
          ]},
          { name: '知识产权管理', children: [
            { name: '专利申请流程', totalSkills: 4, coveredSkills: 2 },
          ]},
          { name: '诉讼管理', children: [
            { name: '诉讼应对流程', totalSkills: 6, coveredSkills: 0 },
          ]},
        ]
      },
      {
        name: '财务管理', children: [
          { name: '报账管理', children: [
            { name: '报账处理流程', totalSkills: 6, coveredSkills: 3 },
          ]},
          { name: '预算管理', children: [
            { name: '预算编制流程', totalSkills: 4, coveredSkills: 0 },
          ]},
          { name: '发票管理', children: [
            { name: '发票中心处理', totalSkills: 4, coveredSkills: 2 },
          ]},
        ]
      },
      {
        name: '采购管理', children: [
          { name: '供应商管理', children: [
            { name: '供应商准入流程', totalSkills: 5, coveredSkills: 2 },
            { name: '供应商考核流程', totalSkills: 3, coveredSkills: 0 },
          ]},
          { name: '采购执行', children: [
            { name: '采购下单流程', totalSkills: 5, coveredSkills: 1 },
          ]},
        ]
      },
      {
        name: '人力资源管理', children: [
          { name: '招聘管理', children: [
            { name: '员工入职流程', totalSkills: 7, coveredSkills: 5 },
          ]},
          { name: '绩效管理', children: [
            { name: '绩效考核流程', totalSkills: 5, coveredSkills: 0 },
          ]},
          { name: '培训管理', children: [
            { name: '培训计划流程', totalSkills: 4, coveredSkills: 0 },
          ]},
        ]
      },
      {
        name: '技术管理', children: [
          { name: '研发管理', children: [
            { name: '代码发布流程', totalSkills: 8, coveredSkills: 7 },
            { name: '需求评审流程', totalSkills: 6, coveredSkills: 3 },
          ]},
          { name: '运维管理', children: [
            { name: '故障处理流程', totalSkills: 4, coveredSkills: 3 },
          ]},
        ]
      },
      {
        name: '平台与IT', children: [
          { name: 'IT服务管理', children: [
            { name: '权限申请流程', totalSkills: 3, coveredSkills: 0 },
            { name: '设备采购流程', totalSkills: 2, coveredSkills: 0 },
          ]},
        ]
      },
    ];

    let sortOrder = 1;
    for (const l1 of domains) {
      // 创建L1节点
      const l1Node = this.nodeRepository.create({
        name: l1.name,
        level: 1,
        treeId: tree.id,
        sortOrder: sortOrder++,
        totalSkills: 0,
        coveredSkills: 0,
      });
      const savedL1 = await this.nodeRepository.save(l1Node);

      for (const l2 of l1.children) {
        // 创建L2节点
        const l2Node = this.nodeRepository.create({
          name: l2.name,
          level: 2,
          parentId: savedL1.id,
          treeId: tree.id,
          sortOrder: sortOrder++,
          totalSkills: 0,
          coveredSkills: 0,
        });
        const savedL2 = await this.nodeRepository.save(l2Node);

        for (const l3 of l2.children) {
          // 创建L3节点（末级节点，有实际的skill统计）
          const l3Node = this.nodeRepository.create({
            name: l3.name,
            level: 3,
            parentId: savedL2.id,
            treeId: tree.id,
            sortOrder: sortOrder++,
            totalSkills: l3.totalSkills,
            coveredSkills: l3.coveredSkills,
          });
          await this.nodeRepository.save(l3Node);
        }
      }
    }

    console.log('[ArchitectureService] 架构树种子数据初始化完成');
  }

  // ==================== 原有的技能架构API ====================
  async getSkillArchitecture() {
    const skills = await this.skillRepository.find({
      where: { status: 'published' },
      order: { domain: 'ASC', subDomain: 'ASC' },
    });

    const architecture: Record<string, Record<string, any[]>> = {};
    for (const skill of skills) {
      if (!architecture[skill.domain]) {
        architecture[skill.domain] = {};
      }
      if (!architecture[skill.domain][skill.subDomain]) {
        architecture[skill.domain][skill.subDomain] = [];
      }
      architecture[skill.domain][skill.subDomain].push(skill);
    }

    return architecture;
  }

  async getDomains() {
    const domains = await this.skillRepository
      .createQueryBuilder('skill')
      .select('DISTINCT skill.domain', 'domain')
      .getRawMany();

    return domains.map((d) => d.domain);
  }

  // ==================== 架构树管理 ====================
  async findAllTrees(tenantId: number = 1) {
    return this.treeRepository.find({
      where: { tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  async findActiveTree(tenantId: number = 1) {
    const tree = await this.treeRepository.findOne({
      where: { isActive: true, tenantId },
      relations: ['nodes', 'nodes.files'],
    });

    if (!tree) {
      return null;
    }

    // 构建树形结构并聚合覆盖率
    const treeStructure = this.buildTreeStructure(tree.nodes);
    return {
      ...tree,
      nodes: treeStructure,
    };
  }

  async createTree(data: Partial<ArchitectureTree>, tenantId: number = 1) {
    const tree = this.treeRepository.create({ ...data, tenantId });
    return this.treeRepository.save(tree);
  }

  async updateTree(id: number, data: Partial<ArchitectureTree>) {
    const tree = await this.treeRepository.findOne({ where: { id } });
    if (!tree) {
      throw new NotFoundException(`架构树 #${id} 不存在`);
    }
    Object.assign(tree, data);
    return this.treeRepository.save(tree);
  }

  async saveAsNewVersion(id: number, versionLabel?: string) {
    const sourceTree = await this.treeRepository.findOne({
      where: { id },
      relations: ['nodes', 'nodes.files'],
    });

    if (!sourceTree) {
      throw new NotFoundException(`架构树 #${id} 不存在`);
    }

    // 生成新版本号
    const versionParts = sourceTree.version.split('.');
    versionParts[2] = String(parseInt(versionParts[2]) + 1);
    const newVersion = versionParts.join('.');

    // 创建新树
    const newTree = this.treeRepository.create({
      name: sourceTree.name,
      version: newVersion,
      versionLabel: versionLabel || `版本 ${newVersion}`,
      isActive: false,
    });
    const savedTree = await this.treeRepository.save(newTree);

    // 复制节点
    const nodeIdMap = new Map<number, number>();
    const sortedNodes = [...sourceTree.nodes].sort((a, b) => a.level - b.level);

    for (const node of sortedNodes) {
      const newNode = this.nodeRepository.create({
        name: node.name,
        level: node.level,
        parentId: node.parentId ? nodeIdMap.get(node.parentId) : undefined,
        treeId: savedTree.id,
        description: node.description,
        sortOrder: node.sortOrder,
        totalSkills: node.totalSkills,
        coveredSkills: node.coveredSkills,
      });
      const savedNode = await this.nodeRepository.save(newNode);
      nodeIdMap.set(node.id, savedNode.id);

      // 复制文件
      if (node.files && node.files.length > 0) {
        for (const file of node.files) {
          const newFile = this.fileRepository.create({
            name: file.name,
            type: file.type,
            content: file.content,
            fileUrl: file.fileUrl,
            nodeId: savedNode.id,
          });
          await this.fileRepository.save(newFile);
        }
      }
    }

    return savedTree;
  }

  async activateTree(id: number) {
    // 将所有树设为非激活
    await this.treeRepository.update({}, { isActive: false });
    // 激活指定树
    await this.treeRepository.update(id, { isActive: true });
    return this.treeRepository.findOne({ where: { id } });
  }

  // ==================== 节点管理 ====================
  async findNodesByTree(treeId: number) {
    return this.nodeRepository.find({
      where: { treeId },
      relations: ['files'],
      order: { level: 'ASC', sortOrder: 'ASC' },
    });
  }

  async findNodesTree(treeId: number) {
    const nodes = await this.nodeRepository.find({
      where: { treeId },
      relations: ['files'],
      order: { level: 'ASC', sortOrder: 'ASC' },
    });

    return this.buildTreeStructure(nodes);
  }

  async findLeafNodes(treeId?: number) {
    const query = this.nodeRepository.createQueryBuilder('node');

    if (treeId) {
      query.where('node.treeId = :treeId', { treeId });
    }

    // 找出所有没有子节点的节点（叶子节点）
    const allNodes = await query.getMany();
    const parentIds = new Set(allNodes.filter((n) => n.parentId).map((n) => n.parentId));
    const leafNodes = allNodes.filter((n) => !parentIds.has(n.id));

    return leafNodes;
  }

  async findNodeById(id: number) {
    const node = await this.nodeRepository.findOne({
      where: { id },
      relations: ['files'],
    });

    if (!node) {
      throw new NotFoundException(`节点 #${id} 不存在`);
    }

    return node;
  }

  async createNode(data: Partial<ArchitectureNode>) {
    // 层级验证：不能超过 L6
    if (data.level && data.level > 6) {
      throw new BadRequestException('节点层级不能超过 L6');
    }
    const node = this.nodeRepository.create(data);
    return this.nodeRepository.save(node);
  }

  async updateNode(id: number, data: Partial<ArchitectureNode>) {
    const node = await this.nodeRepository.findOne({ where: { id } });
    if (!node) {
      throw new NotFoundException(`节点 #${id} 不存在`);
    }
    Object.assign(node, data);
    return this.nodeRepository.save(node);
  }

  async deleteNode(id: number) {
    const node = await this.nodeRepository.findOne({ where: { id } });
    if (!node) {
      throw new NotFoundException(`节点 #${id} 不存在`);
    }

    // 级联删除子节点
    await this.deleteNodeRecursive(id, node.treeId);

    return { success: true };
  }

  private async deleteNodeRecursive(nodeId: number, treeId: number) {
    // 找到所有子节点
    const children = await this.nodeRepository.find({
      where: { parentId: nodeId, treeId },
    });

    for (const child of children) {
      await this.deleteNodeRecursive(child.id, treeId);
    }

    // 删除节点的文件
    await this.fileRepository.delete({ nodeId });

    // 删除节点
    await this.nodeRepository.delete(nodeId);
  }

  async getNodePath(id: number) {
    const node = await this.nodeRepository.findOne({ where: { id } });
    if (!node) {
      throw new NotFoundException(`节点 #${id} 不存在`);
    }

    const path: ArchitectureNode[] = [node];
    let currentNode = node;

    while (currentNode.parentId) {
      const parentNode = await this.nodeRepository.findOne({
        where: { id: currentNode.parentId },
      });
      if (parentNode) {
        path.unshift(parentNode);
        currentNode = parentNode;
      } else {
        break;
      }
    }

    return path;
  }

  // ==================== 文件管理 ====================
  async createFile(data: Partial<ArchitectureFile>) {
    const file = this.fileRepository.create(data);
    return this.fileRepository.save(file);
  }

  async deleteFile(id: number) {
    const file = await this.fileRepository.findOne({ where: { id } });
    if (!file) {
      throw new NotFoundException(`文件 #${id} 不存在`);
    }
    await this.fileRepository.delete(id);
    return { success: true };
  }

  // ==================== 辅助方法 ====================
  private buildTreeStructure(nodes: ArchitectureNode[]): TreeNodeWithChildren[] {
    const nodeMap = new Map<number, TreeNodeWithChildren>();
    const rootNodes: TreeNodeWithChildren[] = [];

    // 创建节点映射
    for (const node of nodes) {
      nodeMap.set(node.id, { ...node, children: [] });
    }

    // 构建树形结构
    for (const node of nodes) {
      const treeNode = nodeMap.get(node.id)!;
      if (node.parentId && nodeMap.has(node.parentId)) {
        const parent = nodeMap.get(node.parentId)!;
        parent.children!.push(treeNode);
      } else {
        rootNodes.push(treeNode);
      }
    }

    // 自下而上聚合覆盖率
    this.aggregateCoverage(rootNodes);

    return rootNodes;
  }

  private aggregateCoverage(nodes: TreeNodeWithChildren[]) {
    for (const node of nodes) {
      if (node.children && node.children.length > 0) {
        // 先递归处理子节点
        this.aggregateCoverage(node.children);

        // 聚合子节点的统计数据
        let totalSkills = 0;
        let coveredSkills = 0;

        for (const child of node.children) {
          totalSkills += child.totalSkills;
          coveredSkills += child.coveredSkills;
        }

        node.totalSkills = totalSkills;
        node.coveredSkills = coveredSkills;
      }

      // 计算覆盖率
      node.skillCoverage =
        node.totalSkills > 0 ? Math.round((node.coveredSkills / node.totalSkills) * 100) : 0;
    }
  }
}
