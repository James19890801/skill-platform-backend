import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CreateMemoryDto } from '../memory/dto/create-memory.dto';
import { UpdatePersonalContextDto } from './dto/update-personal-context.dto';
import { PersonalContextService } from './personal-context.service';

@ApiTags('个人上下文')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('api/me/context')
export class PersonalContextController {
  constructor(private readonly personalContextService: PersonalContextService) {}

  @Get()
  @ApiOperation({ summary: '获取当前用户的个人知识库、MCP 和记忆设置' })
  getContext(@Request() req: any) {
    return this.personalContextService.getDashboard(req.user.id);
  }

  @Put()
  @ApiOperation({ summary: '更新当前用户的个人上下文设置' })
  updateContext(@Request() req: any, @Body() dto: UpdatePersonalContextDto) {
    return this.personalContextService.update(req.user.id, dto);
  }

  @Post('memories')
  @ApiOperation({ summary: '新增个人记忆' })
  createMemory(@Request() req: any, @Body() dto: CreateMemoryDto) {
    return this.personalContextService.createMemory(req.user.id, dto);
  }

  @Delete('memories/:id')
  @ApiOperation({ summary: '删除个人记忆' })
  deleteMemory(@Request() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.personalContextService.deleteMemory(req.user.id, id);
  }
}
