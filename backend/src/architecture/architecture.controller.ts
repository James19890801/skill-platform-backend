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
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { ArchitectureService } from './architecture.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('业务架构')
@Controller('api/architecture')
export class ArchitectureController {
  constructor(private readonly architectureService: ArchitectureService) {}

  // ==================== 原有的技能架构API ====================
  @Get()
  @ApiOperation({ summary: '获取技能架构' })
  async getSkillArchitecture() {
    return this.architectureService.getSkillArchitecture();
  }

  @Get('domains')
  @ApiOperation({ summary: '获取领域列表' })
  async getDomains() {
    return this.architectureService.getDomains();
  }

  // ==================== 架构树管理 ====================
  @Get('trees')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '获取所有架构树版本列表' })
  async findAllTrees(@Req() req: Request) {
    const tenantId = (req.user as any)?.tenantId || 1;
    return this.architectureService.findAllTrees(tenantId);
  }

  @Get('trees/active')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '获取当前激活的架构树（含完整节点树）' })
  async findActiveTree(@Req() req: Request) {
    const tenantId = (req.user as any)?.tenantId || 1;
    return this.architectureService.findActiveTree(tenantId);
  }

  @Post('trees')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '创建新架构树' })
  async createTree(
    @Req() req: Request,
    @Body() data: { name: string; version?: string; versionLabel?: string },
  ) {
    const tenantId = (req.user as any)?.tenantId || 1;
    return this.architectureService.createTree(data, tenantId);
  }

  @Put('trees/:id')
  @ApiOperation({ summary: '更新架构树信息' })
  async updateTree(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { name?: string; version?: string; versionLabel?: string },
  ) {
    return this.architectureService.updateTree(id, data);
  }

  @Post('trees/:id/version')
  @ApiOperation({ summary: '保存为新版本（复制当前树结构）' })
  async saveAsNewVersion(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: { versionLabel?: string },
  ) {
    return this.architectureService.saveAsNewVersion(id, data.versionLabel);
  }

  @Put('trees/:id/activate')
  @ApiOperation({ summary: '切换激活版本' })
  async activateTree(@Param('id', ParseIntPipe) id: number) {
    return this.architectureService.activateTree(id);
  }

  // ==================== 节点管理 ====================
  @Get('nodes')
  @ApiOperation({ summary: '获取某棵树的所有节点' })
  @ApiQuery({ name: 'treeId', required: true, type: Number })
  async findNodes(@Query('treeId', ParseIntPipe) treeId: number) {
    return this.architectureService.findNodesByTree(treeId);
  }

  @Get('nodes/tree')
  @ApiOperation({ summary: '获取树形结构（递归构建 children）' })
  @ApiQuery({ name: 'treeId', required: true, type: Number })
  async findNodesTree(@Query('treeId', ParseIntPipe) treeId: number) {
    return this.architectureService.findNodesTree(treeId);
  }

  @Get('nodes/leaves')
  @ApiOperation({ summary: '获取所有末级节点' })
  @ApiQuery({ name: 'treeId', required: false, type: Number })
  async findLeafNodes(@Query('treeId') treeId?: string) {
    return this.architectureService.findLeafNodes(treeId ? parseInt(treeId) : undefined);
  }

  @Get('nodes/:id')
  @ApiOperation({ summary: '节点详情（含 files）' })
  async findNode(@Param('id', ParseIntPipe) id: number) {
    return this.architectureService.findNodeById(id);
  }

  @Post('nodes')
  @ApiOperation({ summary: '创建节点' })
  async createNode(
    @Body()
    data: {
      name: string;
      level: number;
      parentId?: number;
      treeId: number;
      description?: string;
      sortOrder?: number;
    },
  ) {
    return this.architectureService.createNode(data);
  }

  @Put('nodes/:id')
  @ApiOperation({ summary: '更新节点' })
  async updateNode(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    data: {
      name?: string;
      description?: string;
      sortOrder?: number;
      totalSkills?: number;
      coveredSkills?: number;
    },
  ) {
    return this.architectureService.updateNode(id, data);
  }

  @Delete('nodes/:id')
  @ApiOperation({ summary: '删除节点（含子节点级联删除）' })
  async deleteNode(@Param('id', ParseIntPipe) id: number) {
    return this.architectureService.deleteNode(id);
  }

  @Get('nodes/:id/path')
  @ApiOperation({ summary: '获取节点路径（从根到当前节点）' })
  async getNodePath(@Param('id', ParseIntPipe) id: number) {
    return this.architectureService.getNodePath(id);
  }

  // ==================== 文件管理 ====================
  @Post('files')
  @ApiOperation({ summary: '给节点添加文件' })
  async createFile(
    @Body()
    data: {
      name: string;
      type?: string;
      content?: string;
      fileUrl?: string;
      nodeId: number;
    },
  ) {
    return this.architectureService.createFile(data);
  }

  @Delete('files/:id')
  @ApiOperation({ summary: '删除文件' })
  async deleteFile(@Param('id', ParseIntPipe) id: number) {
    return this.architectureService.deleteFile(id);
  }
}
