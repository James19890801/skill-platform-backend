import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../common';
import { ReviewsService } from './reviews.service';
import { ReviewQueryDto, ApproveReviewDto, RejectReviewDto } from './dto';

@ApiTags('审核管理')
@Controller('api/reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @Get()
  @ApiOperation({ summary: '获取审核列表' })
  @ApiQuery({ name: 'status', required: false, description: '状态筛选' })
  @ApiQuery({ name: 'page', required: false, description: '页码' })
  @ApiQuery({ name: 'limit', required: false, description: '每页数量' })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  async findAll(@Query() query: ReviewQueryDto, @Query('tenantId') tenantId?: string) {
    return this.reviewsService.findAll(query, tenantId ? parseInt(tenantId, 10) : 1);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取审核详情' })
  @ApiQuery({ name: 'tenantId', required: false, description: '租户ID' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Query('tenantId') tenantId?: string) {
    return this.reviewsService.findOne(id, tenantId ? parseInt(tenantId, 10) : 1);
  }

  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: '通过审核（需要 manager 权限）' })
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveReviewDto,
    @Request() req: any,
  ) {
    return this.reviewsService.approve(id, dto, req.user.id, req.user.tenantId || 1);
  }

  @Post(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('manager')
  @ApiBearerAuth()
  @ApiOperation({ summary: '驳回审核（需要 manager 权限）' })
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectReviewDto,
    @Request() req: any,
  ) {
    return this.reviewsService.reject(id, dto, req.user.id, req.user.tenantId || 1);
  }
}
