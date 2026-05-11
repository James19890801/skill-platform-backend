import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ObservabilityService } from './observability.service';

@ApiTags('Monitoring')
@Controller('api/monitoring')
export class MonitoringController {
  constructor(private readonly observability: ObservabilityService) {}

  @Get('summary')
  @ApiOperation({ summary: '获取监控总览' })
  summary() {
    return this.observability.getSummary();
  }

  @Get('events')
  @ApiOperation({ summary: '获取监控事件' })
  events(
    @Query('level') level?: string,
    @Query('category') category?: string,
    @Query('limit') limit?: string,
  ) {
    return this.observability.listEvents({
      level,
      category,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
