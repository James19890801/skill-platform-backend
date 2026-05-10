import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeUploadedFilename } from '../src/knowledge/filename';

test('normalizeUploadedFilename repairs Chinese names decoded as latin1', () => {
  const mojibake = Buffer.from('流程文档.docx', 'utf8').toString('latin1');

  assert.equal(normalizeUploadedFilename(mojibake), '流程文档.docx');
});

test('normalizeUploadedFilename preserves readable unicode and accented filenames', () => {
  assert.equal(normalizeUploadedFilename('流程文档.docx'), '流程文档.docx');
  assert.equal(normalizeUploadedFilename('résumé.pdf'), 'résumé.pdf');
});

test('normalizeUploadedFilename removes unsafe path/control parts', () => {
  assert.equal(normalizeUploadedFilename('../目录/流程文档\u0000.txt'), '流程文档.txt');
  assert.equal(normalizeUploadedFilename(''), '未命名文件');
});
