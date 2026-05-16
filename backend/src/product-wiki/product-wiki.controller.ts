import { Body, Controller, Get, Post, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { ProductWikiService } from './product-wiki.service';

@ApiTags('Product Wiki')
@Controller('api/product-wiki')
export class ProductWikiController {
  constructor(private readonly productWikiService: ProductWikiService) {}

  @Get()
  @ApiOperation({ summary: '获取产品 Wiki 索引概览' })
  async overview() {
    return this.productWikiService.getOverview();
  }

  @Post('refresh')
  @ApiOperation({ summary: '强制刷新产品 Wiki 索引' })
  async refresh() {
    await this.productWikiService.getIndex(true);
    return this.productWikiService.getOverview();
  }

  @Post('search')
  @ApiOperation({ summary: '搜索产品 Wiki 材料' })
  async search(@Body() body: { query: string; topK?: number; maxDocuments?: number }) {
    return this.productWikiService.search(body.query || '', {
      topK: body.topK,
      maxDocuments: body.maxDocuments,
    });
  }

  @Post('ask')
  @ApiOperation({ summary: '基于产品 Wiki 问答（非流式）' })
  async ask(@Body() body: { question: string; model?: string; topK?: number; maxDocuments?: number }) {
    return this.productWikiService.ask(body.question || '', {
      model: body.model,
      topK: body.topK,
      maxDocuments: body.maxDocuments,
    });
  }

  @Post('ask/stream')
  @ApiOperation({ summary: '基于产品 Wiki 问答（SSE 流式）' })
  async askStream(
    @Body() body: { question: string; model?: string; topK?: number; maxDocuments?: number },
    @Res() res: Response,
  ) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    let streamClosed = false;
    const writeEvent = (event: Record<string, unknown>) => {
      if (streamClosed || res.destroyed) return;
      res.write(`data: ${JSON.stringify(event)}\n\n`);
    };
    const heartbeatTimer = setInterval(() => {
      writeEvent({ type: 'heartbeat', timestamp: new Date().toISOString() });
    }, 15_000);
    if (typeof heartbeatTimer.unref === 'function') heartbeatTimer.unref();
    res.on('close', () => {
      streamClosed = true;
      clearInterval(heartbeatTimer);
    });

    try {
      const answer = await this.productWikiService.streamAsk(body.question || '', writeEvent, {
        model: body.model,
        topK: body.topK,
        maxDocuments: body.maxDocuments,
      });
      if (!answer.trim()) {
        writeEvent({ type: 'error', content: '产品 Wiki 暂未返回有效回答' });
      }
    } catch (err) {
      writeEvent({
        type: 'error',
        content: err instanceof Error ? err.message : '产品 Wiki 问答失败',
      });
    } finally {
      writeEvent({ type: 'done' });
      clearInterval(heartbeatTimer);
      if (!streamClosed) res.end();
    }
  }
}
