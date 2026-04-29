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
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProcessService } from './process.service';

@ApiTags('流程管理')
@Controller('api/processes')
export class ProcessController {
  constructor(private readonly processService: ProcessService) {}

  @Get()
  @ApiOperation({ summary: '获取流程列表' })
  @ApiQuery({ name: 'domain', required: false, type: String })
  @ApiQuery({ name: 'archNodeId', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, type: String })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  async findAll(
    @Query('domain') domain?: string,
    @Query('archNodeId') archNodeId?: string,
    @Query('status') status?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.processService.findAll(
      {
        domain,
        archNodeId: archNodeId ? parseInt(archNodeId) : undefined,
        status,
      },
      tenantId ? parseInt(tenantId, 10) : 1,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: '获取流程详情（含 documents）' })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Query('tenantId') tenantId?: string) {
    return this.processService.findOne(id, tenantId ? parseInt(tenantId, 10) : 1);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建流程' })
  async create(
    @Body()
    data: {
      name: string;
      description?: string;
      archNodeId?: number;
      domain?: string;
      status?: string;
    },
    @Request() req: any,
  ) {
    return this.processService.create(data, req.user.tenantId || 1);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新流程' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    data: {
      name?: string;
      description?: string;
      archNodeId?: number;
      domain?: string;
      status?: string;
      nodeCount?: number;
      sopCount?: number;
    },
    @Request() req: any,
  ) {
    return this.processService.update(id, data, req.user.tenantId || 1);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除流程' })
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.processService.remove(id, req.user.tenantId || 1);
  }

  @Post(':id/documents')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '添加文档' })
  async addDocument(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    data: {
      name: string;
      type?: string;
      content?: string;
      fileUrl?: string;
    },
    @Request() req: any,
  ) {
    return this.processService.addDocument(id, data, req.user.tenantId || 1);
  }

  @Delete(':id/documents/:docId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除文档' })
  async removeDocument(
    @Param('id', ParseIntPipe) id: number,
    @Param('docId', ParseIntPipe) docId: number,
    @Request() req: any,
  ) {
    return this.processService.removeDocument(id, docId, req.user.tenantId || 1);
  }
}
