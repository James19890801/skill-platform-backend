import { Controller, Post, Get, Body, Query, Res, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse, ApiQuery } from '@nestjs/swagger';
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

// Chat 请求 DTO
class ChatDto {
  thread_id: string;
  message: string;
  model?: string;
  agentId?: number;
  skills?: string[];
  stream?: boolean;
}

@ApiTags('AI')
@Controller('api/ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

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
  @ApiOperation({ summary: 'AI 对话（流式输出）', description: '与 AI 对话，支持流式 SSE 输出' })
  @ApiBody({ type: ChatDto })
  async chat(@Body() body: ChatDto, @Res() res: Response) {
    try {
      const stream = body.stream !== false;
      
      if (stream) {
        // 流式输出 SSE
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
        );

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
}
