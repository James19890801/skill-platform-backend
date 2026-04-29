import { Controller, Get, Post, Put, Delete, Param, Body, Query, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ModelsService } from './models.service';

@ApiTags('岗位模型')
@Controller('api/models')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get()
  @ApiOperation({ summary: '获取岗位模型列表' })
  @ApiQuery({ name: 'orgId', required: false, type: Number })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  async findAll(@Query('orgId') orgId?: string, @Query('tenantId') tenantId?: string) {
    return this.modelsService.findAll(
      orgId ? parseInt(orgId, 10) : undefined,
      tenantId ? parseInt(tenantId, 10) : 1,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: '获取岗位模型详情' })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Query('tenantId') tenantId?: string) {
    return this.modelsService.findOne(id, tenantId ? parseInt(tenantId, 10) : 1);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建岗位模型' })
  async create(@Body() body: { name: string; description?: string; orgId?: number }, @Request() req: any) {
    return this.modelsService.create(body, req.user.tenantId || 1);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新岗位模型' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; description?: string; orgId?: number },
    @Request() req: any,
  ) {
    return this.modelsService.update(id, body, req.user.tenantId || 1);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除岗位模型' })
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.modelsService.remove(id, req.user.tenantId || 1);
  }

  @Post(':id/skills')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '绑定技能到岗位模型' })
  async bindSkills(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { skillIds: number[] },
    @Request() req: any,
  ) {
    return this.modelsService.bindSkills(id, body.skillIds, req.user.tenantId || 1);
  }

  @Delete(':id/skills/:skillId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '从岗位模型解绑技能' })
  async unbindSkill(
    @Param('id', ParseIntPipe) id: number,
    @Param('skillId', ParseIntPipe) skillId: number,
    @Request() req: any,
  ) {
    return this.modelsService.unbindSkill(id, skillId, req.user.tenantId || 1);
  }
}
