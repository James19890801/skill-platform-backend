import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ProcessArchitecturesService } from './process-architectures.service';
import {
  CreateProcessArchitectureNodeDto,
  CreateProcessArchitectureTreeDto,
  UpdateProcessArchitectureNodeDto,
  UpdateProcessArchitectureTreeDto,
} from './dto';

@ApiTags('流程架构')
@Controller('api/process-architectures')
export class ProcessArchitecturesController {
  constructor(private readonly processArchitecturesService: ProcessArchitecturesService) {}

  @Get()
  @ApiOperation({ summary: '获取流程架构列表' })
  findAll() {
    return this.processArchitecturesService.findAll();
  }

  @Get('active')
  @ApiOperation({ summary: '获取当前本地流程架构' })
  findActive() {
    return this.processArchitecturesService.findActive();
  }

  @Get('coverage')
  @ApiOperation({ summary: '按流程架构查看 Agent 与 Skill 覆盖' })
  @ApiQuery({ name: 'treeId', required: false })
  @ApiQuery({ name: 'nodeId', required: false })
  getCoverage(@Query('treeId') treeId?: string, @Query('nodeId') nodeId?: string) {
    return this.processArchitecturesService.getCoverage(
      treeId ? Number(treeId) : undefined,
      nodeId ? Number(nodeId) : null,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: '获取流程架构详情' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.processArchitecturesService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建流程架构' })
  create(@Body() dto: CreateProcessArchitectureTreeDto, @Request() req: any) {
    return this.processArchitecturesService.create(dto, req.user.id);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新流程架构' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProcessArchitectureTreeDto,
    @Request() req: any,
  ) {
    return this.processArchitecturesService.update(id, dto, req.user.id, req.user.isAdmin);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除流程架构' })
  remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.processArchitecturesService.remove(id, req.user.id, req.user.isAdmin);
  }

  @Post(':treeId/nodes')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '新增流程架构节点' })
  createNode(
    @Param('treeId', ParseIntPipe) treeId: number,
    @Body() dto: CreateProcessArchitectureNodeDto,
    @Request() req: any,
  ) {
    return this.processArchitecturesService.createNode(treeId, dto, req.user.id, req.user.isAdmin);
  }

  @Put(':treeId/nodes/:nodeId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新流程架构节点' })
  updateNode(
    @Param('treeId', ParseIntPipe) treeId: number,
    @Param('nodeId', ParseIntPipe) nodeId: number,
    @Body() dto: UpdateProcessArchitectureNodeDto,
    @Request() req: any,
  ) {
    return this.processArchitecturesService.updateNode(treeId, nodeId, dto, req.user.id, req.user.isAdmin);
  }

  @Delete(':treeId/nodes/:nodeId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除流程架构节点及其子节点' })
  removeNode(
    @Param('treeId', ParseIntPipe) treeId: number,
    @Param('nodeId', ParseIntPipe) nodeId: number,
    @Request() req: any,
  ) {
    return this.processArchitecturesService.removeNode(treeId, nodeId, req.user.id, req.user.isAdmin);
  }
}
