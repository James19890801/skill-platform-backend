import { Controller, Post, Get, Delete, Body, Param, Res, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber, IsBoolean, IsArray } from 'class-validator';
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
  processFiles?: (string | ProcessFileDto)[];
  customPrompt?: string;
}

class PlanSkillsResponse {
  success: boolean;
  data: PlannedSkill[];
  message?: string;
}

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
}

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

  @Post('plan-skills')
  @ApiOperation({ summary: 'AI \u89c4\u5212 Skill', description: '\u57fa\u4e8e\u4e1a\u52a1\u6d41\u7a0b\u4fe1\u606f\uff0c\u4f7f\u7528\u901a\u4e49\u5343\u95ee AI \u89c4\u5212\u6240\u9700\u7684 Skill \u5217\u8868' })
  @ApiBody({ type: PlanSkillsDto })
  @ApiResponse({ status: 200, description: '\u89c4\u5212\u6210\u529f', type: PlanSkillsResponse })
  @ApiResponse({ status: 500, description: 'AI \u670d\u52a1\u8c03\u7528\u5931\u8d25' })
  async planSkills(@Body() body: PlanSkillsInput): Promise<PlanSkillsResponse> {
    try {
      const skills = await this.aiService.planSkills(body);
      return { 
        success: true, 
        data: skills,
        message: `\u6210\u529f\u89c4\u5212 ${skills.length} \u4e2a Skill`
      };
    } catch (error) {
      throw new HttpException(
        {
          success: false,
          data: [],
          message: error instanceof Error ? error.message : 'AI \u670d\u52a1\u8c03\u7528\u5931\u8d25',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('chat')
  @ApiOperation({ summary: 'AI \u5bf9\u8bdd\uff08\u6d41\u5f0f\u8f93\u51fa\uff09', description: '\u4e0e AI \u5bf9\u8bdd\uff0c\u652f\u6301\u6d41\u5f0f SSE \u8f93\u51fa' })
  @ApiBody({ type: ChatDto })
  async chat(@Body() body: ChatDto, @Res() res: Response) {
    try {
      const stream = body.stream !== false;
      
      if (stream) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');

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
        );

        res.write('data: [DONE]\n\n');
        res.end();
      } else {
        const content = await this.aiService.chatStream(
          body.message,
          null,
          body.model,
          body.agentId,
          body.skills,
          body.thread_id,
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
          message: error instanceof Error ? error.message : 'AI \u5bf9\u8bdd\u5931\u8d25',
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('export-docx')
  @ApiOperation({ summary: '\u5bfc\u51fa\u6587\u672c\u6587\u6863\u4e3a Word / Excel' })
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
        { success: false, message: error instanceof Error ? error.message : '\u5bfc\u51fa\u5931\u8d25' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ===== \u4f1a\u8bdd\u7ba1\u7406 =====

  @Get('conversations')
  @ApiOperation({ summary: '\u83b7\u53d6\u6240\u6709\u5bf9\u8bdd\u4f1a\u8bdd\u5217\u8868' })
  getConversations() {
    return this.aiService.getConversations();
  }

  @Get('conversations/:threadId')
  @ApiOperation({ summary: '\u83b7\u53d6\u6307\u5b9a\u4f1a\u8bdd\u7684\u5b8c\u6574\u5386\u53f2' })
  getConversationHistory(@Param('threadId') threadId: string) {
    const history = this.aiService.getConversationHistory(threadId);
    return { threadId, messages: history, total: history.length };
  }

  @Delete('conversations/:threadId')
  @ApiOperation({ summary: '\u6e05\u9664\u6307\u5b9a\u4f1a\u8bdd' })
  clearConversation(@Param('threadId') threadId: string) {
    const deleted = this.aiService.clearConversation(threadId);
    if (!deleted) {
      throw new HttpException(
        { success: false, message: '\u4f1a\u8bdd\u4e0d\u5b58\u5728' },
        HttpStatus.NOT_FOUND,
      );
    }
    return { success: true, message: '\u4f1a\u8bdd\u5df2\u6e05\u9664' };
  }
}
