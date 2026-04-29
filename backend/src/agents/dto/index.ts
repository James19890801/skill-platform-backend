import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsBoolean, IsArray } from 'class-validator';

export class CreateAgentDto {
  @ApiProperty({ description: 'Agent 名称' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '模型', default: 'qwen-plus' })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({ description: '系统提示词' })
  @IsString()
  @IsOptional()
  systemPrompt?: string;

  @ApiPropertyOptional({ description: '关联 Skills', type: [String] })
  @IsArray()
  @IsOptional()
  skills?: string[];

  @ApiPropertyOptional({ description: '关联知识库', type: [String] })
  @IsArray()
  @IsOptional()
  knowledgeBases?: string[];

  @ApiPropertyOptional({ description: '启用长期记忆', default: true })
  @IsBoolean()
  @IsOptional()
  memoryEnabled?: boolean;

  @ApiPropertyOptional({ description: '温度参数', default: 0.7 })
  @IsNumber()
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional({ description: '最大输出长度' })
  @IsNumber()
  @IsOptional()
  maxTokens?: number;
}

export class UpdateAgentDto {
  @ApiPropertyOptional({ description: 'Agent 名称' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '模型' })
  @IsString()
  @IsOptional()
  model?: string;

  @ApiPropertyOptional({ description: '系统提示词' })
  @IsString()
  @IsOptional()
  systemPrompt?: string;

  @ApiPropertyOptional({ description: '关联 Skills', type: [String] })
  @IsArray()
  @IsOptional()
  skills?: string[];

  @ApiPropertyOptional({ description: '关联知识库', type: [String] })
  @IsArray()
  @IsOptional()
  knowledgeBases?: string[];

  @ApiPropertyOptional({ description: '启用长期记忆' })
  @IsBoolean()
  @IsOptional()
  memoryEnabled?: boolean;

  @ApiPropertyOptional({ description: '温度参数' })
  @IsNumber()
  @IsOptional()
  temperature?: number;

  @ApiPropertyOptional({ description: '最大输出长度' })
  @IsNumber()
  @IsOptional()
  maxTokens?: number;

  @ApiPropertyOptional({ description: '状态' })
  @IsString()
  @IsOptional()
  status?: string;
}
