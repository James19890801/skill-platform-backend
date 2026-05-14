import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator';

export class ProcessArchitectureNodeDto {
  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  id?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  parentId?: number | null;

  @ApiPropertyOptional({ description: '节点编码，例如 L1/L2-01/L3-02' })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiProperty({ description: '节点名称' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: '流程层级，例如 1/2/3/4' })
  @IsNumber()
  @IsOptional()
  level?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateProcessArchitectureTreeDto {
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
  source?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  version?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ type: [ProcessArchitectureNodeDto] })
  @IsArray()
  @IsOptional()
  nodes?: ProcessArchitectureNodeDto[];
}

export class UpdateProcessArchitectureTreeDto extends CreateProcessArchitectureTreeDto {}

export class CreateProcessArchitectureNodeDto extends ProcessArchitectureNodeDto {}

export class UpdateProcessArchitectureNodeDto extends ProcessArchitectureNodeDto {}
