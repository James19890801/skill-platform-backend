import assert from 'node:assert/strict';
import test from 'node:test';
import { AiService } from '../src/ai/ai.service';

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
