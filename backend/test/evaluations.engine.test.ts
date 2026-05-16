import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildBenchmarkArtifacts,
  computeEvaluationScore,
  normalizeGeneratedEvaluationCases,
} from '../src/evaluations/evaluation-engine';

test('model-generated skill evaluation cases are normalized without template data', () => {
  const cases = normalizeGeneratedEvaluationCases([
    {
      caseKey: 'skill-live-001',
      category: 'execution',
      stage: 'S1',
      level: 'L2',
      input: '请对这份合同做风险快筛，并输出风险等级、依据和建议。',
      expected: '应按 Skill 定义完成合同风险识别，输出结构化风险清单。',
      labels: { rubric: '执行完整性、输出质量、证据意识' },
      assertions: [{ type: 'rubric_llm', threshold: 80 }],
      weight: 3,
      priority: 'P0',
    },
  ], {
    targetType: 'skill',
    targetId: 42,
    targetName: '合同风险快筛',
    description: '识别合同中的高风险条款，并输出分级建议',
    metadata: {
      namespace: 'legal.contract.risk-check',
      domain: 'legal',
      version: '1.2.0',
    },
  });

  assert.equal(cases.length, 1);
  assert.ok(cases.some((item) => item.category === 'execution'));
  assert.equal(cases[0].labels.targetType, 'skill');
  assert.equal(cases[0].input.includes('合同'), true);
});

test('weighted evaluation score uses reviewed case results and assigns a grade', () => {
  const score = computeEvaluationScore([
    { status: 'passed', score: 100, weight: 2 },
    { status: 'partial', score: 60, weight: 1 },
    { status: 'failed', score: 0, weight: 1 },
  ]);

  assert.equal(score.totalScore, 65);
  assert.equal(score.grade, '需改进');
  assert.equal(score.caseSummary.total, 3);
  assert.equal(score.caseSummary.passed, 1);
  assert.equal(score.caseSummary.partial, 1);
  assert.equal(score.caseSummary.failed, 1);
});

test('benchmark artifacts include method, cases, scores, report, and evidence', () => {
  const artifacts = buildBenchmarkArtifacts({
    benchmarkId: 9,
    benchmarkName: '合同风险快筛 L2 Benchmark',
    version: '2026.05.16',
    targetType: 'skill',
    targetId: 42,
    targetName: '合同风险快筛',
    runId: 88,
    score: {
      totalScore: 92,
      grade: '优秀',
      caseSummary: { total: 1, passed: 1, partial: 0, failed: 0, blocked: 0 },
      dimensions: {},
    },
    cases: [
      {
        id: 101,
        caseKey: 'skill-execution-001',
        category: 'execution',
        input: '请识别这份合同中的高风险条款',
        expected: '应输出风险等级、依据和建议',
        weight: 1,
      },
    ],
    results: [
      {
        caseId: 101,
        status: 'passed',
        score: 100,
        evidence: '输出包含风险等级、依据和建议',
      },
    ],
  });

  assert.deepEqual(Object.keys(artifacts).sort(), [
    'benchmark-card.md',
    'cases.jsonl',
    'evidence.md',
    'method.md',
    'report.md',
    'scores.json',
  ]);
  assert.match(artifacts['benchmark-card.md'], /合同风险快筛 L2 Benchmark/);
  assert.match(artifacts['cases.jsonl'], /skill-execution-001/);
  assert.match(artifacts['scores.json'], /"total_score": 92/);
  assert.equal(JSON.stringify(artifacts).includes('Skill'), true);
});
