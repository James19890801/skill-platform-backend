import { Body, Controller, HttpStatus, Post, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { LlmService } from '../llm/llm.service';

interface OpenAiChatCompletionBody {
  model?: string;
  messages: Array<{ role: string; content: string | Array<unknown> | null; name?: string }>;
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  tools?: unknown[];
  tool_choice?: unknown;
}

@ApiTags('OpenAI Compatible')
@Controller('v1')
export class OpenAiCompatibleController {
  constructor(private readonly llmService: LlmService) {}

  @Post('chat/completions')
  @ApiOperation({ summary: 'OpenAI 兼容 Chat Completions' })
  async chatCompletions(@Body() body: OpenAiChatCompletionBody, @Res() res: Response) {
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      res.status(HttpStatus.BAD_REQUEST).json({
        error: {
          message: 'messages must be a non-empty array',
          type: 'invalid_request_error',
        },
      });
      return;
    }

    try {
      const binding = await this.llmService.getModelClient(body.model);
      const requestBody: Record<string, unknown> = {
        model: binding.model,
        messages: body.messages,
        temperature: body.temperature ?? 0.7,
        max_tokens: body.max_tokens ?? 4096,
        stream: Boolean(body.stream),
      };

      if (body.tools) requestBody.tools = body.tools;
      if (body.tool_choice) requestBody.tool_choice = body.tool_choice;

      if (body.stream) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        });

        const stream = await binding.client.chat.completions.create(requestBody as any);
        for await (const chunk of stream as any) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }

      const completion = await binding.client.chat.completions.create(requestBody as any);
      res.json(completion);
    } catch (err) {
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: {
          message: err instanceof Error ? err.message : 'chat completion failed',
          type: 'server_error',
        },
      });
    }
  }
}
