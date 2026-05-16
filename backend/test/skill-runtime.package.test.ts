import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import {
  buildSkillPackage,
  buildSkillPackageZip,
  buildSkillWorkspaceId,
  normalizeToolDefinitionList,
  parseSkillPackageZip,
  resolveSkillCandidates,
} from '../src/skill-runtime/skill-package';
import { buildAgentSkillLookupClause, normalizeAgentSkillBindings } from '../src/ai/skill-binding';
import {
  buildCapabilityTreeSnapshot,
  collectSkillNamespacesFromSnapshot,
} from '../src/capabilities/capability-tree';
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

test('legacy tool definitions are normalized into OpenAI-compatible tools', () => {
  const tools = normalizeToolDefinitionList(JSON.stringify([
    {
      name: 'search_web',
      description: '搜索网络获取最新法律法规参考',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string' },
        },
        required: ['query'],
      },
    },
  ]));

  assert.deepEqual(tools, [
    {
      type: 'function',
      function: {
        name: 'search_web',
        description: '搜索网络获取最新法律法规参考',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string' },
          },
          required: ['query'],
        },
      },
    },
  ]);
});

test('agent skill bindings are matched by namespace before legacy names', () => {
  const bindings = normalizeAgentSkillBindings([
    'legal.contract.risk-check',
    '合同条款风险识别',
    'legal.contract.risk-check',
    '',
  ]);
  const lookup = buildAgentSkillLookupClause(bindings);

  assert.deepEqual(bindings, ['legal.contract.risk-check', '合同条款风险识别']);
  assert.equal(
    lookup?.clause,
    '(skill.namespace IN (:...skillBindings) OR skill.name IN (:...skillBindings))',
  );
  assert.deepEqual(lookup?.params, {
    skillBindings: ['legal.contract.risk-check', '合同条款风险识别'],
  });
});

test('capability tree snapshots preserve parent-child Skill structure', () => {
  const snapshot = buildCapabilityTreeSnapshot([
    { id: 1, parentId: null, nodeType: 'domain', label: '法务合规', domain: 'legal', orderIndex: 0 },
    { id: 2, parentId: 1, nodeType: 'stage', label: '合同审查', domain: 'legal', subDomain: 'contract', orderIndex: 0 },
    {
      id: 3,
      parentId: 2,
      nodeType: 'skill',
      label: '合同条款风险识别',
      skillId: 12,
      namespace: 'legal.contract.risk-check',
      orderIndex: 0,
    },
  ]);

  assert.equal(snapshot.length, 1);
  assert.equal(snapshot[0].children[0].children[0].namespace, 'legal.contract.risk-check');
  assert.deepEqual(collectSkillNamespacesFromSnapshot(snapshot), ['legal.contract.risk-check']);
});

test('buildSkillPackageZip emits the standard multi-file skill bundle', async () => {
  const pkg = buildSkillPackage({
    ...baseSkill,
    files: JSON.stringify([
      {
        name: 'report.md',
        path: 'templates/report.md',
        type: 'templates',
        content: '# 风险报告',
      },
      {
        name: 'policy.md',
        path: 'references/policy.md',
        type: 'references',
        content: '合同审查红线',
      },
    ]),
  });

  assert.equal(pkg.files[0].type, 'template');
  assert.equal(pkg.files[1].type, 'reference');

  const zipBuffer = await buildSkillPackageZip(pkg);
  const zip = await JSZip.loadAsync(zipBuffer);

  assert.ok(zip.file('SKILL.md'), 'zip should contain root SKILL.md');
  assert.ok(zip.file('skill.json'), 'zip should contain package manifest');
  assert.ok(zip.file('templates/report.md'), 'zip should contain template files');
  assert.ok(zip.file('references/policy.md'), 'zip should contain reference files');
  assert.equal(await zip.file('SKILL.md')!.async('string'), baseSkill.content);

  const manifest = JSON.parse(await zip.file('skill.json')!.async('string'));
  assert.equal(manifest.namespace, 'legal.contract.risk-check');
  assert.equal(manifest.entrypoint, 'SKILL.md');
  assert.deepEqual(manifest.files.map((file: any) => file.path), [
    'templates/report.md',
    'references/policy.md',
  ]);
});

test('parseSkillPackageZip turns an uploaded bundle into a skill draft', async () => {
  const zip = new JSZip();
  zip.file('SKILL.md', '# 上传版 Skill\n\n## 执行步骤\n1. 检查材料');
  zip.file('skill.json', JSON.stringify({
    namespace: 'finance.report.weekly',
    name: '周报生成',
    description: '生成结构化经营周报',
    domain: 'finance',
    subDomain: 'report',
    abilityName: '周报生成',
    version: '1.0.0',
    triggers: [{ type: 'keyword', value: '周报' }],
  }));
  zip.file('templates/report.md', '# 周报模板');
  zip.file('references/rules.md', '经营分析规则');

  const draft = await parseSkillPackageZip(await zip.generateAsync({ type: 'nodebuffer' }));

  assert.equal(draft.namespace, 'finance.report.weekly');
  assert.equal(draft.name, '周报生成');
  assert.equal(draft.content, '# 上传版 Skill\n\n## 执行步骤\n1. 检查材料');
  assert.equal(draft.currentVersion, '1.0.0');
  assert.equal(draft.files.length, 2);
  assert.equal(draft.files[0].type, 'template');
  assert.equal(draft.files[1].type, 'reference');
  assert.deepEqual(JSON.parse(draft.triggerRules), [{ type: 'keyword', value: '周报' }]);
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
