import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBody, ApiResponse } from '@nestjs/swagger';
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
}
