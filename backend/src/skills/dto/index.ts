import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsEnum } from 'class-validator';

export class CreateSkillDto {
  @ApiProperty({ description: '命名空间' })
  @IsString()
  namespace: string;

  @ApiProperty({ description: '技能名称' })
  @IsString()
  name: string;

  @ApiProperty({ description: '领域' })
  @IsString()
  domain: string;

  @ApiProperty({ description: '子领域' })
  @IsString()
  subDomain: string;

  @ApiProperty({ description: '能力名称' })
  @IsString()
  abilityName: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '范围', enum: ['personal', 'business', 'platform'] })
  @IsString()
  @IsOptional()
  scope?: string;

  @ApiPropertyOptional({ description: '类型', enum: ['pure-business', 'light-tech', 'heavy-tech'] })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: '组织ID' })
  @IsNumber()
  @IsOptional()
  orgId?: number;

  @ApiPropertyOptional({ description: 'SOP来源' })
  @IsString()
  @IsOptional()
  sopSource?: string;
}

export class UpdateSkillDto {
  @ApiPropertyOptional({ description: '技能名称' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '范围' })
  @IsString()
  @IsOptional()
  scope?: string;

  @ApiPropertyOptional({ description: '类型' })
  @IsString()
  @IsOptional()
  type?: string;

  @ApiPropertyOptional({ description: 'SOP来源' })
  @IsString()
  @IsOptional()
  sopSource?: string;
}

export class CreateSkillVersionDto {
  @ApiProperty({ description: '版本号' })
  @IsString()
  version: string;

  @ApiPropertyOptional({ description: '描述' })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional({ description: '输入定义' })
  @IsOptional()
  input?: any;

  @ApiPropertyOptional({ description: '输出定义' })
  @IsOptional()
  output?: any;

  @ApiPropertyOptional({ description: '依赖列表' })
  @IsOptional()
  dependencies?: string[];

  @ApiPropertyOptional({ description: '变更日志' })
  @IsString()
  @IsOptional()
  changelog?: string;
}

export class SkillQueryDto {
  @ApiPropertyOptional({ description: '领域' })
  @IsString()
  @IsOptional()
  domain?: string;

  @ApiPropertyOptional({ description: '状态' })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: '范围' })
  @IsString()
  @IsOptional()
  scope?: string;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 10 })
  @IsOptional()
  limit?: number;

  @ApiPropertyOptional({ description: '搜索关键词' })
  @IsString()
  @IsOptional()
  search?: string;
}

export class SubmitReviewDto {
  @ApiProperty({ description: '目标范围', enum: ['personal', 'business', 'platform'] })
  @IsString()
  targetScope: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsString()
  @IsOptional()
  comment?: string;
}
