import { ApiPropertyOptional } from '@nestjs/swagger';
import { Allow, IsOptional, IsString } from 'class-validator';

export class NormalizeMcpDto {
  @ApiPropertyOptional({ description: 'JSON 字符串，支持 Claude/Cursor 风格 mcpServers 配置' })
  @IsString()
  @IsOptional()
  json?: string;

  @ApiPropertyOptional({ description: '已解析的 MCP 配置对象或数组' })
  @Allow()
  @IsOptional()
  config?: unknown;

  @ApiPropertyOptional({ description: 'Claude/Cursor 风格 mcpServers 对象' })
  @Allow()
  @IsOptional()
  mcpServers?: unknown;

  @ApiPropertyOptional({ description: 'MCP Server 数组或对象别名' })
  @Allow()
  @IsOptional()
  servers?: unknown;
}

export class ProbeMcpDto extends NormalizeMcpDto {}

export class RegisterMcpDto extends NormalizeMcpDto {}
