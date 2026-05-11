import assert from 'node:assert/strict';
import test from 'node:test';
import { PayloadTooLargeException } from '@nestjs/common';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';

function makeHost() {
  const result: { statusCode?: number; body?: any } = {};
  const response = {
    status(code: number) {
      result.statusCode = code;
      return response;
    },
    json(body: any) {
      result.body = body;
      return response;
    },
  };
  const host = {
    switchToHttp() {
      return {
        getResponse: () => response,
      };
    },
  };
  return { host: host as any, result };
}

test('exception filter maps multer file-size failures to 413', () => {
  const { host, result } = makeHost();

  new AllExceptionsFilter().catch({
    name: 'MulterError',
    code: 'LIMIT_FILE_SIZE',
    message: 'File too large',
  }, host);

  assert.equal(result.statusCode, 413);
  assert.equal(result.body.success, false);
  assert.match(result.body.message, /上传上限/);
});

test('exception filter preserves explicit payload-too-large messages', () => {
  const { host, result } = makeHost();

  new AllExceptionsFilter().catch(
    new PayloadTooLargeException('文件大小 90MB 超过当前单文件上限 80MB'),
    host,
  );

  assert.equal(result.statusCode, 413);
  assert.match(result.body.message, /90MB/);
});
