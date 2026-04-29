import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';

export class ReviewQueryDto {
  @ApiPropertyOptional({ description: '状态筛选', enum: ['pending', 'approved', 'rejected'] })
  @IsString()
  @IsOptional()
  status?: string;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  page?: number;

  @ApiPropertyOptional({ description: '每页数量', default: 10 })
  @IsOptional()
  limit?: number;
}

export class ApproveReviewDto {
  @ApiPropertyOptional({ description: '审核意见' })
  @IsString()
  @IsOptional()
  comment?: string;
}

export class RejectReviewDto {
  @ApiProperty({ description: '驳回原因' })
  @IsString()
  reason: string;
}
