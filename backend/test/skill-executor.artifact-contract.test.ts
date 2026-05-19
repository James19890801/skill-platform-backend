import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SkillExecutorService } from '../src/ai/skill-executor.service';
import { buildSkillPackage } from '../src/skill-runtime/skill-package';

const baseSkill = {
  id: 301,
  namespace: 'content.wechat.article',
  name: '公众号写作',
  domain: 'content',
  subDomain: 'wechat',
  abilityName: '公众号文章生成',
  description: '创作高质量公众号文章并输出可一键复制的 HTML。',
  currentVersion: '1.0.0',
  content: '# 公众号写作\n\n必须输出完整 HTML，包含一键复制和移动端排版。',
  agentPrompt: '',
};

function makeService(executionService?: any): SkillExecutorService {
  const workspaceService = {
    writeFile: async (_threadId: string, filename: string, content: string | Buffer, mimeType?: string) => ({
      name: filename,
      path: filename,
      type: 'file',
      size: Buffer.isBuffer(content) ? content.length : Buffer.byteLength(content),
      mimeType,
    }),
  };

  return new SkillExecutorService(
    {} as any,
    {} as any,
    {} as any,
    workspaceService as any,
    {} as any,
    {} as any,
    executionService as any,
  );
}

test('artifact contract fails when a required HTML artifact is missing', () => {
  const service = makeService();
  const pkg = buildSkillPackage(baseSkill);

  const validation = (service as any).validateOutputContract(pkg, [], '我已经完成了文章。');

  assert.equal(validation.ok, false);
  assert.match(validation.message, /缺少 HTML 交付物/);
});

test('artifact contract accepts a sufficiently sized HTML artifact', () => {
  const service = makeService();
  const pkg = buildSkillPackage(baseSkill);
  const html = '<!DOCTYPE html><html><body>' + '内容'.repeat(800) + '</body></html>';

  const validation = (service as any).validateOutputContract(pkg, [
    { name: 'wechat.html', path: 'wechat.html', type: 'file', size: Buffer.byteLength(html), mimeType: 'text/html' },
  ], html);

  assert.equal(validation.ok, true);
});

test('HTML artifact extraction removes markdown fences before saving', () => {
  const service = makeService();
  const output = [
    '下面是完整 HTML：',
    '```html',
    '<!DOCTYPE html><html><body><h1>标题</h1></body></html>',
    '```',
  ].join('\n');

  const html = (service as any).extractHtmlArtifact(output);

  assert.equal(html, '<!DOCTYPE html><html><body><h1>标题</h1></body></html>');
});

test('SkillExecutor runs local HTML report tools against the workspace', async () => {
  const service = makeService();
  const html = '<!DOCTYPE html><html><body>hello</body></html>';

  const result = await (service as any).executeLocalSkillTool('generate_html_report', {
    title: '公众号文章',
    html,
  }, 'thread-a');

  assert.equal(result.success, true);
  assert.equal(result.result.workspaceFile.name, '公众号文章.html');
  assert.equal(result.result.workspaceFile.mimeType, 'text/html');
  assert.equal(result.result.workspaceFile.size, Buffer.byteLength(html));
});

test('SkillExecutor runs local search tools instead of accepting _local placeholders', async () => {
  const service = makeService({
    searchWeb: async () => ({
      success: true,
      output: JSON.stringify([{ title: 'source', url: 'https://example.com' }]),
    }),
  });

  const result = await (service as any).executeLocalSkillTool('search_web', {
    query: '公众号写作 AI 流程管理',
  }, 'thread-a');

  assert.equal(result.success, true);
  assert.equal(result.result.results[0].title, 'source');
});
