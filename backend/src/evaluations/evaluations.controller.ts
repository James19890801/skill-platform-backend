import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '../auth/guards/auth.guard';
import { OptionalAuthGuard } from '../auth/guards/optional-auth.guard';
import {
  CreateEvaluationRunDto,
  CreateEvaluationSuiteDto,
  GenerateEvaluationCasesDto,
  PromoteBenchmarkDto,
  ReviewEvaluationResultDto,
  UpdateEvaluationCaseDto,
} from './dto';
import { EvaluationsService } from './evaluations.service';

@ApiTags('评测中心')
@Controller('api/evaluations')
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Get('summary')
  @ApiOperation({ summary: '获取评测中心总览' })
  summary() {
    return this.evaluationsService.summary();
  }

  @Get('targets')
  @ApiOperation({ summary: '查询可评测对象' })
  @ApiQuery({ name: 'targetType', required: false })
  @ApiQuery({ name: 'query', required: false })
  targets(@Query('targetType') targetType?: string, @Query('query') query?: string) {
    return this.evaluationsService.listTargets(targetType, query);
  }

  @Get('suites')
  @ApiOperation({ summary: '获取评测套件列表' })
  suites(@Query('targetType') targetType?: string) {
    return this.evaluationsService.listSuites(targetType);
  }

  @Get('suites/:id')
  @ApiOperation({ summary: '获取评测套件详情' })
  suite(@Param('id', ParseIntPipe) id: number) {
    return this.evaluationsService.getSuite(id);
  }

  @Post('suites')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: '创建评测套件' })
  createSuite(@Body() dto: CreateEvaluationSuiteDto, @Request() req: any) {
    return this.evaluationsService.createSuite(dto, req.user?.id);
  }

  @Post('suites/:id/generate-cases')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: '自动生成评测用例' })
  generateCases(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: GenerateEvaluationCasesDto,
  ) {
    return this.evaluationsService.generateCases(id, dto || {});
  }

  @Put('cases/:id')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: '更新评测用例与标注' })
  updateCase(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEvaluationCaseDto) {
    return this.evaluationsService.updateCase(id, dto);
  }

  @Post('runs')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: '启动评测运行' })
  createRun(@Body() dto: CreateEvaluationRunDto) {
    return this.evaluationsService.createRun(dto);
  }

  @Get('runs/:id')
  @ApiOperation({ summary: '获取评测运行详情' })
  run(@Param('id', ParseIntPipe) id: number) {
    return this.evaluationsService.getRun(id);
  }

  @Post('results/:id/review')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '人工复核单条评测结果' })
  reviewResult(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReviewEvaluationResultDto,
    @Request() req: any,
  ) {
    return this.evaluationsService.reviewResult(id, dto, req.user?.id);
  }

  @Get('benchmarks')
  @ApiOperation({ summary: '获取 benchmark 列表' })
  benchmarks(@Query('targetType') targetType?: string) {
    return this.evaluationsService.listBenchmarks(targetType);
  }

  @Post('benchmarks/promote')
  @UseGuards(OptionalAuthGuard)
  @ApiOperation({ summary: '从评测运行固化 benchmark' })
  promoteBenchmark(@Body() dto: PromoteBenchmarkDto) {
    return this.evaluationsService.promoteBenchmark(dto);
  }

  @Get('benchmarks/:id/export')
  @ApiOperation({ summary: '导出 benchmark 资产' })
  exportBenchmark(@Param('id', ParseIntPipe) id: number) {
    return this.evaluationsService.exportBenchmark(id);
  }
}
