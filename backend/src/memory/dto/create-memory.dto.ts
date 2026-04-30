import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';

export enum MemoryCategory {
  PREFERENCE = 'preference',
  FACT = 'fact',
  CONTEXT = 'context',
}

export class CreateMemoryDto {
  @IsNumber()
  agentId: number;

  @IsString()
  key: string;

  @IsString()
  value: string;

  @IsOptional()
  @IsEnum(MemoryCategory)
  category?: MemoryCategory;
}
