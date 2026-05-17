import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AiService,
  buildChatToolRouting,
  filterToolsForChatIntent,
} from '../src/ai/ai.service';

function makeAiService() {
  return new AiService(
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
  );
}

test('runtime context injects current date and latest-information search rule', () => {
  const service = makeAiService();
  const context = (service as any).buildRuntimeContext();

  assert.match(context, /当前日期时间/);
  assert.match(context, /当前 UTC 时间/);
  assert.match(context, /必须优先调用联网搜索工具确认最新信息/);
});

test('chat tool routing keeps ordinary conversation tool-free', () => {
  const routing = buildChatToolRouting('你好，帮我解释一下流程架构是什么。');

  assert.equal(routing.shouldUseTools, false);
  assert.equal(routing.allowSkillTool, false);
  assert.deepEqual(routing.allowedToolNames, []);
});

test('chat tool routing does not execute tools for SQL drafting requests', () => {
  const routing = buildChatToolRouting('帮我写一段 SQL，查询本月订单金额最高的客户。');

  assert.equal(routing.shouldUseTools, false);
  assert.equal(routing.reason, 'conversation');
});

test('chat tool routing allows execution tools only for explicit SQL run intent', () => {
  const routing = buildChatToolRouting('运行这段 SQL：select count(*) from orders;');

  assert.equal(routing.shouldUseTools, true);
  assert.equal(routing.reason, 'code_execution');
  assert.equal(routing.allowedToolNames.includes('execute_python'), true);
});

test('chat tool routing exposes skill tool only for explicit skill invocation', () => {
  const routing = buildChatToolRouting('调用 Skill 公众号写作：写一篇新品发布文章。');

  assert.equal(routing.allowSkillTool, true);
  assert.equal(routing.shouldUseTools, true);
  assert.equal(routing.reason, 'skill');
});

test('chat tool filter removes unsafe execution tools from normal search intents', () => {
  const tools = [
    { type: 'function', function: { name: 'search_web' } },
    { type: 'function', function: { name: 'execute_python' } },
    { type: 'function', function: { name: 'generate_document' } },
  ];
  const routing = buildChatToolRouting('今天有什么最新政策变化？');

  const filtered = filterToolsForChatIntent(tools as any, routing);

  assert.deepEqual(filtered.map((tool: any) => tool.function.name), ['search_web']);
});
