import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { ProductWikiService } from '../src/product-wiki/product-wiki.service';

function withTempWiki(files: Record<string, string>, run: (root: string) => Promise<void> | void) {
  const root = mkdtempSync(join(tmpdir(), 'product-wiki-'));
  const previousRoots = process.env.PRODUCT_WIKI_ROOTS;
  const previousTtl = process.env.PRODUCT_WIKI_INDEX_TTL_MS;
  process.env.PRODUCT_WIKI_ROOTS = root;
  process.env.PRODUCT_WIKI_INDEX_TTL_MS = '0';
  for (const [name, content] of Object.entries(files)) {
    const filePath = join(root, name);
    writeFileSync(filePath, content, 'utf8');
  }
  return Promise.resolve(run(root)).finally(() => {
    if (previousRoots === undefined) delete process.env.PRODUCT_WIKI_ROOTS;
    else process.env.PRODUCT_WIKI_ROOTS = previousRoots;
    if (previousTtl === undefined) delete process.env.PRODUCT_WIKI_INDEX_TTL_MS;
    else process.env.PRODUCT_WIKI_INDEX_TTL_MS = previousTtl;
    rmSync(root, { recursive: true, force: true });
  });
}

test('product wiki search ranks README descriptions before unrelated source files', async () => {
  await withTempWiki({
    'README.md': [
      '# 产品 Wiki',
      '',
      '全局浮标可以回答产品功能、接口、知识库和智能体运行方式。',
      '',
      '## 接口',
      'POST /api/product-wiki/ask 用于基于产品 wiki 回答问题。',
    ].join('\n'),
    'chat.ts': [
      'export class ChatService {',
      '  send(message: string) { return message; }',
      '}',
    ].join('\n'),
  }, async () => {
    const service = new ProductWikiService(undefined as any);

    const result = await service.search('产品 wiki 浮标怎么问接口', { topK: 2 });

    assert.equal(result.sources[0].path, 'README.md');
    assert.match(result.context, /POST \/api\/product-wiki\/ask/);
    assert.ok(result.index.documentCount >= 2);
  });
});

test('product wiki index refreshes when a published file changes', async () => {
  await withTempWiki({
    'README.md': '旧版说明：只有工作台。',
  }, async (root) => {
    const service = new ProductWikiService(undefined as any);
    const first = await service.search('评测中心', { topK: 1 });
    assert.equal(first.sources.length, 1);
    assert.doesNotMatch(first.context, /评测中心/);

    writeFileSync(join(root, 'README.md'), '新版说明：新增评测中心和监控看板。', 'utf8');
    const second = await service.search('评测中心', { topK: 1 });

    assert.match(second.context, /评测中心/);
  });
});
