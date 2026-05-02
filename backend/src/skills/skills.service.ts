import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { Skill, SkillVersion, SkillReview } from '../entities';
import {
  CreateSkillDto,
  UpdateSkillDto,
  CreateSkillVersionDto,
  SkillQueryDto,
  SubmitReviewDto,
} from './dto';

// 执行配置字段（只有 manager/admin 可以编辑）
const EXECUTION_CONFIG_FIELDS = [
  'executionType', 'endpoint', 'httpMethod', 'headers',
  'requestTemplate', 'responseMapping', 'authConfig', 'errorHandling',
  'agentPrompt', 'toolDefinition',
];

// 业务信息字段（member 可以编辑自己的 Skill）
const BUSINESS_INFO_FIELDS = [
  'name', 'domain', 'subDomain', 'abilityName', 'description', 'scope', 'type', 'content', 'files',
];

@Injectable()
export class SkillsService {
  constructor(
    @InjectRepository(Skill)
    private skillRepository: Repository<Skill>,
    @InjectRepository(SkillVersion)
    private versionRepository: Repository<SkillVersion>,
    @InjectRepository(SkillReview)
    private reviewRepository: Repository<SkillReview>,
  ) {}

  async findAll(query: SkillQueryDto, tenantId: number = 1) {
    const { domain, status, scope, page = 1, limit = 10, search } = query;

    const where: any = { tenantId };
    if (domain) where.domain = domain;
    if (status) where.status = status;
    if (scope) where.scope = scope;
    if (search) {
      where.name = Like(`%${search}%`);
    }

    const [items, total] = await this.skillRepository.findAndCount({
      where,
      relations: ['owner', 'organization'],
      skip: (page - 1) * limit,
      take: limit,
      order: { updatedAt: 'DESC' },
    });

    return {
      items,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: number, tenantId: number = 1) {
    const skill = await this.skillRepository.findOne({
      where: { id, tenantId },
      relations: ['owner', 'organization', 'versions'],
    });

    if (!skill) {
      throw new NotFoundException(`Skill #${id} not found`);
    }

    // 获取关联的审核记录
    const reviews = await this.reviewRepository.find({
      where: { skillId: id },
      relations: ['submitter', 'reviewer'],
      order: { createdAt: 'DESC' },
    });

    return { ...skill, reviews };
  }

  async create(createDto: CreateSkillDto, userId: number, tenantId: number = 1) {
    // 检查命名空间是否已存在（在同一租户内）
    const existing = await this.skillRepository.findOne({
      where: { namespace: createDto.namespace, tenantId },
    });
    if (existing) {
      throw new BadRequestException(`Namespace ${createDto.namespace} already exists`);
    }

    const skill = this.skillRepository.create({
      ...createDto,
      ownerId: userId,
      tenantId,
      status: 'draft',
      currentVersion: '1.0.0',
    });

    const savedSkill = await this.skillRepository.save(skill);

    // 创建初始版本
    const version = this.versionRepository.create({
      skillId: savedSkill.id,
      version: '1.0.0',
      description: createDto.description,
      changelog: '初始版本',
      isLatest: true,
    });
    await this.versionRepository.save(version);

    return this.findOne(savedSkill.id, tenantId);
  }

  async update(id: number, updateDto: UpdateSkillDto, userId: number, tenantId: number = 1, userRole: string = 'member') {
    const skill = await this.findOne(id, tenantId);

    // member 角色权限检查
    if (userRole === 'member') {
      // member 只能编辑自己的 Skill
      if (skill.ownerId !== userId) {
        throw new ForbiddenException('You can only edit your own skills');
      }
      
      // member 不能编辑执行配置字段
      const hasExecutionConfigFields = Object.keys(updateDto).some(
        key => EXECUTION_CONFIG_FIELDS.includes(key) && updateDto[key as keyof UpdateSkillDto] !== undefined
      );
      if (hasExecutionConfigFields) {
        throw new ForbiddenException('You do not have permission to edit execution configuration. Contact a manager.');
      }
    }

    // manager/admin 可以编辑任何 Skill 的执行配置
    // 但只有 owner 或 manager/admin 才能编辑业务信息
    if (userRole !== 'admin' && userRole !== 'manager') {
      // 已在上面检查 member 是否为 owner
    }

    Object.assign(skill, updateDto);
    await this.skillRepository.save(skill);

    return this.findOne(id, tenantId);
  }

  async remove(id: number, userId: number, tenantId: number = 1) {
    const skill = await this.findOne(id, tenantId);

    // 只有 owner 且草稿状态才能删除
    if (skill.ownerId !== userId) {
      throw new BadRequestException('Only owner can delete this skill');
    }
    if (skill.status === 'published') {
      throw new BadRequestException('Cannot delete published skill');
    }

    await this.versionRepository.delete({ skillId: id });
    await this.reviewRepository.delete({ skillId: id });
    await this.skillRepository.delete(id);

    return { success: true };
  }

  async submitForReview(id: number, dto: SubmitReviewDto, userId: number, tenantId: number = 1) {
    const skill = await this.findOne(id, tenantId);

    if (skill.status !== 'draft' && skill.status !== 'rejected') {
      throw new BadRequestException('Only draft or rejected skills can be submitted for review');
    }

    // 创建审核记录
    const review = this.reviewRepository.create({
      skillId: id,
      submitterId: userId,
      targetScope: dto.targetScope,
      comment: dto.comment,
      status: 'pending',
      tenantId,
    });
    await this.reviewRepository.save(review);

    // 更新 skill 状态
    skill.status = 'reviewing';
    await this.skillRepository.save(skill);

    return this.findOne(id, tenantId);
  }

  async publish(id: number, userId: number, tenantId: number = 1) {
    const skill = await this.findOne(id, tenantId);

    if (skill.status !== 'reviewing') {
      throw new BadRequestException('Only reviewing skills can be published');
    }

    skill.status = 'published';
    await this.skillRepository.save(skill);

    return this.findOne(id, tenantId);
  }

  async archive(id: number, userId: number, tenantId: number = 1) {
    const skill = await this.findOne(id, tenantId);

    if (skill.status !== 'published') {
      throw new BadRequestException('Only published skills can be archived');
    }

    skill.status = 'archived';
    await this.skillRepository.save(skill);

    return this.findOne(id, tenantId);
  }

  async getVersions(id: number, tenantId: number = 1) {
    const skill = await this.skillRepository.findOne({ where: { id, tenantId } });
    if (!skill) {
      throw new NotFoundException(`Skill #${id} not found`);
    }

    return this.versionRepository.find({
      where: { skillId: id },
      order: { createdAt: 'DESC' },
    });
  }

  async createVersion(id: number, dto: CreateSkillVersionDto, userId: number, tenantId: number = 1) {
    const skill = await this.findOne(id, tenantId);

    if (skill.ownerId !== userId) {
      throw new BadRequestException('Only owner can create new version');
    }

    // 将之前的版本标记为非最新
    await this.versionRepository.update(
      { skillId: id, isLatest: true },
      { isLatest: false },
    );

    const version = this.versionRepository.create({
      skillId: id,
      ...dto,
      isLatest: true,
    });
    await this.versionRepository.save(version);

    // 更新 skill 的当前版本
    skill.currentVersion = dto.version;
    await this.skillRepository.save(skill);

    return version;
  }

  // === Registry API 方法（供外部 Agent 调用） ===

  async getRegistry(tenantId: number = 1, domain?: string) {
    const where: any = { tenantId, status: 'published' };
    if (domain) where.domain = domain;

    const skills = await this.skillRepository.find({
      where,
      select: [
        'id', 'namespace', 'name', 'domain', 'subDomain', 'abilityName',
        'description', 'scope', 'type', 'executionType', 'currentVersion',
        'toolDefinition',
      ],
      order: { domain: 'ASC', namespace: 'ASC' },
    });

    // 转换为 OpenAI function calling 兼容格式
    return {
      tools: skills.map(skill => this.formatAsOpenAITool(skill)),
      skills: skills.map(skill => ({
        namespace: skill.namespace,
        name: skill.name,
        description: skill.description,
        domain: skill.domain,
        subDomain: skill.subDomain,
        executionType: skill.executionType,
        version: skill.currentVersion,
      })),
    };
  }

  async getRegistryByNamespace(namespace: string, tenantId: number = 1) {
    const skill = await this.skillRepository.findOne({
      where: { namespace, tenantId, status: 'published' },
    });

    if (!skill) {
      throw new NotFoundException(`Skill with namespace "${namespace}" not found`);
    }

    // 获取最新版本信息
    const latestVersion = await this.versionRepository.findOne({
      where: { skillId: skill.id, isLatest: true },
    });

    return {
      skill: {
        namespace: skill.namespace,
        name: skill.name,
        description: skill.description,
        domain: skill.domain,
        subDomain: skill.subDomain,
        abilityName: skill.abilityName,
        type: skill.type,
        scope: skill.scope,
        version: skill.currentVersion,
        executionType: skill.executionType,
        endpoint: skill.endpoint,
        httpMethod: skill.httpMethod,
        requestTemplate: skill.requestTemplate ? JSON.parse(skill.requestTemplate) : null,
        responseMapping: skill.responseMapping ? JSON.parse(skill.responseMapping) : null,
        headers: skill.headers ? JSON.parse(skill.headers) : null,
        errorHandling: skill.errorHandling ? JSON.parse(skill.errorHandling) : null,
        agentPrompt: skill.agentPrompt,
        // 注意：不返回 authConfig，避免泄露认证信息
      },
      tool: this.formatAsOpenAITool(skill),
      version: latestVersion ? {
        version: latestVersion.version,
        input: latestVersion.input,
        output: latestVersion.output,
        dependencies: latestVersion.dependencies,
      } : null,
    };
  }

  private formatAsOpenAITool(skill: any) {
    // 如果已有 toolDefinition，直接解析返回
    if (skill.toolDefinition) {
      try {
        return JSON.parse(skill.toolDefinition);
      } catch {
        // 解析失败，使用默认格式
      }
    }

    // 默认格式：基于 skill 信息生成 OpenAI function calling 格式
    return {
      type: 'function',
      function: {
        name: skill.namespace.replace(/\./g, '_'),
        description: skill.description || skill.name,
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    };
  }
}
