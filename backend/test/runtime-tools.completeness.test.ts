import assert from 'node:assert/strict';
import test from 'node:test';
import { AiService } from '../src/ai/ai.service';
import { ToolBridgeService } from '../src/ai/tool-bridge.service';

function makeAiService(): AiService {
  return new AiService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
}

function zipHas(buffer: Buffer, entryName: string): boolean {
  return buffer.toString('latin1').includes(entryName);
}

test('local runtime exposes the core production tool set', async () => {
  process.env.AGENT_RUNTIME_URL = 'http://127.0.0.1:1';
  const bridge = new ToolBridgeService();

  const tools = await bridge.getTools();
  const names = new Set(tools.map((tool) => tool.function.name));

  for (const expected of [
    'search_web',
    'bing_search',
    'execute_python',
    'generate_document',
    'generate_presentation',
    'generate_html_report',
  ]) {
    assert.equal(names.has(expected), true, `missing required tool: ${expected}`);
  }

  const documentTool = tools.find((tool) => tool.function.name === 'generate_document');
  const formats = documentTool?.function.parameters.properties.format.enum || [];
  assert.deepEqual(formats.sort(), ['docx', 'pptx', 'xlsx'].sort());
});

test('tool bridge respects an explicit deployed agent runtime URL', () => {
  process.env.AGENT_RUNTIME_URL = 'https://agent-runtime-production-f460.up.railway.app';
  const bridge = new ToolBridgeService();

  assert.equal((bridge as any).agentRuntimeUrl, 'https://agent-runtime-production-f460.up.railway.app');
});

test('document generator emits real Word, Excel, and PowerPoint packages', async () => {
  const service = makeAiService();
  const markdown = [
    '# 运行时验收',
    '## 数据表',
    '| 能力 | 状态 |',
    '| --- | --- |',
    '| Word | OK |',
    '| Excel | OK |',
    '| PPT | OK |',
    '',
    '## 结论',
    '运行时需要输出真实 Office 文件，而不是改后缀。',
  ].join('\n');

  const docx = await service.generateDocx(markdown, 'docx');
  assert.equal(zipHas(docx, 'word/document.xml'), true);

  const xlsx = await service.generateDocx(markdown, 'xlsx');
  assert.equal(zipHas(xlsx, 'xl/workbook.xml'), true);
  assert.equal(zipHas(xlsx, 'word/document.xml'), false);

  const pptx = await service.generateDocx(markdown, 'pptx' as any);
  assert.equal(zipHas(pptx, 'ppt/presentation.xml'), true);
  assert.equal(zipHas(pptx, 'word/document.xml'), false);
});
