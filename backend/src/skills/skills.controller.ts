import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
  ApiHeader,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../common/guards/api-key.guard';
import { RolesGuard, Roles } from '../common';
import { SkillsService } from './skills.service';
import {
  CreateSkillDto,
  UpdateSkillDto,
  CreateSkillVersionDto,
  SkillQueryDto,
  SubmitReviewDto,
} from './dto';

@ApiTags('技能管理')
@Controller('api/skills')
export class SkillsController {
  constructor(private readonly skillsService: SkillsService) {}

  // === Registry API（供外部 Agent 调用，使用 API Key 认证） ===

  @Get('registry')
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: '获取可用 Skill 列表（供外部 Agent 调用）' })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key 认证', required: true })
  @ApiQuery({ name: 'domain', required: false, description: '按领域筛选' })
  async getRegistry(@Request() req: any, @Query('domain') domain?: string) {
    return this.skillsService.getRegistry(req.tenantId || 1, domain);
  }

  @Get('registry/:namespace')
  @UseGuards(ApiKeyGuard)
  @ApiOperation({ summary: '获取单个 Skill 的完整执行定义（供外部 Agent 调用）' })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key 认证', required: true })
  async getRegistryByNamespace(@Param('namespace') namespace: string, @Request() req: any) {
    return this.skillsService.getRegistryByNamespace(namespace, req.tenantId || 1);
  }

  // === 常规 API ===

  @Get()
  @ApiOperation({ summary: '获取技能列表' })
  @ApiQuery({ name: 'domain', required: false, description: '领域筛选' })
  @ApiQuery({ name: 'status', required: false, description: '状态筛选' })
  @ApiQuery({ name: 'scope', required: false, description: '范围筛选' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  @ApiQuery({ name: 'search', required: false, description: '搜索关键词' })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  async findAll(@Query() query: SkillQueryDto, @Query('tenantId') tenantId?: string) {
    return this.skillsService.findAll(query, tenantId ? parseInt(tenantId, 10) : 1);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取技能详情' })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Query('tenantId') tenantId?: string) {
    return this.skillsService.findOne(id, tenantId ? parseInt(tenantId, 10) : 1);
  }

  @Post()
  @ApiOperation({ summary: '创建技能' })
  async create(@Body() createDto: CreateSkillDto) {
    return this.skillsService.create(createDto, 1, 1);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新技能' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateSkillDto,
  ) {
    return this.skillsService.update(id, updateDto, 1, 1, 'admin');
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除技能' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.skillsService.remove(id, 1, 1);
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('member')
  @ApiBearerAuth()
  @ApiOperation({ summary: '提交审核' })
  async submitForReview(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitReviewDto,
    @Request() req: any,
  ) {
    return this.skillsService.submitForReview(id, dto, req.user.id, req.user.tenantId || 1);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: '发布技能（需要 manager 权限）' })
  async publish(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.skillsService.publish(id, req.user.id, req.user.tenantId || 1);
  }

  @Post(':id/archive')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: '归档技能（需要 manager 权限）' })
  async archive(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.skillsService.archive(id, req.user.id, req.user.tenantId || 1);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: '获取版本列表' })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  async getVersions(@Param('id', ParseIntPipe) id: number, @Query('tenantId') tenantId?: string) {
    return this.skillsService.getVersions(id, tenantId ? parseInt(tenantId, 10) : 1);
  }

  @Post(':id/versions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('member')
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建新版本' })
  async createVersion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateSkillVersionDto,
    @Request() req: any,
  ) {
    return this.skillsService.createVersion(id, dto, req.user.id, req.user.tenantId || 1);
  }
}
