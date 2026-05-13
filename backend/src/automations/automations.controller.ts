import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AutomationsService } from './automations.service';

@ApiTags('自动化')
@Controller('api/automations')
export class AutomationsController {
  constructor(private readonly automationsService: AutomationsService) {}

  @Get()
  @ApiOperation({ summary: '获取自动化任务和执行记录' })
  findAll() {
    return this.automationsService.findAll();
  }

  @Post(':id/run')
  @ApiOperation({ summary: '手动运行自动化任务，执行配置 Skill/提示词并写入中心化对话' })
  runAutomation(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { trigger?: string; threadId?: string },
  ) {
    return this.automationsService.runAutomation(id, body || {});
  }
}
