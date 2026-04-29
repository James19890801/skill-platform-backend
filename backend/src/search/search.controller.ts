import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SearchService } from './search.service';

@ApiTags('搜索')
@Controller('api/search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({ summary: '全局搜索' })
  @ApiQuery({ name: 'q', required: true, description: '搜索关键词' })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  async search(@Query('q') keyword: string, @Query('tenantId') tenantId?: string) {
    return this.searchService.search(keyword, tenantId ? parseInt(tenantId, 10) : 1);
  }

  @Get('skills')
  @ApiOperation({ summary: '搜索技能' })
  @ApiQuery({ name: 'q', required: false, description: '搜索关键词' })
  @ApiQuery({ name: 'domain', required: false, description: '领域筛选' })
  @ApiQuery({ name: 'status', required: false, description: '状态筛选' })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  async searchSkills(
    @Query('q') keyword: string,
    @Query('domain') domain?: string,
    @Query('status') status?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    return this.searchService.searchSkills(keyword, { domain, status }, tenantId ? parseInt(tenantId, 10) : 1);
  }
}
