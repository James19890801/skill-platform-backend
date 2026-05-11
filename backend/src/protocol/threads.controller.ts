import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ProtocolService } from './protocol.service';

@ApiTags('Agent Protocol / Threads')
@Controller('api/threads')
export class ThreadsController {
  constructor(private readonly protocolService: ProtocolService) {}

  @Get()
  @ApiOperation({ summary: '列出 Thread' })
  listThreads() {
    return this.protocolService.listThreads();
  }

  @Post()
  @ApiOperation({ summary: '创建 Thread' })
  createThread(@Body() body: { id?: string; agent_id?: number; agentId?: number; title?: string; metadata?: Record<string, unknown> }) {
    return this.protocolService.ensureThread({
      id: body.id,
      agentId: body.agentId ?? body.agent_id,
      title: body.title,
      metadata: body.metadata,
    });
  }

  @Get(':threadId')
  @ApiOperation({ summary: '获取 Thread' })
  getThread(@Param('threadId') threadId: string) {
    return this.protocolService.getThread(threadId);
  }

  @Delete(':threadId')
  @ApiOperation({ summary: '删除 Thread 及其消息和运行记录' })
  deleteThread(@Param('threadId') threadId: string) {
    return this.protocolService.deleteThread(threadId);
  }

  @Get(':threadId/messages')
  @ApiOperation({ summary: '获取 Thread 消息历史' })
  listMessages(@Param('threadId') threadId: string) {
    return this.protocolService.listMessages(threadId);
  }
}
