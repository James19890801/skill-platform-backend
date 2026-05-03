import { Controller, Post, Get, Delete, Body, Param, Res, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import { Response } from 'express';
import { AiService, PlanSkillsInput, PlannedSkill, ProcessFileInfo } from './ai.service';
import { SkillExecutorService } from './skill-executor.service';
import { ToolBridgeService } from './tool-bridge.service';

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
  @IsNotEmpty()
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
  constructor(
    private readonly aiService: AiService,
    private readonly skillExecutor: SkillExecutorService,
    private readonly toolBridge: ToolBridgeService,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'AI 服务健康检查（用于前端预热）' })
  healthCheck() {
    return { status: 'ok', service: 'ai', timestamp: new Date().toISOString() };
  }

  @Get('agent-status')
  @ApiOperation({ summary: 'Agent Runtime 连通性诊断' })
  async agentStatus() {
    const tools = await this.toolBridge.getTools();
    const toolNames = tools.map(t => t.function.name);
    return {
      agentRuntimeUrl: process.env.AGENT_RUNTIME_URL || 'http://localhost:8001',
      toolsCount: tools.length,
      toolNames,
      agentRuntimeConnected: tools.length > 4, // >4 说明成功连上了 Agent Runtime
    };
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
              // ★ 检测是否为结构化事件（execution_progress/execution_start/execution_done 等）
              // 这些事件由后端 SkillExecutor 发出，前端需要特殊渲染
              if (chunk.startsWith('{"type"') && chunk.includes('execution_')) {
                res.write(`data: ${chunk.trim()}\n\n`);
              } else {
                res.write(`data: ${JSON.stringify({ type: 'content', content: chunk })}\n\n`);
              }
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

  @Get('preview/:token')
  @ApiOperation({ summary: '预览工具生成的文档（Word/Excel 转 HTML）' })
  async previewFile(@Param('token') token: string, @Res() res: Response) {
    const preview = await this.aiService.generatePreview(token);
    if (!preview) {
      throw new HttpException(
        { success: false, message: '文件不存在或已过期，或预览生成失败' },
        HttpStatus.NOT_FOUND,
      );
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send('<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>' + preview.filename + '</title>\n<style>\n  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px 32px; max-width: 820px; margin: 0 auto; color: #333; line-height: 1.8; }\n  h1 { font-size: 22px; border-bottom: 2px solid #6366f1; padding-bottom: 8px; }\n  h2 { font-size: 18px; margin-top: 24px; }\n  h3 { font-size: 15px; }\n  table { border-collapse: collapse; width: 100%; margin: 12px 0; }\n  th, td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; }\n  th { background: #f1f5f9; font-weight: 600; }\n  tr:nth-child(even) { background: #fafafa; }\n  p { margin: 8px 0; }\n  ul, ol { padding-left: 24px; }\n  img { max-width: 100%; }\n</style>\n</head>\n<body>' + preview.html + '</body>\n</html>');
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

  // ===== Skill 执行引擎 API =====

  @ApiOperation({ summary: '执行 Skill', description: '按 Skill 定义的步骤多轮调用工具执行，产出所有交付物' })
  @Post('execute-skill/:id')
  async executeSkill(
    @Param('id') id: string,
    @Body() body: { input: string; threadId?: string },
  ) {
    try {
      const result = await this.skillExecutor.execute(
        Number(id),
        body.input || '',
        body.threadId,
      );
      return {
        success: true,
        data: result,
        message: `Skill 执行完成，共 ${result.totalRounds} 轮，产出 ${result.artifacts.length} 个产物`,
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw new HttpException(
          { success: false, message: error.message },
          HttpStatus.NOT_FOUND,
        );
      }
      throw new HttpException(
        { success: false, message: error instanceof Error ? error.message : 'Skill 执行失败' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({ summary: '获取 Skill 执行记录', description: '查询指定 Skill 的历史执行记录' })
  @Get('execute-skill/:id/history')
  async getExecutionHistory(@Param('id') id: string) {
    try {
      const history = await this.skillExecutor.getHistory(Number(id));
      return { success: true, data: history };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error instanceof Error ? error.message : '查询失败' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @ApiOperation({ summary: '获取单次执行详情', description: '查看某次执行的完整日志和产物' })
  @Get('execute-skill/execution/:executionId')
  async getExecutionDetail(@Param('executionId') executionId: string) {
    try {
      const detail = await this.skillExecutor.getExecution(Number(executionId));
      if (!detail) {
        throw new HttpException(
          { success: false, message: '执行记录不存在' },
          HttpStatus.NOT_FOUND,
        );
      }
      return { success: true, data: detail };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { success: false, message: error instanceof Error ? error.message : '查询失败' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
