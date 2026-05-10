import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like } from 'typeorm';
import { Skill, SkillVersion, SkillReview } from '../entities';
import {
  CreateSkillDto,
  UpdateSkillDto,
  CreateSkillVersionDto,
  SkillQueryDto,
  SubmitReviewDto,
} from './dto';
import {
  buildSkillPackage,
  buildSkillPackageZip,
  parseSkillPackageZip,
} from '../skill-runtime/skill-package';

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

  async findAll(query: SkillQueryDto) {
    const { domain, status, scope, page = 1, limit = 10, search } = query;

    const where: any = {};
    if (domain) where.domain = domain;
    if (status) where.status = status;
    if (scope) where.scope = scope;
    if (search) {
      where.name = Like(`%${search.replace(/[%_]/g, '\\$&')}%`);
    }

    const [items, total] = await this.skillRepository.findAndCount({
      where,
      relations: ['owner'],
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

  async findOne(id: number) {
    const skill = await this.skillRepository.findOne({
      where: { id },
      relations: ['owner', 'versions'],
    });

    if (!skill) {
      throw new NotFoundException(`Skill #${id} not found`);
    }

    const reviews = await this.reviewRepository.find({
      where: { skillId: id },
      relations: ['submitter', 'reviewer'],
      order: { createdAt: 'DESC' },
    });

    return { ...skill, reviews };
  }

  async create(createDto: CreateSkillDto, userId: number) {
    const existing = await this.skillRepository.findOne({
      where: { namespace: createDto.namespace },
    });
    if (existing) {
      throw new BadRequestException(`Namespace ${createDto.namespace} already exists`);
    }

    const skill = this.skillRepository.create({
      ...createDto,
      ownerId: userId,
      status: 'draft',
      currentVersion: '1.0.0',
    });

    const savedSkill = await this.skillRepository.save(skill);
    await this.refreshPackageHash(savedSkill.id);

    const version = this.versionRepository.create({
      skillId: savedSkill.id,
      version: '1.0.0',
      description: createDto.description,
      changelog: '初始版本',
      isLatest: true,
    });
    await this.versionRepository.save(version);

    return this.findOne(savedSkill.id);
  }

  async createFromPackageZip(
    buffer: Buffer,
    userId: number,
    overrides: Partial<CreateSkillDto> = {},
  ) {
    const draft = await parseSkillPackageZip(buffer, {
      namespace: overrides.namespace,
      name: overrides.name,
    });

    return this.create({
      namespace: overrides.namespace || draft.namespace,
      name: overrides.name || draft.name,
      domain: overrides.domain || draft.domain,
      subDomain: overrides.subDomain || draft.subDomain,
      abilityName: overrides.abilityName || draft.abilityName,
      description: overrides.description || draft.description,
      scope: overrides.scope || 'personal',
      type: overrides.type || 'pure-business',
      content: draft.content,
      files: JSON.stringify(draft.files),
      manifest: draft.manifest,
      runtimePolicy: draft.runtimePolicy,
      triggerRules: draft.triggerRules,
    }, userId);
  }

  async update(id: number, updateDto: UpdateSkillDto, userId: number) {
    const skill = await this.findOne(id);

    // 非管理员只能编辑自己的 Skill
    if (skill.ownerId !== userId) {
      throw new ForbiddenException('只能编辑自己的 Skill');
    }

    Object.assign(skill, updateDto);
    await this.skillRepository.save(skill);
    await this.refreshPackageHash(id);

    return this.findOne(id);
  }

  async remove(id: number, userId: number, isAdmin: boolean) {
    const skill = await this.findOne(id);

    // 非管理员只能删除自己的
    if (!isAdmin && skill.ownerId !== userId) {
      throw new ForbiddenException('只能删除自己的 Skill');
    }

    await this.versionRepository.delete({ skillId: id });
    await this.reviewRepository.delete({ skillId: id });
    await this.skillRepository.delete(id);

    return { success: true };
  }

  async submitForReview(id: number, dto: SubmitReviewDto, userId: number) {
    const skill = await this.findOne(id);

    if (skill.status !== 'draft' && skill.status !== 'rejected') {
      throw new BadRequestException('Only draft or rejected skills can be submitted for review');
    }

    const review = this.reviewRepository.create({
      skillId: id,
      submitterId: userId,
      targetScope: dto.targetScope,
      comment: dto.comment,
      status: 'pending',
    });
    await this.reviewRepository.save(review);

    skill.status = 'reviewing';
    await this.skillRepository.save(skill);

    return this.findOne(id);
  }

  async publish(id: number, userId: number) {
    const skill = await this.findOne(id);

    if (skill.status !== 'reviewing') {
      throw new BadRequestException('Only reviewing skills can be published');
    }

    try {
      const pkg = buildSkillPackage(skill as any);
      skill.packageHash = pkg.packageHash;
    } catch (err) {
      throw new BadRequestException(err instanceof Error ? err.message : 'SkillPackage 校验失败');
    }

    skill.status = 'published';
    await this.skillRepository.save(skill);

    return this.findOne(id);
  }

  async archive(id: number, userId: number) {
    const skill = await this.findOne(id);

    if (skill.status !== 'published') {
      throw new BadRequestException('Only published skills can be archived');
    }

    skill.status = 'archived';
    await this.skillRepository.save(skill);

    return this.findOne(id);
  }

  async getVersions(id: number) {
    const skill = await this.skillRepository.findOne({ where: { id } });
    if (!skill) {
      throw new NotFoundException(`Skill #${id} not found`);
    }

    return this.versionRepository.find({
      where: { skillId: id },
      order: { createdAt: 'DESC' },
    });
  }

  async getPackageZip(id: number): Promise<{ filename: string; buffer: Buffer }> {
    const skill = await this.findOne(id);
    const pkg = buildSkillPackage(skill as any);
    const filename = `${pkg.namespace}-${pkg.version}.zip`.replace(/[^a-zA-Z0-9._-]/g, '_');

    return {
      filename,
      buffer: await buildSkillPackageZip(pkg),
    };
  }

  async createVersion(id: number, dto: CreateSkillVersionDto, userId: number) {
    const skill = await this.findOne(id);

    if (skill.ownerId !== userId) {
      throw new BadRequestException('Only owner can create new version');
    }

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

    skill.currentVersion = dto.version;
    await this.skillRepository.save(skill);

    return version;
  }

  // === Registry API 方法（公开） ===

  async getRegistry(domain?: string) {
    const where: any = { status: 'published' };
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

  async getRegistryByNamespace(namespace: string) {
    const skill = await this.skillRepository.findOne({
      where: { namespace, status: 'published' },
    });

    if (!skill) {
      throw new NotFoundException(`Skill with namespace "${namespace}" not found`);
    }

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
    if (skill.toolDefinition) {
      try {
        return JSON.parse(skill.toolDefinition);
      } catch {
        // fallback
      }
    }

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

  private async refreshPackageHash(skillId: number): Promise<void> {
    const skill = await this.skillRepository.findOne({ where: { id: skillId } });
    if (!skill) return;

    try {
      const pkg = buildSkillPackage(skill as any);
      skill.packageHash = pkg.packageHash;
      await this.skillRepository.save(skill);
    } catch {
      // Draft skills may be incomplete. Package validation happens again at publish/execute time.
    }
  }
}
