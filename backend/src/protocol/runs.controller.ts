import { Body, Controller, Get, HttpException, HttpStatus, Param, Post, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AiService } from '../ai/ai.service';
import { ProtocolService } from './protocol.service';

interface RunBody {
  agent_id?: number;
  agentId?: number;
  input?: string;
  message?: string;
  model?: string;
  skills?: string[];
  attachments?: Array<{ name: string; type: string; dataUrl: string }>;
}

@ApiTags('Agent Protocol / Runs')
@Controller()
export class RunsController {
  constructor(
    private readonly protocolService: ProtocolService,
    private readonly aiService: AiService,
  ) {}

  @Post('api/threads/:threadId/runs/stream')
  @ApiOperation({ summary: '在 Thread 中流式执行 Run' })
  async createThreadRunStream(
    @Param('threadId') threadId: string,
    @Body() body: RunBody,
    @Res() res: Response,
  ) {
    return this.streamRun(threadId, body, res);
  }

  @Post('api/runs/stream')
  @ApiOperation({ summary: '无状态流式执行 Run，会自动创建 Thread' })
  async createStatelessRunStream(@Body() body: RunBody & { thread_id?: string }, @Res() res: Response) {
    const threadId = body.thread_id || `thread-${Date.now()}`;
    return this.streamRun(threadId, body, res);
  }

  @Post('api/threads/:threadId/runs')
  @ApiOperation({ summary: '在 Thread 中执行 Run（非流式）' })
  async createThreadRun(@Param('threadId') threadId: string, @Body() body: RunBody) {
    const input = this.getInput(body);
    const agentId = body.agentId ?? body.agent_id;
    const run = await this.protocolService.createRun({ threadId, agentId, input: body });
    await this.protocolService.markRunRunning(run.id);
    await this.protocolService.appendMessage({ threadId, role: 'user', content: input });

    try {
      const output = await this.aiService.chatStream(
        input,
        null,
        body.model,
        agentId,
        body.skills,
        threadId,
        body.attachments,
      );
      await this.protocolService.appendMessage({ threadId, role: 'assistant', content: output });
      await this.protocolService.markRunCompleted(run.id, output, { model: body.model });
      return this.protocolService.getRun(threadId, run.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Run 执行失败';
      await this.protocolService.markRunFailed(run.id, message);
      throw new HttpException({ message }, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('api/threads/:threadId/runs/:runId')
  @ApiOperation({ summary: '查询 Run 状态' })
  getRun(@Param('threadId') threadId: string, @Param('runId') runId: string) {
    return this.protocolService.getRun(threadId, runId);
  }

  @Post('api/threads/:threadId/runs/:runId/cancel')
  @ApiOperation({ summary: '取消 Run（已开始的模型请求会在请求结束后落 cancelled 状态）' })
  cancelRun(@Param('threadId') threadId: string, @Param('runId') runId: string) {
    return this.protocolService.cancelRun(threadId, runId);
  }

  private async streamRun(threadId: string, body: RunBody, res: Response) {
    const input = this.getInput(body);
    const agentId = body.agentId ?? body.agent_id;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Transfer-Encoding': 'chunked',
    });

    try {
      const socket = (res as any).socket;
      if (socket && typeof socket.setNoDelay === 'function') socket.setNoDelay(true);
    } catch { /* ignore */ }

    if (typeof (res as any).flushHeaders === 'function') {
      (res as any).flushHeaders();
    }

    res.write(`data: ${JSON.stringify({ type: 'status', content: '正在准备回答...' })}\n\n`);

    let run: Awaited<ReturnType<ProtocolService['createRun']>> | null = null;
    try {
      run = await this.protocolService.createRun({ threadId, agentId, input: body });
      await this.protocolService.markRunRunning(run.id);
      await this.protocolService.appendMessage({ threadId, role: 'user', content: input });

      const output = await this.aiService.chatStream(
        input,
        (chunk) => {
          if (!chunk) return;
          if (chunk.startsWith('{"type"') && chunk.includes('execution_')) {
            res.write(`data: ${chunk.trim()}\n\n`);
          } else {
            res.write(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`);
          }
        },
        body.model,
        agentId,
        body.skills,
        threadId,
        body.attachments,
      );

      await this.protocolService.appendMessage({ threadId, role: 'assistant', content: output });
      await this.protocolService.markRunCompleted(run.id, output, { model: body.model });
      res.write(`event: done\ndata: ${JSON.stringify({ status: 'completed', run_id: run.id })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Run 执行失败';
      if (run) {
        await this.protocolService.markRunFailed(run.id, message);
      }
      res.write(`event: error\ndata: ${JSON.stringify({ error: message, run_id: run?.id })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  }

  private getInput(body: RunBody): string {
    const input = body.input ?? body.message ?? '';
    if (!input.trim()) {
      throw new HttpException({ message: 'input 不能为空' }, HttpStatus.BAD_REQUEST);
    }
    return input.trim();
  }
}
