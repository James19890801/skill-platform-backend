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
import { AuthGuard } from '../auth/guards/auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';
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
  async findAll(@Query() query: ReviewQueryDto) {
    return this.reviewsService.findAll(query);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取审核详情' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.reviewsService.findOne(id);
  }

  @Post(':id/approve')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '通过审核（仅管理员）' })
  async approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveReviewDto,
    @Request() req: any,
  ) {
    return this.reviewsService.approve(id, dto, req.user.id);
  }

  @Post(':id/reject')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '驳回审核（仅管理员）' })
  async reject(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RejectReviewDto,
    @Request() req: any,
  ) {
    return this.reviewsService.reject(id, dto, req.user.id);
  }
}
