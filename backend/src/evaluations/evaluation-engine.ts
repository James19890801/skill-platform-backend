export type EvaluationTargetType = 'agent' | 'skill' | 'knowledge' | 'workflow';

export interface EvaluationTargetDescriptor {
  targetType: EvaluationTargetType;
  targetId: number;
  targetName: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

export interface GeneratedEvaluationCase {
  caseKey: string;
  category: string;
  stage: string;
  level: string;
  input: string;
  expected: string;
  labels: Record<string, unknown>;
  assertions: Array<Record<string, unknown>>;
  weight: number;
  priority: 'P0' | 'P1' | 'P2';
}

export interface EvaluationScoreInput {
  status: 'passed' | 'partial' | 'failed' | 'blocked' | string;
  score?: number | null;
  weight?: number | null;
  category?: string | null;
}

export interface EvaluationScoreSummary {
  totalScore: number;
  grade: string;
  caseSummary: {
    total: number;
    passed: number;
    partial: number;
    failed: number;
    blocked: number;
  };
  dimensions: Record<string, { score: number; max: number; count: number }>;
}

export interface BenchmarkArtifactInput {
  benchmarkId: number;
  benchmarkName: string;
  version: string;
  targetType: EvaluationTargetType;
  targetId: number;
  targetName: string;
  runId: number;
  score: EvaluationScoreSummary;
  cases: Array<{
    id?: number;
    caseKey: string;
    category: string;
    input: string;
    expected?: string | null;
    weight?: number | null;
  }>;
  results: Array<{
    caseId?: number;
    status: string;
    score?: number | null;
    evidence?: string | null;
  }>;
}

function targetKindLabel(type: EvaluationTargetType): string {
  const labels: Record<EvaluationTargetType, string> = {
    agent: 'Agent',
    skill: 'Skill',
    knowledge: '知识库',
    workflow: '流程编排',
  };
  return labels[type];
}

function gradeForScore(score: number): string {
  if (score >= 90) return '优秀';
  if (score >= 80) return '良好';
  if (score >= 70) return '合格';
  if (score >= 50) return '需改进';
  return '不合格';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cleanWeight(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 10) : 1;
}

function cleanPriority(value: unknown): 'P0' | 'P1' | 'P2' {
  return value === 'P0' || value === 'P1' || value === 'P2' ? value : 'P1';
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {};
}

function normalizeAssertions(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

export function normalizeGeneratedEvaluationCases(
  payload: unknown,
  target: EvaluationTargetDescriptor,
): GeneratedEvaluationCase[] {
  if (!Array.isArray(payload)) {
    throw new Error('模型未返回 JSON 数组格式的评测用例');
  }

  const cases = payload.flatMap((raw, index) => {
    if (!isRecord(raw)) return [];
    const input = cleanString(raw.input);
    const expected = cleanString(raw.expected);
    if (!input || !expected) return [];

    return [{
      caseKey: cleanString(raw.caseKey) || `${target.targetType}-${target.targetId}-${String(index + 1).padStart(3, '0')}`,
      category: cleanString(raw.category) || 'general',
      stage: cleanString(raw.stage),
      level: cleanString(raw.level),
      input,
      expected,
      labels: {
        targetType: target.targetType,
        targetId: target.targetId,
        targetName: target.targetName,
        ...normalizeRecord(raw.labels),
      },
      assertions: normalizeAssertions(raw.assertions),
      weight: cleanWeight(raw.weight),
      priority: cleanPriority(raw.priority),
    }];
  });

  if (cases.length === 0) {
    throw new Error('模型返回的用例缺少 input 或 expected，无法保存');
  }

  return cases;
}

export function computeEvaluationScore(results: EvaluationScoreInput[]): EvaluationScoreSummary {
  const total = results.length;
  const caseSummary = {
    total,
    passed: results.filter((item) => item.status === 'passed').length,
    partial: results.filter((item) => item.status === 'partial').length,
    failed: results.filter((item) => item.status === 'failed').length,
    blocked: results.filter((item) => item.status === 'blocked').length,
  };

  let weightedScore = 0;
  let totalWeight = 0;
  const dimensionBuckets: Record<string, { score: number; max: number; count: number }> = {};

  for (const result of results) {
    const weight = Number(result.weight || 1);
    const score = Math.max(0, Math.min(100, Number(result.score ?? 0)));
    weightedScore += score * weight;
    totalWeight += weight;

    const category = result.category || 'default';
    const bucket = dimensionBuckets[category] || { score: 0, max: 0, count: 0 };
    bucket.score += score * weight;
    bucket.max += 100 * weight;
    bucket.count += 1;
    dimensionBuckets[category] = bucket;
  }

  const dimensions = Object.fromEntries(
    Object.entries(dimensionBuckets).map(([key, value]) => [
      key,
      {
        score: value.max > 0 ? Math.round((value.score / value.max) * 100) : 0,
        max: 100,
        count: value.count,
      },
    ]),
  );

  const totalScore = totalWeight > 0 ? Math.round(weightedScore / totalWeight) : 0;
  return {
    totalScore,
    grade: gradeForScore(totalScore),
    caseSummary,
    dimensions,
  };
}

export function buildBenchmarkArtifacts(input: BenchmarkArtifactInput): Record<string, string> {
  const createdAt = new Date().toISOString();
  const casesJsonl = input.cases
    .map((item) => JSON.stringify({
      id: item.id,
      case_key: item.caseKey,
      category: item.category,
      input: item.input,
      expected_behavior: item.expected,
      weight: item.weight || 1,
    }))
    .join('\n');

  const scores = {
    benchmark_id: input.benchmarkId,
    benchmark_name: input.benchmarkName,
    target_type: input.targetType,
    target_id: input.targetId,
    target_name: input.targetName,
    run_id: input.runId,
    version: input.version,
    total_score: input.score.totalScore,
    grade: input.score.grade,
    dimensions: input.score.dimensions,
    case_summary: input.score.caseSummary,
    generated_at: createdAt,
  };

  const evidenceRows = input.results.map((result) => (
    `- Case ${result.caseId ?? 'unknown'}：${result.status}，${result.score ?? 0} 分。${result.evidence || '暂无证据摘要'}`
  )).join('\n');

  return {
    'benchmark-card.md': [
      `# Benchmark Card：${input.benchmarkName}`,
      '',
      `- 被评测对象：${targetKindLabel(input.targetType)}「${input.targetName}」`,
      `- 对象 ID：${input.targetId}`,
      `- Benchmark 版本：${input.version}`,
      `- Run ID：${input.runId}`,
      `- 总分：${input.score.totalScore} / 100`,
      `- 等级：${input.score.grade}`,
      `- 生成时间：${createdAt}`,
      '',
      '## 范围',
      '本 benchmark 覆盖用例、评分方法、结果证据和复跑所需的机器可读数据。',
    ].join('\n'),
    'method.md': [
      '# Method',
      '',
      '评分采用用例权重加权平均。机器评分可由规则断言、检索指标、轨迹检查和 LLM rubric 共同组成；人工复核结果优先。',
      '',
      '硬门禁：P0 安全用例失败、缺少证据、缺少可复跑用例时，不应作为 release benchmark。',
    ].join('\n'),
    'cases.jsonl': casesJsonl,
    'scores.json': JSON.stringify(scores, null, 2),
    'report.md': [
      `# 评测报告：${input.benchmarkName}`,
      '',
      `总分：${input.score.totalScore} / 100`,
      `等级：${input.score.grade}`,
      '',
      '## 用例概览',
      `- 总数：${input.score.caseSummary.total}`,
      `- 通过：${input.score.caseSummary.passed}`,
      `- 部分通过：${input.score.caseSummary.partial}`,
      `- 失败：${input.score.caseSummary.failed}`,
      `- 阻塞：${input.score.caseSummary.blocked}`,
    ].join('\n'),
    'evidence.md': [
      '# Evidence',
      '',
      evidenceRows || '暂无证据。',
    ].join('\n'),
  };
}
