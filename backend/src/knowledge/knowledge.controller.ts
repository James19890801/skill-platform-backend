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
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common';
import { KnowledgeService } from './knowledge.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';

@ApiTags('Knowledge Base 管理')
@Controller('api/knowledge-bases')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  @ApiOperation({ summary: '获取知识库列表' })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('member', 'admin', 'super-admin')
  async findAll(@Request() req: any, @Query('tenantId') tenantId?: string) {
    // 如果是管理员或超级管理员，可以查看所有知识库，否则只能查看自己的
    if (req.user.role === 'admin' || req.user.role === 'super-admin') {
      return this.knowledgeService.findAll(req.user.tenantId || 1);
    } else {
      return this.knowledgeService.findAllByUserId(req.user.id, req.user.tenantId || 1);
    }
  }

  @Get(':id')
  @ApiOperation({ summary: '获取知识库详情' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('member', 'admin', 'super-admin')
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    // 管理员可以查看任何知识库，普通用户只能查看自己的
    if (req.user.role === 'admin' || req.user.role === 'super-admin') {
      return this.knowledgeService.findOne(id, req.user.tenantId || 1);
    } else {
      return this.knowledgeService.findOneForUser(id, req.user.id, req.user.tenantId || 1);
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('member')
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建知识库' })
  async create(@Body() dto: CreateKnowledgeBaseDto, @Request() req: any) {
    return this.knowledgeService.create(dto, req.user.id, req.user.tenantId || 1);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('member', 'admin', 'super-admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新知识库' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateKnowledgeBaseDto,
    @Request() req: any,
  ) {
    // 管理员可以更新任何知识库，普通用户只能更新自己的
    if (req.user.role === 'admin' || req.user.role === 'super-admin') {
      return this.knowledgeService.update(id, dto, req.user.tenantId || 1);
    } else {
      // 验证用户拥有这个知识库
      await this.knowledgeService.findOneForUser(id, req.user.id, req.user.tenantId || 1);
      return this.knowledgeService.updateForUser(id, dto, req.user.id, req.user.tenantId || 1);
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('member', 'admin', 'super-admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除知识库' })
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    // 管理员可以删除任何知识库，普通用户只能删除自己的
    if (req.user.role === 'admin' || req.user.role === 'super-admin') {
      return this.knowledgeService.remove(id, req.user.tenantId || 1);
    } else {
      // 验证用户拥有这个知识库
      await this.knowledgeService.findOneForUser(id, req.user.id, req.user.tenantId || 1);
      return this.knowledgeService.removeForUser(id, req.user.id, req.user.tenantId || 1);
    }
  }
}