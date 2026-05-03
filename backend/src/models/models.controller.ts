import { Controller, Get, Post, Put, Delete, Param, Body, Query, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth.guard';
import { ModelsService } from './models.service';

@ApiTags('岗位模型')
@Controller('api/models')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

  @Get()
  @ApiOperation({ summary: '获取岗位模型列表' })
  async findAll() {
    return this.modelsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: '获取岗位模型详情' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.modelsService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '创建岗位模型' })
  async create(@Body() body: { name: string; description?: string }) {
    return this.modelsService.create(body);
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '更新岗位模型' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { name?: string; description?: string },
  ) {
    return this.modelsService.update(id, body);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '删除岗位模型' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.modelsService.remove(id);
  }

  @Post(':id/skills')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '绑定技能到岗位模型' })
  async bindSkills(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { skillIds: number[] },
  ) {
    return this.modelsService.bindSkills(id, body.skillIds);
  }

  @Delete(':id/skills/:skillId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '从岗位模型解绑技能' })
  async unbindSkill(
    @Param('id', ParseIntPipe) id: number,
    @Param('skillId', ParseIntPipe) skillId: number,
  ) {
    return this.modelsService.unbindSkill(id, skillId);
  }
}
