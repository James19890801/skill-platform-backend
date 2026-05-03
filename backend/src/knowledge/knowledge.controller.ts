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
import { KnowledgeService } from './knowledge.service';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';

@ApiTags('Knowledge Base 管理')
@Controller('api/knowledge-bases')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  @ApiOperation({ summary: '获取知识库列表' })
  async findAll(@Query('tenantId') tenantId?: string) {
    return this.knowledgeService.findAll(Number(tenantId) || 1);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取知识库详情' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.knowledgeService.findOne(id, 1);
  }

  @Post()
  @ApiOperation({ summary: '创建知识库' })
  async create(@Body() dto: CreateKnowledgeBaseDto) {
    return this.knowledgeService.create(dto, 1, 1);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新知识库' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateKnowledgeBaseDto,
  ) {
    return this.knowledgeService.update(id, dto, 1);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除知识库' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.knowledgeService.remove(id, 1);
  }

  @Post('sync')
  @ApiOperation({ summary: '同步百炼知识库' })
  async sync(@Body() body: { apiKey: string; kbId: string }) {
    return this.knowledgeService.sync(body.apiKey, body.kbId);
  }
}
