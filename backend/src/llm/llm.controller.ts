import { Body, Controller, Get, Param, ParseIntPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth.guard';
import { LlmService } from './llm.service';

@ApiTags('模型注册')
@Controller('api/llm')
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Get('providers')
  @ApiOperation({ summary: '模型供应商列表' })
  listProviders() {
    return this.llmService.listProviders();
  }

  @Post('providers')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '注册模型供应商并扫描模型' })
  createProvider(@Body() body: { name: string; provider: string; baseUrl?: string; apiKey: string }) {
    return this.llmService.createProvider(body);
  }

  @Post('providers/:id/scan')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '重新扫描供应商可用模型' })
  scanProvider(@Param('id', ParseIntPipe) id: number) {
    return this.llmService.scanProvider(id);
  }

  @Get('models')
  @ApiOperation({ summary: '可用模型列表' })
  listModels() {
    return this.llmService.listModels();
  }
}
