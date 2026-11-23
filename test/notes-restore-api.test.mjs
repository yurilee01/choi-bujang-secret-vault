
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { createNotesHandler } from '../api/notes.js';

const B = '22222222-2222-4222-8222-222222222222';
const A = '11111111-1111-4111-8111-111111111111';

const NOTE = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  owner_id: B,
  title: 'B 복원 실습 메모',
  body: 'B 계정의 복원 검증용 가상 자료',
};

function hash(note) {
  return createHash('sha256')
    .update(JSON.stringify({
      title: note.title,
      body: note.body,
    }), 'utf8')
    .digest('hex');
}

function backup(note = NOTE) {
  return {
    version: 'note-backup-v1',
    note: structuredClone(note),
    contentSha256: hash(note),
  };
}

function mockResponse() {
  let statusCode;
  let body;

  return {
    get statusCode() {
      return statusCode;
    },
    get body() {
      return body;
    },
    setHeader() {},
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

function createDatabase(initialNotes = []) {
  const notes = structuredClone(initialNotes);

  return {
    notes,

    client() {
      return {
        from(table) {
          assert.equal(table, 'notes');

          let action = 'select';
          let filters = {};
          let values = null;
          let columns = null;

          const query = {
            select(value) {
              columns = value
                ? value.split(',').map(item => item.trim())
                : null;
              return query;
            },

            eq(column, value) {
              filters[column] = value;
              return query;
            },

            insert(value) {
              action = 'insert';
              values = structuredClone(value);
              return query;
            },

            async maybeSingle() {
              const result = await execute();
              return {
                data: result.data[0] ?? null,
                error: null,
              };
            },

            async single() {
              const result = await execute();
              return {
                data: result.data[0] ?? null,
                error: null,
              };
            },
          };

          function project(rows) {
            if (!columns) return structuredClone(rows);

            return rows.map(note =>
              Object.fromEntries(
                columns.map(column => [column, note[column]])
              )
            );
          }

          async function execute() {
            if (action === 'insert') {
              if (notes.some(note => note.id === values.id)) {
                return {
                  data: [],
                  error: { code: '23505', message: 'duplicate key' },
                };
              }

              notes.push(structuredClone(values));

              return {
                data: project([values]),
                error: null,
              };
            }

            const matches = notes.filter(note =>
              Object.entries(filters).every(
                ([column, value]) => note[column] === value
              )
            );

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

function makeRestoreHandler(identity, database) {
  return createNotesHandler({
    verifyLogin: async authorization => {
      if (authorization !== 'Bearer restore-test-token') {
        return null;
      }

      return identity;
    },
    createSupabaseClient: () => database.client(),
  });
}

async function restoreCall(handler, backupData = backup()) {
  const response = mockResponse();

  await handler({
    method: 'POST',
    url: '/api/notes/restore',
    headers: {
      authorization: 'Bearer restore-test-token',
    },
    body: {
      backup: backupData,
    },
  }, response);

  return response;
}

const oldUrl = process.env.SUPABASE_URL;
const oldKey = process.env.SUPABASE_SECRET_KEY;

process.env.SUPABASE_URL = 'https://fixture.invalid';
process.env.SUPABASE_SECRET_KEY = 'local-test-only';

test('심사관 B는 백업 메모 한 건을 복원할 수 있다', async () => {
  const database = createDatabase();
  const handler = makeRestoreHandler({
    kind: 'judge',
    identity: 'b',
    userId: B,
  }, database);

  const response = await restoreCall(handler);

  assert.equal(response.statusCode, 201);
  assert.equal(response.body.restored, true);
  assert.equal(response.body.id, NOTE.id);
  assert.equal(response.body.owner_id, B);
  assert.equal(response.body.contentSha256, hash(NOTE));

  assert.equal(database.notes.length, 1);
  assert.deepEqual(database.notes[0], NOTE);
});

test('일반 학생은 복원 경로를 사용할 수 없다', async () => {
  const database = createDatabase();
  const handler = makeRestoreHandler({
    kind: 'student',
    userId: B,
  }, database);

  const response = await restoreCall(handler);

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error, 'RESTORE_FORBIDDEN');
  assert.equal(database.notes.length, 0);
});

test('심사관 A는 B 메모를 복원할 수 없다', async () => {
  const database = createDatabase();
  const handler = makeRestoreHandler({
    kind: 'judge',
    identity: 'a',
    userId: A,
  }, database);

  const response = await restoreCall(handler);

  assert.equal(response.statusCode, 403);
  assert.equal(response.body.error, 'RESTORE_FORBIDDEN');
  assert.equal(database.notes.length, 0);
});

test('백업 내용 해시가 다르면 복원을 거절한다', async () => {
  const database = createDatabase();
  const handler = makeRestoreHandler({
    kind: 'judge',
    identity: 'b',
    userId: B,
  }, database);

  const invalidBackup = backup();
  invalidBackup.note.body = '변조된 내용';

  const response = await restoreCall(handler, invalidBackup);

  assert.equal(response.statusCode, 400);
  assert.equal(
    response.body.error,
    'RESTORE_BACKUP_HASH_MISMATCH'
  );
  assert.equal(database.notes.length, 0);
});

test('같은 ID의 메모가 있으면 덮어쓰지 않는다', async () => {
  const database = createDatabase([NOTE]);
  const handler = makeRestoreHandler({
    kind: 'judge',
    identity: 'b',
    userId: B,
  }, database);

  const response = await restoreCall(handler);

  assert.equal(response.statusCode, 409);
  assert.equal(
    response.body.error,
    'RESTORE_TARGET_ALREADY_EXISTS'
  );
  assert.equal(database.notes.length, 1);
  assert.deepEqual(database.notes[0], NOTE);
});

test('백업 소유자와 심사관 B의 사용자 ID가 다르면 거절한다', async () => {
  const database = createDatabase();
  const handler = makeRestoreHandler({
    kind: 'judge',
    identity: 'b',
    userId: A,
  }, database);

  const response = await restoreCall(handler);

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, 'INVALID_RESTORE_BACKUP');
  assert.equal(database.notes.length, 0);
});

test('인증 토큰이 없으면 복원을 거절한다', async () => {
  const database = createDatabase();
  const handler = makeRestoreHandler({
    kind: 'judge',
    identity: 'b',
    userId: B,
  }, database);

  const response = mockResponse();

  await handler({
    method: 'POST',
    url: '/api/notes/restore',
    headers: {},
    body: {
      backup: backup(),
    },
  }, response);

  assert.equal(response.statusCode, 401);
  assert.equal(database.notes.length, 0);
});
