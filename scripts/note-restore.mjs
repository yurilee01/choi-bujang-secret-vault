
import {
  access,
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { createNotesHandler } from '../api/notes.js';

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, 'artifacts', 'note-restore');
const BACKUP_PATH = path.join(DATA_DIR, 'b-note-backup.json');
const FIXTURE_PATH = path.join(DATA_DIR, 'notes-fixture.json');
const AUDIT_PATH = path.join(DATA_DIR, 'audit-fixture.json');
const MANIFEST_PATH = path.join(DATA_DIR, 'restore-manifest.json');
const README_PATH = path.join(ROOT, 'README.md');

const A_ID = '11111111-1111-4111-8111-111111111111';
const B_ID = '22222222-2222-4222-8222-222222222222';

const B_NOTE = {
  id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  owner_id: B_ID,
  title: 'B 복원 실습 메모',
  body: 'B 계정의 복원 검증용 가상 자료',
};

const SAFE_NOTE = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  owner_id: A_ID,
  title: 'A 보존 메모',
  body: '복원 과정에서 보존할 A의 가상 자료',
};

function sha256(value) {
  return createHash('sha256')
    .update(value, 'utf8')
    .digest('hex');
}

function contentHash(note) {
  return sha256(JSON.stringify({
    title: note.title,
    body: note.body,
  }));
}

