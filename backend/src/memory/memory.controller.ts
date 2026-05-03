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
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { MemoryService } from './memory.service';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';

@ApiTags('记忆管理')
@Controller('api/memories')
export class MemoryController {
  constructor(private readonly memoryService: MemoryService) {}

  @Get()
  @ApiOperation({ summary: '获取记忆列表' })
  @ApiQuery({ name: 'agentId', required: false, description: '按Agent筛选' })
  async findAll(
    @Query('agentId') agentId?: string,
  ) {
    return this.memoryService.findAll(
      agentId ? Number(agentId) : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: '获取记忆详情' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.memoryService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: '创建记忆' })
  async create(@Body() dto: CreateMemoryDto) {
    return this.memoryService.create(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新记忆' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMemoryDto,
  ) {
    return this.memoryService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除记忆' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.memoryService.remove(id);
  }
}
