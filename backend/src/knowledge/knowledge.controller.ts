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
  PayloadTooLargeException,
  Request,
  UseGuards,
  UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { KnowledgeSearchFilters, KnowledgeService } from './knowledge.service';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { CreateKnowledgeBaseDto } from './dto/create-knowledge-base.dto';
import { UpdateKnowledgeBaseDto } from './dto/update-knowledge-base.dto';
import {
  formatBytes,
  getKnowledgeUploadLimitBytes,
  KNOWLEDGE_SUPPORTED_EXTENSIONS,
} from './upload-policy';

const KNOWLEDGE_UPLOAD_LIMIT_BYTES = getKnowledgeUploadLimitBytes();
const KNOWLEDGE_BATCH_UPLOAD_MAX_FILES = Math.max(1, Math.floor(Number(process.env.KNOWLEDGE_BATCH_UPLOAD_MAX_FILES) || 50));

@ApiTags('Knowledge Base 管理')
@Controller('api/knowledge-bases')
export class KnowledgeController {
  constructor(private readonly knowledgeService: KnowledgeService) {}

  @Get()
  @ApiOperation({ summary: '获取知识库列表' })
  async findAll() {
    return this.knowledgeService.findAll();
  }

  @Get('upload-policy')
  @ApiOperation({ summary: '获取知识库上传限制' })
  async uploadPolicy() {
    return {
      maxFileSize: KNOWLEDGE_UPLOAD_LIMIT_BYTES,
      maxFileSizeLabel: formatBytes(KNOWLEDGE_UPLOAD_LIMIT_BYTES),
      maxBatchFiles: KNOWLEDGE_BATCH_UPLOAD_MAX_FILES,
      supportedExtensions: KNOWLEDGE_SUPPORTED_EXTENSIONS,
    };
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
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: '创建知识库' })
  async create(@Body() dto: CreateKnowledgeBaseDto, @Request() req: any) {
    return this.knowledgeService.create(dto, req.user?.id || 1);
  }

  @Post(':id/documents')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: KNOWLEDGE_UPLOAD_LIMIT_BYTES },
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
    const size = file.size || file.buffer.length;
    if (size > KNOWLEDGE_UPLOAD_LIMIT_BYTES) {
      throw new PayloadTooLargeException(
        `文件大小 ${formatBytes(size)} 超过当前单文件上限 ${formatBytes(KNOWLEDGE_UPLOAD_LIMIT_BYTES)}，请压缩或拆分后重试`,
      );
    }

    return this.knowledgeService.uploadDocument(id, file, {
      chunkSize: body.chunkSize ? Number(body.chunkSize) : undefined,
      chunkOverlap: body.chunkOverlap ? Number(body.chunkOverlap) : undefined,
    });
  }

  @Post(':id/documents/batch')
  @UseInterceptors(FilesInterceptor('files', KNOWLEDGE_BATCH_UPLOAD_MAX_FILES, {
    limits: { fileSize: KNOWLEDGE_UPLOAD_LIMIT_BYTES },
  }))
  @ApiOperation({ summary: '批量上传离线文档并异步构建知识库索引' })
  async uploadDocumentsBatch(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFiles() files: any[],
    @Body() body: { chunkSize?: string; chunkOverlap?: string },
  ) {
    if (!Array.isArray(files) || files.length === 0) {
      throw new BadRequestException('请至少上传一个文件');
    }
    if (files.length > KNOWLEDGE_BATCH_UPLOAD_MAX_FILES) {
      throw new BadRequestException(`单次最多上传 ${KNOWLEDGE_BATCH_UPLOAD_MAX_FILES} 个文件，请分批上传`);
    }
    for (const file of files) {
      const size = file.size || file.buffer?.length || 0;
      if (size > KNOWLEDGE_UPLOAD_LIMIT_BYTES) {
        throw new PayloadTooLargeException(
          `文件 ${file.originalname || '未命名文件'} 大小 ${formatBytes(size)} 超过当前单文件上限 ${formatBytes(KNOWLEDGE_UPLOAD_LIMIT_BYTES)}，请压缩或拆分后重试`,
        );
      }
    }

    return this.knowledgeService.enqueueDocuments(id, files, {
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
    @Body() body: { query: string; topK?: number; filters?: KnowledgeSearchFilters; candidateLimit?: number },
  ) {
    if (!body.query?.trim()) {
      throw new BadRequestException('请输入检索问题');
    }

    return this.knowledgeService.search(id, body.query, body.topK || 5, {
      filters: body.filters,
      candidateLimit: body.candidateLimit,
    });
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
