import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Allow, IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class CapabilityNodeDto {
  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  id?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  parentId?: number | null;

  @ApiProperty({ description: '节点类型：domain/stage/group/skill' })
  @IsString()
  nodeType: string;

  @ApiProperty({ description: '节点显示名称' })
  @IsString()
  label: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  domain?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  subDomain?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  skillId?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  namespace?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  orderIndex?: number;

  @ApiPropertyOptional()
  @Allow()
  @IsOptional()
  loopPolicy?: unknown;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  conditionExpression?: string;
}

export class CapabilityEdgeDto {
  @ApiProperty()
  @IsNumber()
  sourceNodeId: number;

  @ApiProperty()
  @IsNumber()
  targetNodeId: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  edgeType?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  conditionExpression?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  priority?: number;
}

export class CreateCapabilityTreeDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  scope?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  version?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ type: [CapabilityNodeDto] })
  @IsArray()
  @IsOptional()
  nodes?: CapabilityNodeDto[];

  @ApiPropertyOptional({ type: [CapabilityEdgeDto] })
  @IsArray()
  @IsOptional()
  edges?: CapabilityEdgeDto[];
}

export class UpdateCapabilityTreeDto extends CreateCapabilityTreeDto {}
