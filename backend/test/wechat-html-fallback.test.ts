import assert from 'node:assert/strict';
import test from 'node:test';
import { SkillExecutorService } from '../src/ai/skill-executor.service';

function makeExecutor() {
  return new SkillExecutorService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
}

test('wechat long-form execution forces HTML generation when the model returns plain text', async () => {
  const service = makeExecutor() as any;
  const artifacts: Array<{ name: string; path: string; type: string; size: number }> = [];
  const calls: string[] = [];
  let qualityChecks = 0;

  service.evaluateHtmlArtifacts = async () => {
    qualityChecks += 1;
    return qualityChecks === 1
      ? { ok: false, reason: '没有生成 HTML 文件' }
      : { ok: true, reason: '通过' };
  };
  service.forceGenerateLongFormHtml = async () => {
    calls.push('force');
    return '<!doctype html><html><body>完整公众号 HTML</body></html>';
  };
  service.saveFinalArtifacts = async (_output: string, _threadId: string, targetArtifacts: typeof artifacts) => {
    calls.push('save');
    targetArtifacts.push({ name: 'skill_output.html', path: 'skill_output.html', type: 'file', size: 20000 });
  };
  service.tryRepairLongFormHtml = async () => {
    throw new Error('forced HTML passed quality, repair should not run');
  };

  const result = await service.ensureLongFormHtmlArtifacts({
    pkg: { name: '公众号写作', namespace: 'wechat_article_writer' },
    userInput: '写一篇长公众号',
    finalOutput: '这是一段普通文字，不是 HTML。',
    messages: [],
    threadId: 'thread-wechat-fallback',
    artifacts,
    addLog: () => undefined,
    execution: {},
    execId: 7,
    skillId: 70,
  });

  assert.equal(result.quality.ok, true);
  assert.match(result.finalOutput, /<html/i);
  assert.deepEqual(calls, ['force', 'save']);
  assert.equal(artifacts.length, 1);
});

test('wechat long-form execution prunes failed HTML artifacts after repair succeeds', async () => {
  const service = makeExecutor() as any;
  const artifacts = [
    { name: 'skill_output.html', path: 'skill_output.html', type: 'file', size: 12000 },
  ];
  let qualityChecks = 0;
  let pruned = false;

  service.evaluateHtmlArtifacts = async () => {
    qualityChecks += 1;
    return qualityChecks === 1
      ? { ok: false, reason: 'skill_output.html: 文件过小 12000B < 18000B' }
      : { ok: true, reason: '通过' };
  };
  service.tryRepairLongFormHtml = async () => {
    artifacts.push({ name: 'skill_output_repaired.html', path: 'skill_output_repaired.html', type: 'file', size: 22000 });
    return '<!doctype html><html><body>修复后的合格 HTML</body></html>';
  };
  service.retainPassingHtmlArtifacts = async (_threadId: string, targetArtifacts: typeof artifacts) => {
    pruned = true;
    targetArtifacts.splice(0, targetArtifacts.length, targetArtifacts[1]);
  };

  const result = await service.ensureLongFormHtmlArtifacts({
    pkg: { name: '公众号写作', namespace: 'wechat_article_writer' },
    userInput: '写一篇长公众号',
    finalOutput: '<!doctype html><html><body>过短 HTML</body></html>',
    messages: [],
    threadId: 'thread-wechat-repair',
    artifacts,
    addLog: () => undefined,
    execution: {},
    execId: 8,
    skillId: 70,
  });

  assert.equal(result.quality.ok, true);
  assert.equal(pruned, true);
  assert.deepEqual(artifacts.map((artifact) => artifact.name), ['skill_output_repaired.html']);
});
