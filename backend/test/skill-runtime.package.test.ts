import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildSkillPackage,
  buildSkillWorkspaceId,
  resolveSkillCandidates,
} from '../src/skill-runtime/skill-package';
import {
  createRuntimeEvent,
  filterEventsAfter,
  toSseFrame,
} from '../src/skill-runtime/runtime-events';
import { normalizeQueueConcurrency } from '../src/skill-runtime/runtime-queue';

const baseSkill = {
  id: 12,
  namespace: 'legal.contract.risk-check',
  name: '合同风险快筛',
  domain: 'legal',
  subDomain: 'contract',
  abilityName: '风险识别',
  description: '识别合同中的高风险条款',
  currentVersion: '1.2.3',
  content: '# 执行步骤\n1. 提取关键条款\n2. 输出风险分级',
  agentPrompt: '',
  files: JSON.stringify([
    {
      name: 'templates/report.md',
      type: 'template',
      content: '# 风险报告',
    },
  ]),
  toolDefinition: JSON.stringify({
    type: 'function',
    function: {
      name: 'contract_risk_extract',
      description: '提取合同风险',
      parameters: { type: 'object', properties: {} },
    },
  }),
};

test('buildSkillPackage turns a legacy database skill into a runnable package', () => {
  const pkg = buildSkillPackage(baseSkill);

  assert.equal(pkg.id, 'legal.contract.risk-check');
  assert.equal(pkg.version, '1.2.3');
  assert.equal(pkg.instructions, baseSkill.content);
  assert.equal(pkg.files[0].path, 'templates/report.md');
  assert.equal(pkg.tools[0].function.name, 'contract_risk_extract');
  assert.equal(pkg.permissions.network, 'none');
  assert.match(pkg.packageHash, /^[a-f0-9]{64}$/);
});

test('buildSkillPackage honors explicit manifest policy and trigger rules', () => {
  const pkg = buildSkillPackage({
    ...baseSkill,
    manifest: JSON.stringify({
      id: 'legal.contract.risk-check',
      version: '2.0.0',
      runtime: {
        permissions: { network: 'allowlist', domains: ['api.example.com'] },
        maxRounds: 6,
      },
      triggers: [
        { type: 'keyword', value: '合同' },
        { type: 'keyword', value: '风险' },
      ],
    }),
  });

  assert.equal(pkg.version, '2.0.0');
  assert.equal(pkg.permissions.network, 'allowlist');
  assert.deepEqual(pkg.permissions.domains, ['api.example.com']);
  assert.equal(pkg.maxRounds, 6);
  assert.equal(pkg.triggers.length, 2);
});

test('resolveSkillCandidates prefers explicit namespace before fuzzy matches', () => {
  const resolved = resolveSkillCandidates(
    [
      buildSkillPackage(baseSkill),
      buildSkillPackage({
        ...baseSkill,
        id: 13,
        namespace: 'finance.invoice.audit',
        name: '发票审核',
        domain: 'finance',
        subDomain: 'invoice',
        abilityName: '发票校验',
        description: '审核发票金额、税号和抬头',
      }),
    ],
    {
      input: '请用 legal.contract.risk-check 帮我看一下合同风险',
      explicitSkills: ['legal.contract.risk-check'],
      limit: 3,
    },
  );

  assert.equal(resolved[0].id, 'legal.contract.risk-check');
  assert.equal(resolved[0].matchReason, 'explicit');
});

test('buildSkillWorkspaceId is stable and filesystem safe', () => {
  assert.equal(buildSkillWorkspaceId(42, 7, 'thread:/abc'), 'skill_42_exec_7_thread__abc');
});

test('runtime events can be resumed after the last delivered sequence', () => {
  const events = [
    createRuntimeEvent({ executionId: 9, skillId: 12, sequence: 1, eventType: 'skill.started', payload: { ok: true } }),
    createRuntimeEvent({ executionId: 9, skillId: 12, sequence: 2, eventType: 'skill.step', payload: { step: 'load' } }),
    createRuntimeEvent({ executionId: 9, skillId: 12, sequence: 3, eventType: 'skill.completed', payload: { status: 'completed' } }),
  ];

  const resumed = filterEventsAfter(events, 2);

  assert.equal(resumed.length, 1);
  assert.equal(resumed[0].sequence, 3);
  assert.match(toSseFrame(resumed[0]), /^id: 3\nevent: skill\.completed\n/u);
});

test('queue concurrency never drops below one worker', () => {
  assert.equal(normalizeQueueConcurrency(undefined), 1);
  assert.equal(normalizeQueueConcurrency('0'), 1);
  assert.equal(normalizeQueueConcurrency('3'), 3);
});
