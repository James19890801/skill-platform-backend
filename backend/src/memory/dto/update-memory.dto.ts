import { IsString, IsOptional, IsEnum, IsNumber } from 'class-validator';
import { MemoryCategory } from './create-memory.dto';

export class UpdateMemoryDto {
  @IsOptional()
  @IsNumber()
  agentId?: number;

  @IsOptional()
  @IsString()
  key?: string;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsEnum(MemoryCategory)
  category?: MemoryCategory;
}
