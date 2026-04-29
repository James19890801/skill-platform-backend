import { Controller, Get, Post, Put, Delete, Param, Body, Query, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrgsService } from './orgs.service';

@ApiTags('组织管理')
@Controller('api/orgs')
export class OrgsController {
  constructor(private readonly orgsService: OrgsService) {}

  @Get()
  @ApiOperation({ summary: '获取组织列表' })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  async findAll(@Query('tenantId') tenantId?: string) {
    return this.orgsService.findAll(tenantId ? parseInt(tenantId, 10) : 1);
  }

  @Get('tree')
  @ApiOperation({ summary: '获取组织树' })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  async getTree(@Query('tenantId') tenantId?: string) {
    return this.orgsService.getTree(tenantId ? parseInt(tenantId, 10) : 1);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取组织详情' })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Query('tenantId') tenantId?: string) {
    return this.orgsService.findOne(id, tenantId ? parseInt(tenantId, 10) : 1);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建组织' })
  async create(@Body() body: { name: string; parentId?: number; description?: string }, @Request() req: any) {
    return this.orgsService.create(body, req.user.tenantId || 1);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新组织' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; description?: string },
    @Request() req: any,
  ) {
    return this.orgsService.update(id, body, req.user.tenantId || 1);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除组织' })
  async remove(@Param('id', ParseIntPipe) id: number, @Request() req: any) {
    return this.orgsService.remove(id, req.user.tenantId || 1);
  }

  @Get(':id/members')
  @ApiOperation({ summary: '获取组织成员' })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  async getMembers(@Param('id', ParseIntPipe) id: number, @Query('tenantId') tenantId?: string) {
    return this.orgsService.getMembers(id, tenantId ? parseInt(tenantId, 10) : 1);
  }

  @Get(':id/skills')
  @ApiOperation({ summary: '获取组织关联的技能' })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  async getSkills(@Param('id', ParseIntPipe) id: number, @Query('tenantId') tenantId?: string) {
    return this.orgsService.getSkills(id, tenantId ? parseInt(tenantId, 10) : 1);
  }
}
