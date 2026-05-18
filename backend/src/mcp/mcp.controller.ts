import { Body, Controller, Delete, Get, Param, Post, Request } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { NormalizeMcpDto, ProbeMcpDto, RegisterMcpDto } from './dto';
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

  @Get('servers')
  @ApiOperation({ summary: '获取已注册 MCP Server' })
  listRegistered() {
    return this.mcpService.listRegistered();
  }

  @Post('servers')
  @ApiOperation({ summary: '注册 MCP Server 到广场' })
  register(@Body() dto: RegisterMcpDto, @Request() req: any) {
    return this.mcpService.register(dto, req.user?.id);
  }

  @Delete('servers/:id')
  @ApiOperation({ summary: '删除已注册 MCP Server' })
  removeRegistered(@Param('id') id: string) {
    return this.mcpService.removeRegistered(id);
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
