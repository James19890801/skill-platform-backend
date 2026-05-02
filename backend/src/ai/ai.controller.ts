import { Controller, Post, Get, Delete, Body, Param, Res, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Response } from 'express';
import { AiService, PlanSkillsInput, PlannedSkill, ProcessFileInfo } from './ai.service';

class ProcessFileDto {
  name: string;
  type?: string;
  content?: string;
}

class PlanSkillsDto {
  nodeName: string;
  nodeDescription?: string;
  processFiles?: (string | ProcessFileDto)[];  // 支持字符串或对象
  customPrompt?: string;
}

class PlanSkillsResponse {
  success: boolean;
  data: PlannedSkill[];
  message?: string;
}

class AttachmentDto {
  @IsString()
  name: string;

  @IsString()
  type: string;

  @IsString()
  dataUrl: string;
}

// Chat 请求 DTO
class ChatDto {
  @IsString()
  thread_id: string;

  @IsString()
  message: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsNumber()
  agentId?: number;

  @IsOptional()
  @IsArray()
  skills?: string[];

  @IsOptional()
  @IsBoolean()
  stream?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AttachmentDto)
  attachments?: AttachmentDto[];
}

// ===== Export DTO =====
class ExportDto {
  @IsString()
  content: string;

  @IsString()
  @IsOptional()
  format?: 'docx' | 'xlsx';

  @IsString()
  @IsOptional()
  filename?: string;
}

@ApiTags('AI')
@Controller('api/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('health')
  @ApiOperation({ summary: 'AI 服务健康检查（用于前端预热）' })
  healthCheck() {
    return { status: 'ok', service: 'ai', timestamp: new Date().toISOString() };
  }

  @Post('plan-skills')
  @ApiOperation({ summary: 'AI 规划 Skill', description: '基于业务流程信息，使用通义千问 AI 规划所需的 Skill 列表' })
  @ApiBody({ type: PlanSkillsDto })
  @ApiResponse({ status: 200, description: '规划成功', type: PlanSkillsResponse })
  @ApiResponse({ status: 500, description: 'AI 服务调用失败' })
  async planSkills(@Body() body: PlanSkillsInput): Promise<PlanSkillsResponse> {
    try {
      const skills = await this.aiService.planSkills(body);
      return { 
        success: true, 
        data: skills,
        message: `成功规划 ${skills.length} 个 Skill`
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          data: [],
          message: error instanceof Error ? error.message : 'AI 服务调用失败',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('chat')
  @ApiOperation({ summary: 'AI 对话（流式输出）', description: '与 AI 对话，支持流式 SSE 输出和附件上传' })
  @ApiBody({ type: ChatDto })
  async chat(@Body() body: ChatDto, @Res() res: Response) {
    try {
      const stream = body.stream !== false;
      
      if (stream) {
        // 流式输出 SSE — 禁用缓存 + TCP_NODELAY 保证毫秒级首字符响应
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          'Transfer-Encoding': 'chunked',
        });

        // 禁用 Nagle 算法，确保每个 write() 立即发送 TCP 包
        try {
          const socket = (res as any).socket;
          if (socket && typeof socket.setNoDelay === 'function') {
            socket.setNoDelay(true);
          }
        } catch { /* 低版本 Node 兼容 */ }

        const fullContent = await this.aiService.chatStream(
          body.message,
          (chunk) => {
            if (chunk) {
              res.write(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`);
            }
          },
          body.model,
          body.agentId,
          body.skills,
          body.thread_id,
          body.attachments,
        );

        // ★ 空响应检测：AI 未返回内容（上下文溢出/模型拒绝）
        if (!fullContent?.trim()) {
          res.write(`data: ${JSON.stringify({ type: 'error', content: 'AI 未返回有效回复，可能是上下文过长，请尝试清除对话后重试' })}\n\n`);
        }
        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        // 非流式输出
        const content = await this.aiService.chatStream(
          body.message,
          null,
          body.model,
          body.agentId,
          body.skills,
          body.thread_id,
          body.attachments,
        );
        res.json({
          thread_id: body.thread_id,
          response: content,
          metadata: { model: body.model || 'qwen-plus' },
        });
      }
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          message: error instanceof Error ? error.message : 'AI 对话失败',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('export-docx')
  @ApiOperation({ summary: '导出文本文档为 Word / Excel' })
  async exportDocx(@Body() body: ExportDto, @Res() res: Response) {
    try {
      const buffer = await this.aiService.generateDocx(body.content, body.format || 'docx');
      const ext = body.format === 'xlsx' ? 'xlsx' : 'docx';
      const filename = body.filename || `export.${ext}`;
      res.setHeader('Content-Type', body.format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      res.send(buffer);
    } catch (error) {
      throw new HttpException(
        { success: false, message: error instanceof Error ? error.message : '导出失败' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ===== 会话管理 =====

  @Get('conversations')
  @ApiOperation({ summary: '获取所有对话会话列表' })
  getConversations() {
    return this.aiService.getConversations();
  }

  @Get('conversations/:threadId')
  @ApiOperation({ summary: '获取指定会话的完整历史' })
  getConversationHistory(@Param('threadId') threadId: string) {
    const history = this.aiService.getConversationHistory(threadId);
    return { threadId, messages: history, total: history.length };
  }

  @Delete('conversations/:threadId')
  @ApiOperation({ summary: '清除指定会话' })
  clearConversation(@Param('threadId') threadId: string) {
    const deleted = this.aiService.clearConversation(threadId);
    if (!deleted) {
      throw new HttpException(
        { success: false, message: '会话不存在' },
        HttpStatus.NOT_FOUND,
      );
    }
    return { success: true, message: '会话已清除' };
  }

  @Get('download/:token')
  @ApiOperation({ summary: '下载工具生成的文件（Word/Excel）' })
  async downloadFile(@Param('token') token: string, @Res() res: Response) {
    const file = this.aiService.getFileDownload(token);
    if (!file) {
      throw new HttpException(
        { success: false, message: '文件不存在或已过期' },
        HttpStatus.NOT_FOUND,
      );
    }
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.filename)}"`);
    res.send(file.buffer);
  }

  @Get('report/:token')
  @ApiOperation({ summary: '查看工具生成的 HTML 报告' })
  async viewReport(@Param('token') token: string, @Res() res: Response) {
    const report = this.aiService.getHtmlReport(token);
    if (!report) {
      throw new HttpException(
        { success: false, message: '报告不存在或已过期' },
        HttpStatus.NOT_FOUND,
      );
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(report.html);
  }
}