function notesHash(notes) {
  return sha256(JSON.stringify(notes));
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

async function writeJson(filePath, value) {
  await writeFile(
    filePath,
    `${JSON.stringify(value, null, 2)}\n`,
  );
}

async function writeJsonNew(filePath, value) {
  await writeFile(
    filePath,
    `${JSON.stringify(value, null, 2)}\n`,
    { flag: 'wx' },
  );
}

function validateNote(note, expected) {
  if (!note || note.id !== expected.id) {
    throw new Error('note_id_mismatch_stop');
  }

  if (note.owner_id !== expected.owner_id) {
    throw new Error('note_owner_mismatch_stop');
  }

  if (
    typeof note.title !== 'string'
    || typeof note.body !== 'string'
  ) {
    throw new Error('note_content_invalid_stop');
  }
}

async function verifyBackup() {
  const backup = await readJson(BACKUP_PATH);

  if (backup.version !== 'note-backup-v1') {
    throw new Error('note_backup_version_mismatch_stop');
  }

  validateNote(backup.note, B_NOTE);

  if (contentHash(backup.note) !== backup.contentSha256) {
    throw new Error('note_backup_hash_mismatch_stop');
  }

  return backup;
}

async function initializeFixtures() {
  await mkdir(DATA_DIR, { recursive: true });

  if (
    await exists(FIXTURE_PATH)
    || await exists(BACKUP_PATH)
    || await exists(AUDIT_PATH)
  ) {
    throw new Error('fixture_or_backup_already_exists_stop');
  }

  const notes = [
    SAFE_NOTE,
    B_NOTE,
    {
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      owner_id: A_ID,
      title: 'A 다른 메모',
      body: '보존 여부 확인용 가상 자료',
    },
  ];

  const audit = [
    {
      event: 'fixture_created',
      noteId: B_NOTE.id,
      ownerId: B_ID,
    },
  ];

  await writeJsonNew(FIXTURE_PATH, { notes });
  await writeJsonNew(AUDIT_PATH, { records: audit });

  console.log('완료 · 가상 메모 3개 및 감사 기록 생성');
}

async function backupBNote() {
  if (await exists(BACKUP_PATH)) {
    throw new Error('note_backup_already_exists_stop');
  }

  const fixture = await readJson(FIXTURE_PATH);
  const matches = fixture.notes.filter(
    note => note.id === B_NOTE.id,
  );

  if (matches.length !== 1) {
    throw new Error('target_note_count_invalid_stop');
  }

  const note = matches[0];
  validateNote(note, B_NOTE);

  const backup = {
    version: 'note-backup-v1',
    note: structuredClone(note),
    contentSha256: contentHash(note),
  };

  await writeJsonNew(BACKUP_PATH, backup);

  console.log('완료 · B 메모 백업 생성');
  console.log(`메모 ID: ${note.id}`);
  console.log(`소유자 ID: ${note.owner_id}`);
  console.log(`내용 SHA-256: ${backup.contentSha256}`);
}

async function simulateLoss() {
  const backup = await verifyBackup();
  const fixture = await readJson(FIXTURE_PATH);
  const audit = await readJson(AUDIT_PATH);

  if (await exists(MANIFEST_PATH)) {
    throw new Error('restore_manifest_already_exists_stop');
  }

  const matches = fixture.notes.filter(
    note => note.id === B_NOTE.id,
  );

  if (matches.length !== 1) {
    throw new Error('target_note_count_invalid_stop');
  }

  if (contentHash(matches[0]) !== backup.contentSha256) {
    throw new Error('current_note_hash_mismatch_stop');
  }

  const preservedNotes = fixture.notes.filter(
    note => note.id !== B_NOTE.id,
  );

  const manifest = {
    version: 'note-restore-manifest-v1',
    targetId: B_NOTE.id,
    ownerId: B_ID,
    originalNoteCount: fixture.notes.length,
    preservedNotesSha256: notesHash(preservedNotes),
    auditSha256: sha256(JSON.stringify(audit)),
  };

  console.log('\n===== 손실 모의 변경 계획 =====');
  console.log(`대상: ${B_NOTE.id}`);
  console.log('변경: B 가상 메모 1개 제거');
  console.log('보존: A 메모 및 나머지 메모');
  console.log('보존: 감사 기록');
  console.log('실제 운영 DB: 접근하지 않음');

  await writeJsonNew(MANIFEST_PATH, manifest);
  await writeJson(FIXTURE_PATH, {
    ...fixture,
    notes: preservedNotes,
  });

  console.log('\n완료 · B 메모 손실 모의');
  console.log('통과 · 나머지 메모 보존');
  console.log('통과 · 감사 기록 보존');
}

function createMockResponse() {
  let statusCode = 200;
  let body = null;

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

function createFixtureDatabase(notes) {
  return {
    from(table) {
      if (table !== 'notes') {
        throw new Error('unexpected_table_stop');
      }

      let inserted = null;

      const query = {
        insert(value) {
          inserted = structuredClone(value);
          return query;
        },

        select() {
          return query;
        },

        async single() {
          if (!inserted) {
            throw new Error('post_insert_missing_stop');
          }

          if (notes.some(note => note.id === inserted.id)) {
            throw new Error('duplicate_note_id_stop');
          }

          notes.push({
            ...inserted,
          });

          return {
            data: { id: inserted.id },
            error: null,
          };
        },
      };

      return query;
    },
  };
}

async function postRestore(note, notes) {
  const oldUrl = process.env.SUPABASE_URL;
  const oldKey = process.env.SUPABASE_SECRET_KEY;

  // 가짜 값만 사용하며 실제 Supabase에 연결하지 않습니다.
  process.env.SUPABASE_URL = 'https://fixture.invalid';
  process.env.SUPABASE_SECRET_KEY = 'local-fixture-only';

  try {
    const handler = createNotesHandler({
      verifyLogin: async authorization => {
        if (authorization !== 'Bearer local-restore-test') {
          return null;
        }

        return { userId: B_ID };
      },

      createSupabaseClient: () => ({
        ...createFixtureDatabase(notes),
      }),
    });

    const response = createMockResponse();

    await handler({
      method: 'POST',
      url: '/api/notes',
      headers: {
        authorization: 'Bearer local-restore-test',
      },
      body: {
        id: note.id,
        title: note.title,
        body: note.body,

        // 위조된 소유자 값은 API가 사용하지 않아야 합니다.
        owner_id: A_ID,
      },
    }, response);

    if (response.statusCode !== 201) {
      throw new Error(`post_restore_failed_${response.statusCode}`);
    }

    if (response.body?.id !== note.id) {
      throw new Error('post_restore_id_mismatch_stop');
    }

    return response.body;
  } finally {
    if (oldUrl === undefined) {
      delete process.env.SUPABASE_URL;
    } else {
      process.env.SUPABASE_URL = oldUrl;
    }

    if (oldKey === undefined) {
      delete process.env.SUPABASE_SECRET_KEY;
    } else {
      process.env.SUPABASE_SECRET_KEY = oldKey;
    }
  }
}

async function updateReadme() {
  const readme = await readFile(README_PATH, 'utf8');
  const heading = '## 10단계 가상 메모 복원';

  const section = `## 10단계 가상 메모 복원

- 복원 대상: B 테스트 계정의 가상 메모 1개
- 메모 ID: ${B_NOTE.id}
- 소유자 ID: ${B_ID}
- 백업 경로: \`artifacts/note-restore/b-note-backup.json\`
- 시험 자료 경로: \`artifacts/note-restore/notes-fixture.json\`
- 감사 기록 경로: \`artifacts/note-restore/audit-fixture.json\`
- 복원 기준: \`artifacts/note-restore/restore-manifest.json\`
- 복원 서비스: 기존 \`api/notes.js\`
- 복원 경로: \`POST /api/notes\`
- 소유권 확인: API가 인증된 B 사용자 ID를 owner_id로 지정하는지 검증
- 무결성 확인: 메모 ID, 소유자 ID, 내용 SHA-256 비교
- 보존 확인: 나머지 메모 SHA-256 및 감사 기록 SHA-256 비교
- 실행 순서: \`node scripts/note-restore.mjs --init\`, \`node scripts/note-restore.mjs --backup\`, \`node scripts/note-restore.mjs --simulate-loss\`, \`node scripts/note-restore.mjs --restore\`
- 실행 범위: 로컬 가상 자료와 가짜 DB만 사용하며 실제 운영 DB에는 접근하지 않음
- 주의: 로컬 POST 핸들러 검증이며 실제 배포 API 또는 운영 DB 복원 증거가 아님
`;

  const index = readme.indexOf(heading);
  const updated = index >= 0
    ? `${readme.slice(0, index).trimEnd()}\n\n${section}`
    : `${readme.trimEnd()}\n\n${section}`;

  await writeFile(README_PATH, updated);
  console.log('완료 · README 복원 서비스와 경로 기록');
}

async function restoreBNote() {
  const backup = await verifyBackup();
  const manifest = await readJson(MANIFEST_PATH);
  const fixture = await readJson(FIXTURE_PATH);
  const auditBefore = await readJson(AUDIT_PATH);

  if (
    manifest.version !== 'note-restore-manifest-v1'
    || manifest.targetId !== B_NOTE.id
    || manifest.ownerId !== B_ID
  ) {
    throw new Error('restore_manifest_invalid_stop');
  }

  if (fixture.notes.some(note => note.id === B_NOTE.id)) {
    throw new Error('target_note_already_exists_stop');
  }

  const beforeHash = notesHash(fixture.notes);
  const beforeAuditHash = sha256(JSON.stringify(auditBefore));

  if (beforeHash !== manifest.preservedNotesSha256) {
    throw new Error('preserved_notes_hash_mismatch_stop');
  }

  if (beforeAuditHash !== manifest.auditSha256) {
    throw new Error('audit_hash_mismatch_stop');
  }

  console.log('\n===== POST 복원 전 변경 계획 =====');
  console.log(`복원 메모 ID: ${backup.note.id}`);
  console.log(`복원 소유자 ID: ${B_ID}`);
  console.log(`복원 경로: POST /api/notes`);
  console.log('변경 대상: B 가상 메모 1개');
  console.log('보존 대상: 다른 메모 및 감사 기록');
  console.log('DB 연결: 로컬 가짜 DB');
  console.log('실제 운영 DB: 접근하지 않음');

  const nextNotes = structuredClone(fixture.notes);

  await postRestore(backup.note, nextNotes);

  await writeJson(FIXTURE_PATH, {
    ...fixture,
    notes: nextNotes,
  });

  const restoredFixture = await readJson(FIXTURE_PATH);
  const restoredAudit = await readJson(AUDIT_PATH);

  const matches = restoredFixture.notes.filter(
    note => note.id === B_NOTE.id,
  );

  if (matches.length !== 1) {
    throw new Error('restored_note_count_mismatch_stop');
  }

  const restored = matches[0];
  validateNote(restored, B_NOTE);

  if (contentHash(restored) !== backup.contentSha256) {
    throw new Error('restored_note_hash_mismatch_stop');
  }

  const preservedNotes = restoredFixture.notes.filter(
    note => note.id !== B_NOTE.id,
  );

  if (notesHash(preservedNotes) !== manifest.preservedNotesSha256) {
    throw new Error('preserved_notes_changed_stop');
  }

  if (restoredFixture.notes.length !== manifest.originalNoteCount) {
    throw new Error('total_note_count_mismatch_stop');
  }

  if (
    sha256(JSON.stringify(restoredAudit))
    !== manifest.auditSha256
  ) {
    throw new Error('audit_record_changed_stop');
  }

  console.log('\n통과 · POST /api/notes 응답 201');
  console.log('통과 · B 메모 ID 일치');
  console.log('통과 · B 소유자 ID 일치');
  console.log('통과 · B 메모 내용 SHA-256 일치');
  console.log('통과 · 다른 모든 메모 보존');
  console.log('통과 · 전체 메모 개수 보존');
  console.log('통과 · 감사 기록 보존');

  await updateReadme();
}

async function main() {
  const command = process.argv[2];

  if (command === '--init') {
    await initializeFixtures();
    return;
  }

  if (command === '--backup') {
    await backupBNote();
    return;
  }

  if (command === '--simulate-loss') {
    await simulateLoss();
    return;
  }

  if (command === '--restore') {
    await restoreBNote();
    return;
  }

  throw new Error(
    '사용법: --init | --backup | --simulate-loss | --restore',
  );
}

main().catch(error => {
  console.error(`중단 · ${error.message}`);
  process.exitCode = 1;
});
