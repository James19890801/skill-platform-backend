import { Body, Controller, Get, HttpException, HttpStatus, Logger, Param, Post, Request, Res, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { AiService } from '../ai/ai.service';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import { RunEmailNotificationService, SendResult } from '../notifications/run-email-notification.service';
import { ProtocolService } from './protocol.service';
import { RunConcurrencyLimiter, RunQueueRejectedError, RunSlot } from './run-concurrency-limiter';

interface RunBody {
  agent_id?: number;
  agentId?: number;
  input?: string;
  message?: string;
  model?: string;
  skills?: string[];
  attachments?: Array<{ name: string; type: string; dataUrl: string }>;
}

interface RunUser {
  id?: number;
  email?: string | null;
}

@ApiTags('Agent Protocol / Runs')
@Controller()
export class RunsController {
  private readonly logger = new Logger(RunsController.name);

  constructor(
    private readonly protocolService: ProtocolService,
    private readonly aiService: AiService,
    private readonly runLimiter: RunConcurrencyLimiter,
    private readonly runEmailNotifications: RunEmailNotificationService,
  ) {}

  @Post('api/threads/:threadId/runs/stream')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: '在 Thread 中流式执行 Run' })
  async createThreadRunStream(
    @Param('threadId') threadId: string,
    @Body() body: RunBody,
    @Res() res: Response,
    @Request() req: any,
  ) {
    return this.streamRun(threadId, body, res, req.user || null);
  }

  @Post('api/runs/stream')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: '无状态流式执行 Run，会自动创建 Thread' })
  async createStatelessRunStream(
    @Body() body: RunBody & { thread_id?: string },
    @Res() res: Response,
    @Request() req: any,
  ) {
    const threadId = body.thread_id || `thread-${Date.now()}`;
    return this.streamRun(threadId, body, res, req.user || null);
  }

  @Post('api/threads/:threadId/runs')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: '在 Thread 中执行 Run（非流式）' })
  async createThreadRun(@Param('threadId') threadId: string, @Body() body: RunBody, @Request() req: any) {
    const input = this.getInput(body);
    const agentId = body.agentId ?? body.agent_id;
    const user = (req.user || null) as RunUser | null;
    const run = await this.protocolService.createRun({
      threadId,
      agentId,
      input: body,
      userId: user?.id,
      notifyEmail: user?.email || undefined,
    });
    await this.protocolService.appendMessage({ threadId, role: 'user', content: input });

    let slot: RunSlot | null = null;
    try {
      slot = await this.runLimiter.acquire();
      await this.protocolService.markRunRunning(run.id);
      const output = await this.aiService.chatStream(
        input,
        null,
        body.model,
        agentId,
        body.skills,
        threadId,
        body.attachments,
        req.user?.id,
      );
      await this.protocolService.appendMessage({ threadId, role: 'assistant', content: output });
      const failureMessage = this.getSkillFailureMessage(output);
      if (failureMessage) {
        await this.protocolService.markRunFailed(run.id, failureMessage, output);
        await this.notifyRunFailed(threadId, run.id, failureMessage);
        return this.protocolService.getRun(threadId, run.id);
      }
      await this.protocolService.markRunCompleted(run.id, output, { model: body.model });
      await this.notifyRunCompleted(threadId, run.id, output);
      return this.protocolService.getRun(threadId, run.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Run 执行失败';
      await this.protocolService.markRunFailed(run.id, message);
      await this.notifyRunFailed(threadId, run.id, message);
      throw new HttpException(
        { message },
        err instanceof RunQueueRejectedError ? HttpStatus.TOO_MANY_REQUESTS : HttpStatus.INTERNAL_SERVER_ERROR,
      );
    } finally {
      slot?.release();
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

  private async streamRun(threadId: string, body: RunBody, res: Response, user: RunUser | null) {
    const input = this.getInput(body);
    const agentId = body.agentId ?? body.agent_id;
    const notification = this.runEmailNotifications.getDeliveryHint(user);

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

    let streamClosed = false;
    const safeWrite = (payload: string) => {
      if (streamClosed || res.destroyed) return;
      res.write(payload);
    };
    const heartbeatTimer = setInterval(() => {
      safeWrite(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
    }, 15000);
    if (typeof heartbeatTimer.unref === 'function') {
      heartbeatTimer.unref();
    }
    res.on('close', () => {
      streamClosed = true;
      clearInterval(heartbeatTimer);
    });

    safeWrite(`data: ${JSON.stringify({ type: 'status', content: '正在准备回答...' })}\n\n`);

    let run: Awaited<ReturnType<ProtocolService['createRun']>> | null = null;
    let slot: RunSlot | null = null;
    try {
      run = await this.protocolService.createRun({
        threadId,
        agentId,
        input: body,
        userId: user?.id,
        notifyEmail: user?.email || undefined,
      });
      safeWrite(`data: ${JSON.stringify({
        type: 'run_start',
        data: { runId: run.id, threadId, status: run.status, notification },
      })}\n\n`);
      await this.protocolService.appendMessage({ threadId, role: 'user', content: input });
      slot = await this.runLimiter.acquire((snapshot) => {
        safeWrite(`data: ${JSON.stringify({
          type: 'status',
          content: `当前对话较多，正在排队中：运行 ${snapshot.running}，等待 ${snapshot.queued}`,
        })}\n\n`);
      });
      if (slot.queuedMs > 0) {
        safeWrite(`data: ${JSON.stringify({ type: 'status', content: '已进入执行队列，开始生成回答...' })}\n\n`);
      }
      await this.protocolService.markRunRunning(run.id);
      safeWrite(`data: ${JSON.stringify({
        type: 'run_status',
        data: { runId: run.id, threadId, status: 'running', notification },
      })}\n\n`);

      const output = await this.aiService.chatStream(
        input,
        (chunk) => {
          if (!chunk) return;
          const trimmed = chunk.trim();
          if (trimmed.startsWith('{')) {
            try {
              const parsed = JSON.parse(trimmed);
              if (parsed && typeof parsed === 'object' && typeof parsed.type === 'string') {
                safeWrite(`data: ${trimmed}\n\n`);
                return;
              }
            } catch {
              // fall through and stream as text
            }
          }
          safeWrite(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`);
        },
        body.model,
        agentId,
        body.skills,
        threadId,
        body.attachments,
        user?.id,
      );

      await this.protocolService.appendMessage({ threadId, role: 'assistant', content: output });
      const failureMessage = this.getSkillFailureMessage(output);
      if (failureMessage) {
        await this.protocolService.markRunFailed(run.id, failureMessage, output);
        await this.notifyRunFailed(threadId, run.id, failureMessage);
        safeWrite(`event: done\ndata: ${JSON.stringify({ status: 'failed', run_id: run.id })}\n\n`);
        safeWrite('data: [DONE]\n\n');
        if (!streamClosed) res.end();
        return;
      }
      await this.protocolService.markRunCompleted(run.id, output, { model: body.model });
      await this.notifyRunCompleted(threadId, run.id, output);
      safeWrite(`event: done\ndata: ${JSON.stringify({ status: 'completed', run_id: run.id })}\n\n`);
      safeWrite('data: [DONE]\n\n');
      if (!streamClosed) res.end();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Run 执行失败';
      if (run) {
        await this.protocolService.markRunFailed(run.id, message);
        await this.notifyRunFailed(threadId, run.id, message);
      }
      safeWrite(`event: error\ndata: ${JSON.stringify({ type: 'error', content: message, error: message, run_id: run?.id })}\n\n`);
      safeWrite('data: [DONE]\n\n');
      if (!streamClosed) res.end();
    } finally {
      slot?.release();
      clearInterval(heartbeatTimer);
    }
  }

  private getInput(body: RunBody): string {
    const input = body.input ?? body.message ?? '';
    if (!input.trim()) {
      throw new HttpException({ message: 'input 不能为空' }, HttpStatus.BAD_REQUEST);
    }
    return input.trim();
  }

  private async notifyRunCompleted(threadId: string, runId: string, output: string) {
    try {
      const run = await this.protocolService.getRunForNotification(threadId, runId);
      const result = await this.runEmailNotifications.notifyRunCompleted(run, output);
      await this.protocolService.markRunNotification(runId, this.toNotificationRecord(result));
      if (result.sent) {
        this.logger.log(`Run completion email sent for ${runId}`);
      }
    } catch (err) {
      this.logger.warn(`Run 完成邮件通知处理失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async notifyRunFailed(threadId: string, runId: string, error: string) {
    try {
      const run = await this.protocolService.getRunForNotification(threadId, runId);
      const result = await this.runEmailNotifications.notifyRunFailed(run, error);
      await this.protocolService.markRunNotification(runId, this.toNotificationRecord(result));
      if (result.sent) {
        this.logger.log(`Run failure email sent for ${runId}`);
      }
    } catch (err) {
      this.logger.warn(`Run 失败邮件通知处理失败: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private getSkillFailureMessage(output: string): string | null {
    const text = String(output || '').trim();
    if (!text) return null;
    const failurePatterns = [
      /Skill\s*执行失败[:：]?([\s\S]*)/i,
      /Skill\s*执行失败，没有生成可用结果。?\s*原因[:：]?\s*([\s\S]*)/i,
      /执行异常[:：]\s*([\s\S]*)/i,
      /公众号 HTML 产物质量未达标[:：]?\s*([\s\S]*)/i,
    ];
    for (const pattern of failurePatterns) {
      const match = text.match(pattern);
      if (match) {
        return (match[1] || match[0]).trim().slice(0, 2000);
      }
    }
    return null;
  }

  private toNotificationRecord(result: SendResult): { status: string; reason?: string } {
    if (result.sent) return { status: 'sent' };
    const failedReasons = new Set(['send_failed', 'smtp_unconfigured']);
    return {
      status: failedReasons.has(result.reason || '') ? 'failed' : 'skipped',
      reason: result.reason,
    };
  }
}
