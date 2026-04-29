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
import { AgentsService } from './agents.service';
import { CreateAgentDto, UpdateAgentDto } from './dto';

@ApiTags('Agent 管理')
@Controller('api/agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  @ApiOperation({ summary: '获取 Agent 列表' })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('member', 'admin', 'super-admin')
  async findAll(@Query('tenantId') tenantId?: string, @Request() req?: any) {
    // 如果是管理员或超级管理员，可以查看所有 Agent，否则只能查看自己的
    if (req?.user?.role === 'admin' || req?.user?.role === 'super-admin') {
      return this.agentsService.findAll(req?.user?.tenantId || 1);
    } else {
      return this.agentsService.findAllByUserId(req?.user?.id, req?.user?.tenantId || 1);
    }
  }

  @Get(':id')
  @ApiOperation({ summary: '获取 Agent 详情' })
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('member', 'admin', 'super-admin')
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req?: any) {
    // 管理员可以查看任何 Agent，普通用户只能查看自己的
    if (req?.user?.role === 'admin' || req?.user?.role === 'super-admin') {
      return this.agentsService.findOne(id, req?.user?.tenantId || 1);
    } else {
      return this.agentsService.findOneForUser(id, req?.user?.id, req?.user?.tenantId || 1);
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('member', 'admin', 'super-admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建 Agent' })
  async create(@Body() dto: CreateAgentDto, @Request() req: any) {
    return this.agentsService.create(dto, req.user.id, req.user.tenantId || 1);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('member', 'admin', 'super-admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新 Agent' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAgentDto,
    @Request() req?: any,
  ) {
    // 管理员可以更新任何 Agent，普通用户只能更新自己的
    if (req?.user?.role === 'admin' || req?.user?.role === 'super-admin') {
      return this.agentsService.update(id, dto, req?.user?.tenantId || 1);
    } else {
      // 验证用户拥有这个 Agent
      await this.agentsService.findOneForUser(id, req?.user?.id, req?.user?.tenantId || 1);
      return this.agentsService.update(id, dto, req?.user?.tenantId || 1);
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('member', 'admin', 'super-admin')
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除 Agent' })
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req?: any) {
    // 管理员可以删除任何 Agent，普通用户只能删除自己的
    if (req?.user?.role === 'admin' || req?.user?.role === 'super-admin') {
      return this.agentsService.remove(id, req?.user?.tenantId || 1);
    } else {
      // 验证用户拥有这个 Agent
      await this.agentsService.findOneForUser(id, req?.user?.id, req?.user?.tenantId || 1);
      return this.agentsService.remove(id, req?.user?.tenantId || 1);
    }
  }
}
