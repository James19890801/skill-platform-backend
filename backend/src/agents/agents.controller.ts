import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
import { AgentsService } from './agents.service';
import { CreateAgentDto, UpdateAgentDto } from './dto';

@ApiTags('Agent 管理')
@Controller('api/agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  @ApiOperation({ summary: '获取 Agent 列表（所有人可访问）' })
  async findAll() {
    return this.agentsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取 Agent 详情' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.agentsService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建 Agent（需登录）' })
  async create(@Body() dto: CreateAgentDto, @Request() req: any) {
    return this.agentsService.create(dto, req.user.id);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新 Agent（需登录）' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAgentDto,
    @Request() req: any,
  ) {
    return this.agentsService.update(id, dto, req.user.id, req.user.isAdmin);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除 Agent（仅管理员）' })
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.agentsService.remove(id, req.user.id, req.user.isAdmin);
  }
}
