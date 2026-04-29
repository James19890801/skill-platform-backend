import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('仪表盘')
@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: '获取统计数据' })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  async getStats(@Query('tenantId') tenantId?: string) {
    return this.dashboardService.getStats(tenantId ? parseInt(tenantId, 10) : 1);
  }

  @Get('overview')
  @ApiOperation({ summary: '获取概览数据' })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  async getOverview(@Query('tenantId') tenantId?: string) {
    return this.dashboardService.getOverview(tenantId ? parseInt(tenantId, 10) : 1);
  }

  @Get('skills-by-domain')
  @ApiOperation({ summary: '按领域统计技能' })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  async getSkillsByDomain(@Query('tenantId') tenantId?: string) {
    return this.dashboardService.getSkillsByDomain(tenantId ? parseInt(tenantId, 10) : 1);
  }

  @Get('recent-activity')
  @ApiOperation({ summary: '获取最近活动' })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  async getRecentActivity(@Query('tenantId') tenantId?: string) {
    return this.dashboardService.getRecentActivity(tenantId ? parseInt(tenantId, 10) : 1);
  }
}
