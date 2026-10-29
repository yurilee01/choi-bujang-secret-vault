import assert from 'node:assert/strict';
import { test } from 'node:test';

const { default: handler } = await import('../api/notes.js');

function mockResponse() {
  const headers = new Map();
  let statusCode;
  let body;

  return {
    headers,
    get statusCode() { return statusCode; },
    get body() { return body; },
    setHeader(name, value) { headers.set(name.toLowerCase(), value); },
    status(code) {
      statusCode = code;
      return {
        json(value) { body = value; },
      };
    },
  };
}

test('GET이 아닌 요청은 405로 거절한다', async () => {
  const response = mockResponse();
  await handler({ method: 'POST' }, response);

  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.get('allow'), 'GET');
  assert.deepEqual(response.body, { error: 'METHOD_NOT_ALLOWED' });
});

test('환경변수가 없으면 500으로 거절한다', async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SECRET_KEY;

  try {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;

    const response = mockResponse();
    await handler({ method: 'GET' }, response);

    assert.equal(response.statusCode, 500);
    assert.deepEqual(response.body, { error: 'SERVER_CONFIGURATION_ERROR' });
  } finally {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;

    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = oldKey;
  }
});
