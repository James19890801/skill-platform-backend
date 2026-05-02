import { Controller, Post, Get, Delete, Body, Param, Res, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Response } from 'express';
import { AiService, PlanSkillsInput, PlannedSkill, ProcessFileInfo } from './ai.service';

class AttachmentDto {
  @IsString() name: string;
  @IsString() type: string;
  @IsString() dataUrl: string;
}

class ChatDto {
  @IsString() thread_id: string;
  @IsString() message: string;
  @IsOptional() @IsString() model?: string;
  @IsOptional() @IsNumber() agentId?: number;
  @IsOptional() @IsArray() skills?: string[];
  @IsOptional() @IsBoolean() stream?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AttachmentDto) attachments?: AttachmentDto[];
}

class ExportDto {
  @IsString() content: string;
  @IsString() @IsOptional() format?: 'docx' | 'xlsx';
  @IsString() @IsOptional() filename?: string;
}

@ApiTags('AI')
@Controller('api/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('plan-skills')
  async planSkills(@Body() body: PlanSkillsInput): Promise<PlanSkillsResponse> {
    try {
      const skills = await this.aiService.planSkills(body);
      return { success: true, data: skills, message: `成功规划 ${skills.length} 个 Skill` };
    } catch (error) {
      throw new HttpException(
        { success: false, data: [], message: error instanceof Error ? error.message : 'AI 服务调用失败' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  healthCheck() {
    return { status: 'ok', service: 'ai', timestamp: Date.now(), aiConnected: this.aiService.isConnected() };
  }

  @Post('chat')
  async chat(@Body() body: ChatDto, @Res() res: Response) {
    try {
      if (body.stream !== false) {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          'Transfer-Encoding': 'chunked',
        });
        try { const socket = (res as any).socket; if (socket && typeof socket.setNoDelay === 'function') socket.setNoDelay(true); } catch {}
        await this.aiService.chatStream(
          body.message,
          (chunk) => {
            if (chunk) {
              res.write(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`);
              const rawRes = res as any;
              if (typeof rawRes.flush === 'function') rawRes.flush();
              else if (typeof rawRes.flushHeaders === 'function') rawRes.flushHeaders();
            }
          },
          body.model, body.agentId, body.skills, body.thread_id, body.attachments,
        );
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const content = await this.aiService.chatStream(body.message, null, body.model, body.agentId, body.skills, body.thread_id, body.attachments);
        res.json({ thread_id: body.thread_id, response: content, metadata: { model: body.model || 'qwen-plus' } });
      }
    } catch (error) {
      throw new HttpException(
        { success: false, message: error instanceof Error ? error.message : 'AI 对话失败' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('export-docx')
  async exportDocx(@Body() body: ExportDto, @Res() res: Response) {
    const buffer = await this.aiService.generateDocx(body.content, body.format || 'docx');
    const ext = body.format === 'xlsx' ? 'xlsx' : 'docx';
    res.setHeader('Content-Type', body.format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(body.filename || `export.${ext}`)}"`);
    res.send(buffer);
  }

  @Get('conversations') getConversations() { return this.aiService.getConversations(); }
  @Get('conversations/:threadId') getConversationHistory(@Param('threadId') threadId: string) { return { threadId, messages: this.aiService.getConversationHistory(threadId), total: 0 }; }
  @Delete('conversations/:threadId') clearConversation(@Param('threadId') threadId: string) { return { success: this.aiService.clearConversation(threadId), message: '已清除' }; }
  @Get('download/:token') async downloadFile(@Param('token') token: string, @Res() res: Response) {
    const file = this.aiService.getFileDownload(token);
    if (!file) throw new HttpException({ success: false, message: '文件不存在或已过期' }, HttpStatus.NOT_FOUND);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}"`);
    res.send(file.buffer);
  }
  @Get('report/:token') async viewReport(@Param('token') token: string, @Res() res: Response) {
    const report = this.aiService.getHtmlReport(token);
    if (!report) throw new HttpException({ success: false, message: '报告不存在或已过期' }, HttpStatus.NOT_FOUND);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(report.html);
  }
}

interface PlanSkillsResponse { success: boolean; data: PlannedSkill[]; message?: string; }