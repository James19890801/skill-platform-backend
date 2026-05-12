import assert from 'node:assert/strict';
import { test } from 'node:test';
import JSZip from 'jszip';
import {
  buildKnowledgeSearchTerms,
  chunkText,
  cosineSimilarity,
  extractTextFromDocument,
  inferProcessMetadata,
  rankKnowledgeChunks,
} from '../src/knowledge/knowledge-pipeline';

test('chunkText creates overlapping searchable chunks', () => {
  const text = [
    '第一段说明合同背景和付款安排，包含付款节点、付款凭证、审批责任人与例外处理规则。',
    '第二段说明违约责任、赔偿范围和争议解决，包含延期交付、质量缺陷和保密义务。',
    '第三段说明交付物、验收标准和归档要求，包含验收记录、版本留痕和后续审计。',
  ].join('\n\n');

  const chunks = chunkText(text, {
    chunkSize: 90,
    chunkOverlap: 12,
    metadata: { documentName: '合同审查.md' },
  });

  assert.ok(chunks.length >= 2);
  assert.equal(chunks[0].index, 0);
  assert.equal(chunks[0].metadata.documentName, '合同审查.md');
  assert.ok(chunks.every((chunk) => chunk.content.length <= 110));
});

test('chunkText preserves section metadata for explainable chunks', () => {
  const text = [
    '# 付款流程',
    '申请人提交付款申请，财务复核发票和合同。',
    '审批通过后安排付款。',
    '',
    '# 归档要求',
    '付款完成后，需要把合同、发票、审批记录归档。',
  ].join('\n');

  const chunks = chunkText(text, { chunkSize: 90, chunkOverlap: 12 });

  assert.ok(chunks.some((chunk) => chunk.metadata.sectionTitle === '付款流程'));
  assert.ok(chunks.some((chunk) => chunk.metadata.sectionTitle === '归档要求'));
  assert.ok(chunks.every((chunk) => typeof chunk.metadata.start === 'number'));
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
    { queryText: '付款违约责任' },
  );

  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].id, 1);
  assert.equal(ranked[1].id, 3);
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
});

test('buildKnowledgeSearchTerms extracts useful Chinese process terms', () => {
  const terms = buildKnowledgeSearchTerms('付款申请流程怎么走，需要哪些审批材料？');

  assert.ok(terms.includes('付款申请'));
  assert.ok(terms.includes('付款'));
  assert.ok(terms.includes('申请'));
  assert.ok(terms.includes('审批'));
  assert.ok(!terms.includes('怎么'));
});

test('inferProcessMetadata extracts process fields for filtering', () => {
  const metadata = inferProcessMetadata(
    [
      '流程编号：FIN-PAY-001',
      '流程名称：付款申请流程',
      '适用部门：财务部、采购部',
      '版本：V2.1',
      '当前状态：现行',
    ].join('\n'),
    '财务域-付款申请流程-V2.1.docx',
  );

  assert.equal(metadata.processCode, 'FIN-PAY-001');
  assert.equal(metadata.processName, '付款申请流程');
  assert.equal(metadata.domain, '财务域');
  assert.equal(metadata.version, 'V2.1');
  assert.equal(metadata.status, '现行');
  assert.deepEqual(metadata.departments, ['财务部', '采购部']);
});
