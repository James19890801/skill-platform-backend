import { IsArray, IsBoolean, IsOptional } from 'class-validator';

export class UpdatePersonalContextDto {
  @IsOptional()
  @IsArray()
  knowledgeBaseIds?: number[];

  @IsOptional()
  mcpServers?: unknown;

  @IsOptional()
  @IsBoolean()
  memoryEnabled?: boolean;
}
