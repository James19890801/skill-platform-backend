import { IsString, IsOptional, IsEnum, IsArray, IsNumber } from 'class-validator';

export enum KnowledgeSource {
  BAILIAN = 'bailian',
  LOCAL = 'local',
  WEB = 'web',
  FILE = 'file',
}

export enum KnowledgeStatus {
  CONNECTED = 'connected',
  SYNCING = 'syncing',
  ERROR = 'error',
}

export class CreateKnowledgeBaseDto {
  @IsString()
  name: string;

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