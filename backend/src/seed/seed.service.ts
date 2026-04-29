import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import {
  Tenant,
  Organization,
  User,
  Skill,
  SkillVersion,
  JobModel,
  JobModelSkill,
  SkillUsageStat,
  ArchitectureTree,
  ArchitectureNode,
  ArchitectureFile,
  BusinessProcess,
  ProcessDocument,
} from '../entities';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(Tenant)
    private tenantRepository: Repository<Tenant>,
    @InjectRepository(Organization)
    private orgRepository: Repository<Organization>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Skill)
    private skillRepository: Repository<Skill>,
    @InjectRepository(SkillVersion)
    private skillVersionRepository: Repository<SkillVersion>,
    @InjectRepository(JobModel)
    private jobModelRepository: Repository<JobModel>,
    @InjectRepository(JobModelSkill)
    private jobModelSkillRepository: Repository<JobModelSkill>,
    @InjectRepository(SkillUsageStat)
    private skillUsageStatRepository: Repository<SkillUsageStat>,
    @InjectRepository(ArchitectureTree)
    private archTreeRepository: Repository<ArchitectureTree>,
    @InjectRepository(ArchitectureNode)
    private archNodeRepository: Repository<ArchitectureNode>,
    @InjectRepository(ArchitectureFile)
    private archFileRepository: Repository<ArchitectureFile>,
    @InjectRepository(BusinessProcess)
    private processRepository: Repository<BusinessProcess>,
    @InjectRepository(ProcessDocument)
    private processDocRepository: Repository<ProcessDocument>,
  ) {}

  async onModuleInit() {
    await this.seed();
  }

  private generateApiKey(): string {
    return `sk-${crypto.randomBytes(8).toString('hex')}`;
  }

  async seed() {
    // 先创建默认租户
    await this.seedDefaultTenant();

    // 检查是否已有数据
    const orgCount = await this.orgRepository.count();
    if (orgCount > 0) {
      this.logger.log('数据库已有数据，跳过种子数据初始化');
      return;
    }

    this.logger.log('开始初始化种子数据...');

    // 1. 创建组织树
    const organizations = await this.seedOrganizations();
    this.logger.log(`✓ 创建了 ${organizations.length} 个组织`);

    // 2. 创建用户
    const users = await this.seedUsers();
    this.logger.log(`✓ 创建了 ${users.length} 个用户`);

    // 3. 创建 Skills
    const skills = await this.seedSkills(users);
    this.logger.log(`✓ 创建了 ${skills.length} 个 Skill`);

    // 4. 创建 JobModels
    const jobModels = await this.seedJobModels(skills);
    this.logger.log(`✓ 创建了 ${jobModels.length} 个 JobModel`);

    // 5. 创建架构树
    const archTree = await this.seedArchitectureTree();
    this.logger.log(`✓ 创建了架构树，包含 ${archTree.nodeCount} 个节点`);

    // 6. 创建业务流程
    const processes = await this.seedBusinessProcesses(archTree.nodeIds);
    this.logger.log(`✓ 创建了 ${processes.length} 个业务流程`);

    this.logger.log('种子数据初始化完成!');
  }

  private async seedDefaultTenant(): Promise<Tenant> {
    // 检查默认租户是否已存在
    let tenant = await this.tenantRepository.findOne({ where: { id: 1 } });
    if (tenant) {
      return tenant;
    }

    // 创建默认租户
    tenant = this.tenantRepository.create({
      id: 1,
      name: '默认企业',
      code: 'default',
      status: 'active',
      plan: 'enterprise',
      contactEmail: 'admin@default.com',
    });
    await this.tenantRepository.save(tenant);
    this.logger.log('✓ 创建了默认租户');
    return tenant;
  }

  private async seedOrganizations(): Promise<Organization[]> {
    const orgData = [
      // level 0 - 根节点
      { id: 1, name: '集团总部', parentId: undefined as number | undefined, level: 0, path: '/' },
      // level 1 - 一级部门
      { id: 2, name: '法务部', parentId: 1, level: 1, path: '/法务部' },
      { id: 6, name: '财务部', parentId: 1, level: 1, path: '/财务部' },
      { id: 9, name: '采购部', parentId: 1, level: 1, path: '/采购部' },
      { id: 12, name: '人力资源部', parentId: 1, level: 1, path: '/人力资源部' },
      { id: 15, name: '技术部', parentId: 1, level: 1, path: '/技术部' },
      // level 2 - 二级组
      { id: 3, name: '合同组', parentId: 2, level: 2, path: '/法务部/合同组' },
      { id: 4, name: '诉讼组', parentId: 2, level: 2, path: '/法务部/诉讼组' },
      { id: 5, name: '知识产权组', parentId: 2, level: 2, path: '/法务部/知识产权组' },
      { id: 7, name: '会计组', parentId: 6, level: 2, path: '/财务部/会计组' },
      { id: 8, name: '税务组', parentId: 6, level: 2, path: '/财务部/税务组' },
      { id: 10, name: '寻源组', parentId: 9, level: 2, path: '/采购部/寻源组' },
      { id: 11, name: '供应商管理组', parentId: 9, level: 2, path: '/采购部/供应商管理组' },
      { id: 13, name: '招聘组', parentId: 12, level: 2, path: '/人力资源部/招聘组' },
      { id: 14, name: '培训组', parentId: 12, level: 2, path: '/人力资源部/培训组' },
      { id: 16, name: '开发组', parentId: 15, level: 2, path: '/技术部/开发组' },
      { id: 17, name: '测试组', parentId: 15, level: 2, path: '/技术部/测试组' },
    ];

    const entities = this.orgRepository.create(orgData as any[]);
    return await this.orgRepository.save(entities);
  }

  private async seedUsers(): Promise<User[]> {
    const userData = [
      { name: '系统管理员', email: 'admin@skill.com', role: 'admin', orgId: 1, jobTitle: '管理员' },
      { name: '法务经理', email: 'legal.manager@skill.com', role: 'manager', orgId: 2, jobTitle: '法务部经理' },
      { name: '合同专员', email: 'contract.staff@skill.com', role: 'member', orgId: 3, jobTitle: '合同专员' },
      { name: '财务经理', email: 'finance.manager@skill.com', role: 'manager', orgId: 6, jobTitle: '财务部经理' },
      { name: '采购专员', email: 'procurement.staff@skill.com', role: 'member', orgId: 9, jobTitle: '采购专员' },
      { name: '技术主管', email: 'tech.lead@skill.com', role: 'manager', orgId: 15, jobTitle: '技术主管' },
      { name: '超级管理员', email: '494161546@qq.com', role: 'super-admin', orgId: 1, jobTitle: '超级管理员' },
    ];

    // 使用 bcrypt 加密密码
    const hashedPassword = await bcrypt.hash('13136092523', 10);

    const users: User[] = [];
    for (const data of userData) {
      const user = this.userRepository.create({
        ...data,
        password: hashedPassword,
        apiKey: this.generateApiKey(),
      });
      users.push(await this.userRepository.save(user));
    }
    return users;
  }

  private async seedSkills(users: User[]): Promise<Skill[]> {
    const legalManager = users.find((u) => u.email === 'legal.manager@skill.com')!;
    const financeManager = users.find((u) => u.email === 'finance.manager@skill.com')!;
    const procurementStaff = users.find((u) => u.email === 'procurement.staff@skill.com')!;
    const contractStaff = users.find((u) => u.email === 'contract.staff@skill.com')!;
    const techLead = users.find((u) => u.email === 'tech.lead@skill.com')!;

    const skillData = [
      {
        namespace: 'legal.contract.risk-check',
        name: '合同条款风险识别',
        domain: 'legal',
        subDomain: 'contract',
        abilityName: '风险识别',
        description: '自动识别合同中的高风险条款，包括责任条款、违约条款、争议解决条款等',
        scope: 'business',
        type: 'pure-business',
        status: 'published',
        ownerId: legalManager.id,
        orgId: 2,
        input: { schema: { type: 'object', properties: { contractText: { type: 'string' } } } },
        output: { schema: { type: 'array', items: { type: 'object', properties: { clause: { type: 'string' }, riskLevel: { type: 'string' } } } } },
      },
      {
        namespace: 'legal.contract.text-parse',
        name: '合同文本解析',
        domain: 'legal',
        subDomain: 'contract',
        abilityName: '文本解析',
        description: '将合同文档解析为结构化数据，提取关键信息如甲乙方、金额、日期等',
        scope: 'business',
        type: 'light-tech',
        status: 'published',
        ownerId: legalManager.id,
        orgId: 2,
        input: { schema: { type: 'object', properties: { document: { type: 'string' } } } },
        output: { schema: { type: 'object', properties: { parties: { type: 'array' }, amount: { type: 'number' }, dates: { type: 'array' } } } },
      },
      {
        namespace: 'legal.contract.review-report',
        name: '审查意见生成',
        domain: 'legal',
        subDomain: 'contract',
        abilityName: '审查报告',
        description: '根据合同分析结果生成标准化的审查意见报告',
        scope: 'business',
        type: 'pure-business',
        status: 'published',
        ownerId: contractStaff.id,
        orgId: 3,
        input: { schema: { type: 'object', properties: { analysisResult: { type: 'object' } } } },
        output: { schema: { type: 'object', properties: { report: { type: 'string' }, suggestions: { type: 'array' } } } },
      },
      {
        namespace: 'finance.accounting.invoice-check',
        name: '发票校验',
        domain: 'finance',
        subDomain: 'accounting',
        abilityName: '发票校验',
        description: '校验发票真伪、税号、金额计算是否正确',
        scope: 'business',
        type: 'light-tech',
        status: 'published',
        ownerId: financeManager.id,
        orgId: 6,
        input: { schema: { type: 'object', properties: { invoiceImage: { type: 'string' }, invoiceCode: { type: 'string' } } } },
        output: { schema: { type: 'object', properties: { isValid: { type: 'boolean' }, errors: { type: 'array' } } } },
      },
      {
        namespace: 'finance.tax.rate-calc',
        name: '税率计算',
        domain: 'finance',
        subDomain: 'tax',
        abilityName: '税率计算',
        description: '根据交易类型和金额计算适用税率和税额',
        scope: 'personal',
        type: 'pure-business',
        status: 'draft',
        ownerId: financeManager.id,
        orgId: 6,
        input: { schema: { type: 'object', properties: { transactionType: { type: 'string' }, amount: { type: 'number' } } } },
        output: { schema: { type: 'object', properties: { taxRate: { type: 'number' }, taxAmount: { type: 'number' } } } },
      },
      {
        namespace: 'procurement.sourcing.supplier-search',
        name: '供应商检索',
        domain: 'procurement',
        subDomain: 'sourcing',
        abilityName: '供应商检索',
        description: '根据采购需求检索匹配的供应商，支持多维度筛选',
        scope: 'business',
        type: 'light-tech',
        status: 'reviewing',
        ownerId: procurementStaff.id,
        orgId: 9,
        input: { schema: { type: 'object', properties: { category: { type: 'string' }, requirements: { type: 'array' } } } },
        output: { schema: { type: 'array', items: { type: 'object', properties: { supplierId: { type: 'string' }, name: { type: 'string' }, score: { type: 'number' } } } } },
      },
      {
        namespace: 'hr.recruitment.resume-parse',
        name: '简历解析',
        domain: 'hr',
        subDomain: 'recruitment',
        abilityName: '简历解析',
        description: '将简历文档解析为结构化数据，提取教育背景、工作经历等',
        scope: 'platform',
        type: 'heavy-tech',
        status: 'published',
        ownerId: techLead.id,
        orgId: 15,
        input: { schema: { type: 'object', properties: { resumeFile: { type: 'string' } } } },
        output: { schema: { type: 'object', properties: { name: { type: 'string' }, education: { type: 'array' }, experience: { type: 'array' } } } },
      },
      {
        namespace: 'platform.document.format-convert',
        name: '文档格式转换',
        domain: 'platform',
        subDomain: 'document',
        abilityName: '格式转换',
        description: '支持 Word、PDF、Markdown 等格式之间的相互转换',
        scope: 'platform',
        type: 'heavy-tech',
        status: 'published',
        ownerId: techLead.id,
        orgId: 15,
        input: { schema: { type: 'object', properties: { sourceFile: { type: 'string' }, targetFormat: { type: 'string' } } } },
        output: { schema: { type: 'object', properties: { convertedFile: { type: 'string' }, success: { type: 'boolean' } } } },
      },
    ];

    const skills: Skill[] = [];
    for (const data of skillData) {
      const { input, output, ...skillInfo } = data;
      const skill = this.skillRepository.create(skillInfo);
      const savedSkill = await this.skillRepository.save(skill);

      // 创建对应的 SkillVersion
      const version = this.skillVersionRepository.create({
        skillId: savedSkill.id,
        version: '1.0.0',
        description: savedSkill.description,
        input,
        output,
        dependencies: [],
        changelog: '初始版本',
        isLatest: true,
      });
      await this.skillVersionRepository.save(version);

      // 创建使用统计
      const stat = this.skillUsageStatRepository.create({
        skillId: savedSkill.id,
        callCount: Math.floor(Math.random() * 100),
        successRate: 95 + Math.random() * 5,
      });
      await this.skillUsageStatRepository.save(stat);

      skills.push(savedSkill);
    }

    return skills;
  }

  private async seedJobModels(skills: Skill[]): Promise<JobModel[]> {
    const riskCheck = skills.find((s) => s.namespace === 'legal.contract.risk-check')!;
    const textParse = skills.find((s) => s.namespace === 'legal.contract.text-parse')!;
    const reviewReport = skills.find((s) => s.namespace === 'legal.contract.review-report')!;
    const formatConvert = skills.find((s) => s.namespace === 'platform.document.format-convert')!;
    const invoiceCheck = skills.find((s) => s.namespace === 'finance.accounting.invoice-check')!;
    const rateCalc = skills.find((s) => s.namespace === 'finance.tax.rate-calc')!;

    const jobModels: JobModel[] = [];

    // 法务-合同专员 Model
    const legalModel = this.jobModelRepository.create({
      name: '法务-合同专员',
      description: '合同组专员岗位所需的技能集合',
      orgId: 3,
    });
    const savedLegalModel = await this.jobModelRepository.save(legalModel);

    const legalSkills = [
      { modelId: savedLegalModel.id, skillId: riskCheck.id, priority: 'required' },
      { modelId: savedLegalModel.id, skillId: textParse.id, priority: 'required' },
      { modelId: savedLegalModel.id, skillId: reviewReport.id, priority: 'required' },
      { modelId: savedLegalModel.id, skillId: formatConvert.id, priority: 'recommended' },
    ];

    for (const data of legalSkills) {
      const jms = this.jobModelSkillRepository.create(data);
      await this.jobModelSkillRepository.save(jms);
    }

    jobModels.push(savedLegalModel);

    // 财务-会计专员 Model
    const financeModel = this.jobModelRepository.create({
      name: '财务-会计专员',
      description: '会计组专员岗位所需的技能集合',
      orgId: 7,
    });
    const savedFinanceModel = await this.jobModelRepository.save(financeModel);

    const financeSkills = [
      { modelId: savedFinanceModel.id, skillId: invoiceCheck.id, priority: 'required' },
      { modelId: savedFinanceModel.id, skillId: rateCalc.id, priority: 'recommended' },
    ];

    for (const data of financeSkills) {
      const jms = this.jobModelSkillRepository.create(data);
      await this.jobModelSkillRepository.save(jms);
    }

    jobModels.push(savedFinanceModel);

    return jobModels;
  }

  private async seedArchitectureTree(): Promise<{ nodeCount: number; nodeIds: Map<string, number> }> {
    // 创建架构树
    const tree = this.archTreeRepository.create({
      name: '企业业务架构',
      version: '1.0.0',
      versionLabel: '初始架构',
      isActive: true,
    });
    const savedTree = await this.archTreeRepository.save(tree);

    const nodeIds = new Map<string, number>();

    // L1 节点数据
    const l1Nodes = [
      { name: '法务管理', sortOrder: 1, totalSkills: 12, coveredSkills: 8 },
      { name: '财务管理', sortOrder: 2, totalSkills: 15, coveredSkills: 10 },
      { name: '采购管理', sortOrder: 3, totalSkills: 10, coveredSkills: 6 },
      { name: '人力资源管理', sortOrder: 4, totalSkills: 18, coveredSkills: 12 },
      { name: '技术管理', sortOrder: 5, totalSkills: 20, coveredSkills: 16 },
      { name: '平台与IT', sortOrder: 6, totalSkills: 8, coveredSkills: 7 },
    ];

    // 创建 L1 节点
    for (const l1Data of l1Nodes) {
      const l1 = this.archNodeRepository.create({
        ...l1Data,
        level: 1,
        treeId: savedTree.id,
      });
      const savedL1 = await this.archNodeRepository.save(l1);
      nodeIds.set(l1Data.name, savedL1.id);
    }

    // L2 节点数据
    const l2Nodes = [
      // 法务管理下的 L2
      { name: '合同管理', parentKey: '法务管理', sortOrder: 1, totalSkills: 5, coveredSkills: 4 },
      { name: '诉讼管理', parentKey: '法务管理', sortOrder: 2, totalSkills: 4, coveredSkills: 2 },
      { name: '知识产权', parentKey: '法务管理', sortOrder: 3, totalSkills: 3, coveredSkills: 2 },
      // 财务管理下的 L2
      { name: '会计核算', parentKey: '财务管理', sortOrder: 1, totalSkills: 6, coveredSkills: 5 },
      { name: '税务管理', parentKey: '财务管理', sortOrder: 2, totalSkills: 5, coveredSkills: 3 },
      { name: '资金管理', parentKey: '财务管理', sortOrder: 3, totalSkills: 4, coveredSkills: 2 },
      // 采购管理下的 L2
      { name: '供应商管理', parentKey: '采购管理', sortOrder: 1, totalSkills: 5, coveredSkills: 3 },
      { name: '采购执行', parentKey: '采购管理', sortOrder: 2, totalSkills: 5, coveredSkills: 3 },
      // 人力资源管理下的 L2
      { name: '招聘管理', parentKey: '人力资源管理', sortOrder: 1, totalSkills: 6, coveredSkills: 4 },
      { name: '培训发展', parentKey: '人力资源管理', sortOrder: 2, totalSkills: 6, coveredSkills: 5 },
      { name: '绩效管理', parentKey: '人力资源管理', sortOrder: 3, totalSkills: 6, coveredSkills: 3 },
      // 技术管理下的 L2
      { name: '研发管理', parentKey: '技术管理', sortOrder: 1, totalSkills: 10, coveredSkills: 8 },
      { name: '测试管理', parentKey: '技术管理', sortOrder: 2, totalSkills: 10, coveredSkills: 8 },
      // 平台与IT下的 L2
      { name: 'IT运维', parentKey: '平台与IT', sortOrder: 1, totalSkills: 4, coveredSkills: 4 },
      { name: '平台服务', parentKey: '平台与IT', sortOrder: 2, totalSkills: 4, coveredSkills: 3 },
    ];

    // 创建 L2 节点
    for (const l2Data of l2Nodes) {
      const parentId = nodeIds.get(l2Data.parentKey);
      const l2 = this.archNodeRepository.create({
        name: l2Data.name,
        level: 2,
        parentId,
        treeId: savedTree.id,
        sortOrder: l2Data.sortOrder,
        totalSkills: l2Data.totalSkills,
        coveredSkills: l2Data.coveredSkills,
      });
      const savedL2 = await this.archNodeRepository.save(l2);
      nodeIds.set(l2Data.name, savedL2.id);
    }

    // L3 节点数据（部分 L2 下有 L3）
    const l3Nodes = [
      // 合同管理下的 L3
      { name: '合同起草', parentKey: '合同管理', sortOrder: 1, totalSkills: 2, coveredSkills: 2 },
      { name: '合同审核', parentKey: '合同管理', sortOrder: 2, totalSkills: 2, coveredSkills: 1 },
      { name: '合同履行', parentKey: '合同管理', sortOrder: 3, totalSkills: 1, coveredSkills: 1 },
      // 会计核算下的 L3
      { name: '凭证管理', parentKey: '会计核算', sortOrder: 1, totalSkills: 3, coveredSkills: 3 },
      { name: '报表编制', parentKey: '会计核算', sortOrder: 2, totalSkills: 3, coveredSkills: 2 },
      // 招聘管理下的 L3
      { name: '简历筛选', parentKey: '招聘管理', sortOrder: 1, totalSkills: 2, coveredSkills: 2 },
      { name: '面试安排', parentKey: '招聘管理', sortOrder: 2, totalSkills: 2, coveredSkills: 1 },
      { name: '入职办理', parentKey: '招聘管理', sortOrder: 3, totalSkills: 2, coveredSkills: 1 },
    ];

    // 创建 L3 节点
    for (const l3Data of l3Nodes) {
      const parentId = nodeIds.get(l3Data.parentKey);
      const l3 = this.archNodeRepository.create({
        name: l3Data.name,
        level: 3,
        parentId,
        treeId: savedTree.id,
        sortOrder: l3Data.sortOrder,
        totalSkills: l3Data.totalSkills,
        coveredSkills: l3Data.coveredSkills,
      });
      const savedL3 = await this.archNodeRepository.save(l3);
      nodeIds.set(l3Data.name, savedL3.id);
    }

    // 为部分末级节点添加示例文件
    const fileData = [
      { nodeName: '合同起草', name: '合同起草SOP', type: 'sop', content: '1. 确认合同类型\n2. 选择模板\n3. 填写关键条款\n4. 提交审核' },
      { nodeName: '合同审核', name: '合同审核规范', type: 'process-doc', content: '合同审核需检查：主体资格、权利义务、违约条款、争议解决等' },
      { nodeName: '简历筛选', name: '简历筛选标准', type: 'sop', content: '1. 学历要求\n2. 工作年限\n3. 技能匹配度\n4. 项目经验' },
      { nodeName: '入职办理', name: '入职流程说明', type: 'process-doc', content: '入职材料准备 → 签订合同 → 系统开通 → 部门报到' },
    ];

    for (const file of fileData) {
      const nodeId = nodeIds.get(file.nodeName);
      if (nodeId) {
        const archFile = this.archFileRepository.create({
          name: file.name,
          type: file.type,
          content: file.content,
          nodeId,
        });
        await this.archFileRepository.save(archFile);
      }
    }

    return { nodeCount: l1Nodes.length + l2Nodes.length + l3Nodes.length, nodeIds };
  }

  private async seedBusinessProcesses(nodeIds: Map<string, number>): Promise<BusinessProcess[]> {
    const processData = [
      {
        name: '合同起草流程',
        description: '从需求提出到合同定稿的完整流程',
        archNodeKey: '合同起草',
        domain: 'legal',
        status: 'active',
        nodeCount: 8,
        sopCount: 2,
      },
      {
        name: '合同审核流程',
        description: '合同法务审核的标准流程',
        archNodeKey: '合同审核',
        domain: 'legal',
        status: 'active',
        nodeCount: 6,
        sopCount: 1,
      },
      {
        name: '员工入职流程',
        description: '新员工入职办理的完整流程',
        archNodeKey: '入职办理',
        domain: 'hr',
        status: 'active',
        nodeCount: 12,
        sopCount: 3,
      },
      {
        name: '简历筛选流程',
        description: '招聘简历筛选的标准流程',
        archNodeKey: '简历筛选',
        domain: 'hr',
        status: 'active',
        nodeCount: 5,
        sopCount: 1,
      },
      {
        name: '费用报销流程',
        description: '员工费用报销的审批流程',
        archNodeKey: '凭证管理',
        domain: 'finance',
        status: 'active',
        nodeCount: 7,
        sopCount: 2,
      },
      {
        name: '供应商准入流程',
        description: '新供应商评估准入的标准流程',
        archNodeKey: '供应商管理',
        domain: 'procurement',
        status: 'draft',
        nodeCount: 10,
        sopCount: 2,
      },
    ];

    const processes: BusinessProcess[] = [];

    for (const data of processData) {
      const archNodeId = nodeIds.get(data.archNodeKey);
      const process = this.processRepository.create({
        name: data.name,
        description: data.description,
        archNodeId,
        domain: data.domain,
        status: data.status,
        nodeCount: data.nodeCount,
        sopCount: data.sopCount,
      });
      const savedProcess = await this.processRepository.save(process);

      // 为流程添加示例文档
      const doc = this.processDocRepository.create({
        name: `${data.name}SOP文档`,
        type: 'sop',
        content: `${data.name}的标准操作流程文档`,
        processId: savedProcess.id,
      });
      await this.processDocRepository.save(doc);

      processes.push(savedProcess);
    }

    return processes;
  }
}
