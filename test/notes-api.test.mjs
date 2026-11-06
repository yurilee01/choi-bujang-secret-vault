
import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createNotesHandler } from '../api/notes.js';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

const A_NOTE = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  owner_id: A,
  title: 'A 메모',
  body: 'A의 비밀 자료',
};

const B_NOTE = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  owner_id: B,
  title: 'B 메모',
  body: 'B의 비밀 자료',
};

function mockResponse() {
  const headers = new Map();
  let statusCode;
  let body;

  return {
    headers,
    get statusCode() { return statusCode; },
    get body() { return body; },

    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },

    status(code) {
      statusCode = code;

      return {
        json(value) {
          body = value;
          return this;
        },
      };
    },
  };
}

function createMockDatabase(initialNotes = [A_NOTE, B_NOTE]) {
  const notes = structuredClone(initialNotes);

  return {
    notes,

    client() {
      return {
        from(table) {
          assert.equal(table, 'notes');

          let action = 'select';
          let filters = {};
          let updateValues = null;
          let selected = false;
          let selectedColumns = null;

          const query = {
            select(columns) {
              selected = true;
              selectedColumns = columns
                ? columns.split(',').map((column) => column.trim())
                : null;

              return query;
            },

            eq(column, value) {
              filters[column] = value;
              return query;
            },

            insert(value) {
              action = 'insert';
              updateValues = value;
              return query;
            },

            update(value) {
              action = 'update';
              updateValues = value;
              return query;
            },

            delete() {
              action = 'delete';
              return query;
            },

            async maybeSingle() {
              const result = await execute();

              return {
                data: result.data?.[0] ?? null,
                error: null,
              };
            },

            async single() {
              const result = await execute();

              return {
                data: result.data?.[0] ?? null,
                error: null,
              };
            },

            then(resolve, reject) {
              return execute().then(resolve, reject);
            },
          };

          function project(rows) {
            if (!selectedColumns) return rows;

            return rows.map((note) =>
              Object.fromEntries(
                selectedColumns.map((column) => [
                  column,
                  note[column],
                ])
              )
            );
          }

          async function execute() {
            if (action === 'insert') {
              const note = {
                ...updateValues,
                id: updateValues.id ??
                  'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
              };

              notes.push(note);

              return {
                data: project([note]),
                error: null,
              };
            }

            const matches = notes.filter((note) =>
              Object.entries(filters).every(
                ([column, value]) => note[column] === value
              )
            );

            if (action === 'update') {
              for (const note of matches) {
                Object.assign(note, updateValues);
              }

              return {
                data: selected ? project(matches) : null,
                error: null,
              };
            }

            if (action === 'delete') {
              for (const note of matches) {
                notes.splice(notes.indexOf(note), 1);
              }

              return {
                data: selected ? project(matches) : null,
                error: null,
              };
            }

            return {
              data: project(matches),
              error: null,
            };
          }

          return query;
        },
      };
    },
  };
}

function makeHandler(userId, database) {
  return createNotesHandler({
    verifyLogin: async (authorization) => {
      if (authorization === 'Bearer test-token') {
        return { userId };
      }

      return null;
    },

    createSupabaseClient: () => database.client(),
  });
}

async function call(handler, request) {
  const response = mockResponse();

  await handler({
    headers: { authorization: 'Bearer test-token' },
    ...request,
  }, response);

  return response;
}

const originalUrl = process.env.SUPABASE_URL;
const originalKey = process.env.SUPABASE_SECRET_KEY;

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-secret-key';

test('인증 헤더가 없으면 401 JSON으로 거절한다', async () => {
  const handler = createNotesHandler();
  const response = mockResponse();

  await handler({ method: 'GET', headers: {} }, response);

  assert.equal(response.statusCode, 401);

  assert.equal(
    response.headers.get('x-content-type-options'),
    'nosniff'
  );

  assert.deepEqual(response.body, {
    error: 'AUTHENTICATION_REQUIRED',
  });
});

test('허용되지 않은 요청은 405로 거절한다', async () => {
  const handler = createNotesHandler();
  const response = mockResponse();

  await handler({ method: 'PATCH' }, response);

  assert.equal(response.statusCode, 405);

  assert.equal(
    response.headers.get('allow'),
    'GET, POST, PUT, DELETE'
  );

  assert.deepEqual(response.body, {
    error: 'METHOD_NOT_ALLOWED',
  });
});

test('환경변수가 없으면 500으로 거절한다', async () => {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SECRET_KEY;

  try {
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SECRET_KEY;

    const handler = createNotesHandler();
    const response = mockResponse();

    await handler({
      method: 'GET',
      headers: { authorization: 'Bearer test-token' },
    }, response);

    assert.equal(response.statusCode, 500);

    assert.deepEqual(response.body, {
      error: 'SERVER_CONFIGURATION_ERROR',
    });
  } finally {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = oldUrl;

    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = oldKey;
  }
});

test('A는 자기 메모만 목록에서 조회한다', async () => {
  const database = createMockDatabase();
  const handler = makeHandler(A, database);

  const response = await call(handler, {
    method: 'GET',
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, [
    {
      id: A_NOTE.id,
      title: A_NOTE.title,
      body: A_NOTE.body,
    },
  ]);
});

test('A는 B의 메모를 개별 조회할 수 없다', async () => {
  const database = createMockDatabase();
  const handler = makeHandler(A, database);

  const response = await call(handler, {
    method: 'GET',
    query: { id: B_NOTE.id },
  });

  assert.equal(response.statusCode, 404);

  assert.deepEqual(response.body, {
    error: 'NOTE_NOT_FOUND',
  });
});

test('A는 B의 메모를 수정할 수 없다', async () => {
  const database = createMockDatabase();
  const handler = makeHandler(A, database);

  const response = await call(handler, {
    method: 'PUT',
    query: { id: B_NOTE.id },
    body: {
      title: '변경 시도',
      body: '변경 시도 내용',
    },
  });

  assert.equal(response.statusCode, 404);

  assert.deepEqual(
    database.notes.find((note) => note.id === B_NOTE.id),
    B_NOTE
  );
});

test('A는 B의 메모를 삭제할 수 없다', async () => {
  const database = createMockDatabase();
  const handler = makeHandler(A, database);

  const response = await call(handler, {
    method: 'DELETE',
    query: { id: B_NOTE.id },
  });

  assert.equal(response.statusCode, 404);

  assert.ok(
    database.notes.some((note) => note.id === B_NOTE.id)
  );
});

test('B는 자기 메모를 개별 조회할 수 있다', async () => {
  const database = createMockDatabase();
  const handler = makeHandler(B, database);

  const response = await call(handler, {
    method: 'GET',
    query: { id: B_NOTE.id },
  });

  assert.equal(response.statusCode, 200);

  assert.deepEqual(response.body, {
    id: B_NOTE.id,
    title: B_NOTE.title,
    body: B_NOTE.body,
  });
});

test('A가 추가한 메모에는 A의 사용자 ID가 저장된다', async () => {
  const database = createMockDatabase([]);
  const handler = makeHandler(A, database);

  const response = await call(handler, {
    method: 'POST',
    body: {
      title: '새 메모',
      body: '새 메모 내용',
      owner_id: B,
    },
  });

  assert.equal(response.statusCode, 201);
  assert.equal(database.notes[0].owner_id, A);
});

after(() => {
  if (originalUrl === undefined) delete process.env.SUPABASE_URL;
  else process.env.SUPABASE_URL = originalUrl;

  if (originalKey === undefined) delete process.env.SUPABASE_SECRET_KEY;
  else process.env.SUPABASE_SECRET_KEY = originalKey;
});
