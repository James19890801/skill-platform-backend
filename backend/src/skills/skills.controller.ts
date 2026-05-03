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
import { AuthGuard } from '../auth/guards/auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
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

  // === Registry API（公开，无需认证） ===

  @Get('registry')
  @ApiOperation({ summary: '获取可用 Skill 列表（公开）' })
  @ApiQuery({ name: 'domain', required: false, description: '按领域筛选' })
  async getRegistry(@Query('domain') domain?: string) {
    return this.skillsService.getRegistry(domain);
  }

  @Get('registry/:namespace')
  @ApiOperation({ summary: '获取单个 Skill 的完整执行定义' })
  async getRegistryByNamespace(@Param('namespace') namespace: string) {
    return this.skillsService.getRegistryByNamespace(namespace);
  }

  // === 常规 API ===

  @Get()
  @ApiOperation({ summary: '获取技能列表（所有人可访问）' })
  @ApiQuery({ name: 'domain', required: false, description: '领域筛选' })
  @ApiQuery({ name: 'status', required: false, description: '状态筛选' })
  @ApiQuery({ name: 'scope', required: false, description: '范围筛选' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  @ApiQuery({ name: 'search', required: false, description: '搜索关键词' })
  async findAll(@Query() query: SkillQueryDto) {
    return this.skillsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取技能详情' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.skillsService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建技能（需登录）' })
  async create(@Body() createDto: CreateSkillDto, @Request() req: any) {
    return this.skillsService.create(createDto, req.user.id);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新技能（需登录，仅 owner 或管理员）' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: UpdateSkillDto,
    @Request() req: any,
  ) {
    return this.skillsService.update(id, updateDto, req.user.id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除技能（需登录，仅 owner 或管理员）' })
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.skillsService.remove(id, req.user.id, req.user.isAdmin);
  }

  @Post(':id/submit')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '提交审核' })
  async submitForReview(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitReviewDto,
    @Request() req: any,
  ) {
    return this.skillsService.submitForReview(id, dto, req.user.id);
  }

  @Post(':id/publish')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '发布技能（仅管理员）' })
  async publish(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.skillsService.publish(id, req.user.id);
  }

  @Post(':id/archive')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '归档技能（仅管理员）' })
  async archive(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.skillsService.archive(id, req.user.id);
  }

  @Get(':id/versions')
  @ApiOperation({ summary: '获取版本列表' })
  async getVersions(@Param('id', ParseIntPipe) id: number) {
    return this.skillsService.getVersions(id);
  }

  @Post(':id/versions')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建新版本' })
  async createVersion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateSkillVersionDto,
    @Request() req: any,
  ) {
    return this.skillsService.createVersion(id, dto, req.user.id);
  }
}
