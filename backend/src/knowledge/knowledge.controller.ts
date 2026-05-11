import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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
  async findAll() {
    return this.knowledgeService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取知识库详情' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.knowledgeService.findOne(id);
  }

  @Get(':id/documents')
  @ApiOperation({ summary: '获取知识库文档列表' })
  async listDocuments(@Param('id', ParseIntPipe) id: number) {
    return this.knowledgeService.listDocuments(id);
  }

  @Get(':id/chunks')
  @ApiOperation({ summary: '查看知识库切片内容' })
  async listChunks(
    @Param('id', ParseIntPipe) id: number,
    @Query('documentId') documentId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.knowledgeService.listChunks(id, {
      documentId: documentId ? Number(documentId) : undefined,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(':id/chunks/:chunkId')
  @ApiOperation({ summary: '查看单个知识库切片详情' })
  async getChunk(
    @Param('id', ParseIntPipe) id: number,
    @Param('chunkId', ParseIntPipe) chunkId: number,
  ) {
    return this.knowledgeService.getChunk(id, chunkId);
  }

  @Post()
  @ApiOperation({ summary: '创建知识库' })
  async create(@Body() dto: CreateKnowledgeBaseDto) {
    return this.knowledgeService.create(dto, 1);
  }

  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 50 * 1024 * 1024 },
  }))
  @ApiOperation({ summary: '上传离线文档并构建知识库索引' })
  async uploadDocument(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: any,
    @Body() body: { chunkSize?: string; chunkOverlap?: string },
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('请上传文件');
    }

    return this.knowledgeService.uploadDocument(id, file, {
      chunkSize: body.chunkSize ? Number(body.chunkSize) : undefined,
      chunkOverlap: body.chunkOverlap ? Number(body.chunkOverlap) : undefined,
    });
  }

  @Post(':id/text')
  @ApiOperation({ summary: '写入纯文本并构建知识库索引' })
  async ingestText(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; content: string; chunkSize?: number; chunkOverlap?: number },
  ) {
    if (!body.content?.trim()) {
      throw new BadRequestException('请输入文本内容');
    }

    return this.knowledgeService.ingestText(id, {
      name: body.name || '文本知识.txt',
      content: body.content,
      chunkSize: body.chunkSize,
      chunkOverlap: body.chunkOverlap,
    });
  }

  @Post(':id/search')
  @ApiOperation({ summary: '检索知识库切片' })
  async search(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { query: string; topK?: number },
  ) {
    if (!body.query?.trim()) {
      throw new BadRequestException('请输入检索问题');
    }

    return this.knowledgeService.search(id, body.query, body.topK || 5);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新知识库' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateKnowledgeBaseDto,
  ) {
    return this.knowledgeService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除知识库' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.knowledgeService.remove(id);
  }

  @Post('sync')
  @ApiOperation({ summary: '同步百炼知识库' })
  async sync(@Body() body: { apiKey: string; kbId: string }) {
    return this.knowledgeService.sync(body.apiKey, body.kbId);
  }
}
