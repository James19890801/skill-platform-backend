import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { NormalizeMcpDto, ProbeMcpDto } from './dto';
import { McpService } from './mcp.service';

@ApiTags('MCP 市场')
@Controller('api/mcp')
export class McpController {
  constructor(private readonly mcpService: McpService) {}

  @Get('marketplace')
  @ApiOperation({ summary: '获取内置 MCP 市场推荐' })
  getMarketplace() {
    return this.mcpService.getMarketplace();
  }

  @Post('normalize')
  @ApiOperation({ summary: '解析并标准化 MCP JSON 配置' })
  normalize(@Body() dto: NormalizeMcpDto) {
    return { servers: this.mcpService.normalize(dto) };
  }

  @Post('probe')
  @ApiOperation({ summary: '校验 MCP 配置格式（不执行命令）' })
  probe(@Body() dto: ProbeMcpDto) {
    return this.mcpService.probe(dto);
  }
}
