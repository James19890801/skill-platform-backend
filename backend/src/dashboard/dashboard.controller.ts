import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('仪表盘')
@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @ApiOperation({ summary: '获取统计数据' })
  async getStats() {
    return this.dashboardService.getStats();
  }

  @Get('overview')
  @ApiOperation({ summary: '获取概览数据' })
  async getOverview() {
    return this.dashboardService.getOverview();
  }

  @Get('skills-by-domain')
  @ApiOperation({ summary: '按领域统计技能' })
  async getSkillsByDomain() {
    return this.dashboardService.getSkillsByDomain();
  }

  @Get('recent-activity')
  @ApiOperation({ summary: '获取最近活动' })
  async getRecentActivity() {
    return this.dashboardService.getRecentActivity();
  }
}
