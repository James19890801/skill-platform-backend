import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateEvaluationSuiteDto {
  @IsString()
  name: string;

  @IsIn(['agent', 'skill', 'knowledge', 'workflow'])
  targetType: string;

  @IsNumber()
  @Min(1)
  targetId: number;

  @IsOptional()
  @IsString()
  level?: string;

  @IsOptional()
  @IsString()
  stage?: string;
}

export class GenerateEvaluationCasesDto {
  @IsOptional()
  @IsBoolean()
  replace?: boolean;
}

export class UpdateEvaluationCaseDto {
  @IsOptional()
  @IsString()
  input?: string;

  @IsOptional()
  @IsString()
  expected?: string;

  @IsOptional()
  labels?: Record<string, unknown>;

  @IsOptional()
  assertions?: Array<Record<string, unknown>>;

  @IsOptional()
  @IsNumber()
  weight?: number;

  @IsOptional()
  @IsString()
  priority?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class CreateEvaluationRunDto {
  @IsNumber()
  @Min(1)
  suiteId: number;

  @IsOptional()
  @IsString()
  mode?: string;
}

export class ReviewEvaluationResultDto {
  @IsOptional()
  @IsString()
  reviewStatus?: string;

  @IsOptional()
  @IsNumber()
  score?: number;

  @IsOptional()
  @IsString()
  reviewComment?: string;
}

export class PromoteBenchmarkDto {
  @IsNumber()
  @Min(1)
  runId: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  version?: string;

  @IsOptional()
  @IsBoolean()
  makeActive?: boolean;
}
