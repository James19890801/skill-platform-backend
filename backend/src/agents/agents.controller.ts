import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { AgentsService } from './agents.service';
import { CreateAgentDto, UpdateAgentDto } from './dto';

@ApiTags('Agent 管理')
@Controller('api/agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @Get()
  @ApiOperation({ summary: '获取 Agent 列表' })
  async findAll(@Query('tenantId') tenantId?: string) {
    return this.agentsService.findAll(Number(tenantId) || 1);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取 Agent 详情' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.agentsService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: '创建 Agent' })
  async create(@Body() dto: CreateAgentDto) {
    return this.agentsService.create(dto, 1, 1);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新 Agent' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAgentDto,
  ) {
    return this.agentsService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除 Agent' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.agentsService.remove(id);
  }
}
