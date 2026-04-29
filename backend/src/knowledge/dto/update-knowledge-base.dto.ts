import { IsString, IsOptional, IsEnum, IsArray, IsNumber } from 'class-validator';
import { CreateKnowledgeBaseDto, KnowledgeSource, KnowledgeStatus } from './create-knowledge-base.dto';

export class UpdateKnowledgeBaseDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(KnowledgeSource)
  source?: KnowledgeSource;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  documents?: string[];

  @IsOptional()
  @IsNumber()
  documentCount?: number;

  @IsOptional()
  @IsEnum(KnowledgeStatus)
  status?: KnowledgeStatus;

  @IsNumber()
  @IsOptional()
  userId?: number;
}