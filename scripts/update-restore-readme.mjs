
import { readFile, writeFile } from 'node:fs/promises';

const README_PATH = new URL('../README.md', import.meta.url);

const B_NOTE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const B_ID = '22222222-2222-4222-8222-222222222222';

async function main() {
  const readme = await readFile(README_PATH, 'utf8');

  const heading = '## 10단계 — 백업에서 자료실 복원';
  const nextHeading = '## 단계별 재실행 순서';

  const start = readme.indexOf(heading);
  const end = readme.indexOf(nextHeading, start);

  if (start < 0 || end < 0) {
    throw new Error('README_SECTION_NOT_FOUND_STOP');
  }

  const section = `## 10단계 — 백업에서 자료실 복원

### 정책 백업 및 침공 모의

- 정책 백업과 침공 모의는 기존 기록을 유지합니다.
- 시험 사본 복원은 \`artifacts/policy-drill/\` 안에서만 수행합니다.
- 실제 운영 정책과 운영 DB는 변경하지 않습니다.

### 가상 메모 백업 및 POST 복원

- 복원 대상: B 테스트 계정의 가상 메모 1개
- 메모 ID: \`${B_NOTE_ID}\`
- 소유자 ID: \`${B_ID}\`
- 백업 버전: \`note-backup-v1\`
- 백업 경로: \`artifacts/note-restore/b-note-backup.json\`
- 시험 자료 경로: \`artifacts/note-restore/notes-fixture.json\`
- 감사 기록 경로: \`artifacts/note-restore/audit-fixture.json\`
- 복원 기준: \`artifacts/note-restore/restore-manifest.json\`
- 복원 서비스: \`api/notes.js\`
- 복원 경로: \`POST /api/notes/restore\`
- Vercel 경로 연결: \`/api/notes/restore\` → \`/api/notes?restore=1\`
- 권한 확인: 심사관 B 인증 및 백업 소유자 ID 대조
- 무결성 확인: 메모 ID, 소유자 ID, 내용 SHA-256 비교
- 보존 확인: 다른 메모 해시, 전체 메모 수, 감사 기록 해시 비교

### 로컬 가상 자료 검사 기록

- 백업 버전 및 백업 내용 해시: 통과
- 복원된 메모 ID: 통과
- 복원된 메모 소유자 ID: 통과
- 복원된 메모 내용 SHA-256: 통과
- 다른 메모 보존: 통과
- 전체 메모 수 보존: 통과
- 감사 기록 보존: 통과
- 복원 API 테스트: 7개 통과
- 기존 메모 API 테스트: 10개 통과

검사 범위는 로컬 가상 자료와 가짜 DB입니다. 실제 운영 DB, 실제 배포 API, 운영 정책을 변경하거나 복원하지 않았습니다. 실제 배포 API 호출이나 심판 통과를 증명하지 않습니다.

### 복구 후 1~9단계 재시험 순서

1. 1단계 기존 시험의 정상 요청 실행 후 금지 요청 실행
2. 2단계 기존 시험의 정상 요청 실행 후 금지 요청 실행
3. 3단계 기존 시험의 정상 요청 실행 후 금지 요청 실행
4. 4단계 기존 시험의 정상 요청 실행 후 금지 요청 실행
5. 5단계 기존 시험의 정상 요청 실행 후 금지 요청 실행
6. 6단계 기존 시험의 정상 요청 실행 후 금지 요청 실행
7. 7단계 기존 시험의 정상 요청 실행 후 금지 요청 실행
8. 8단계 기존 시험의 정상 요청 실행 후 금지 요청 실행
9. 9단계 기존 시험의 정상 요청 실행 후 금지 요청 실행

- 재시험 상태: 미실행
- 재시험 결과: 실행하지 않았으므로 결과를 기록하지 않음
- 각 단계의 기존 시험 입력과 경로를 사용하고 실제 응답만 기록

`;

  const updated =
    readme.slice(0, start) + section + readme.slice(end);

  await writeFile(README_PATH, updated, 'utf8');
  console.log('완료 · README 10단계 구간만 갱신');
}

main().catch((error) => {
  console.error('중단 ·', error.message);
  process.exitCode = 1;
});
