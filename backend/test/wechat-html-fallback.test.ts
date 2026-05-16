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
