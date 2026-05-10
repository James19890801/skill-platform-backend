import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import {
  chunkText,
  cosineSimilarity,
  extractTextFromDocument,
  rankKnowledgeChunks,
} from '../src/knowledge/knowledge-pipeline';

test('chunkText creates overlapping searchable chunks', () => {
  const text = [
    '第一段说明合同背景和付款安排。',
    '第二段说明违约责任、赔偿范围和争议解决。',
    '第三段说明交付物、验收标准和归档要求。',
  ].join('\n\n');

  const chunks = chunkText(text, {
    chunkSize: 34,
    chunkOverlap: 8,
    metadata: { documentName: '合同审查.md' },
  });

  assert.ok(chunks.length >= 2);
  assert.equal(chunks[0].index, 0);
  assert.equal(chunks[0].metadata.documentName, '合同审查.md');
  assert.ok(chunks.every((chunk) => chunk.content.length <= 42));
});

test('extractTextFromDocument reads text from pptx openxml files', async () => {
  const zip = new JSZip();
  zip.file('ppt/slides/slide1.xml', '<p:sld><a:t>第一章 项目背景</a:t><a:t>关键结论</a:t></p:sld>');
  zip.file('ppt/slides/slide2.xml', '<p:sld><a:t>第二章 行动计划</a:t></p:sld>');

  const text = await extractTextFromDocument(
    await zip.generateAsync({ type: 'nodebuffer' }),
    'roadmap.pptx',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  );

  assert.match(text, /第一章 项目背景/);
  assert.match(text, /关键结论/);
  assert.match(text, /第二章 行动计划/);
});

test('rankKnowledgeChunks returns cosine-ranked context', () => {
  const ranked = rankKnowledgeChunks(
    [
      { id: 1, content: '合同风险和违约责任', embedding: [1, 0, 0] },
      { id: 2, content: '员工培训计划', embedding: [0, 1, 0] },
      { id: 3, content: '付款条款和发票', embedding: [0.8, 0.1, 0] },
    ],
    [1, 0, 0],
    2,
  );

  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].id, 1);
  assert.equal(ranked[1].id, 3);
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
});
