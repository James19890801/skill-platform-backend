import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Health')
@Controller()
export class AppController {
  @Get()
  @ApiOperation({ summary: '健康检查' })
  @ApiResponse({ status: 200, description: 'API 运行正常' })
  healthCheck() {
    return {
      status: 'ok',
      message: 'Skill Platform API',
      timestamp: new Date().toISOString(),
    };
  }
}
