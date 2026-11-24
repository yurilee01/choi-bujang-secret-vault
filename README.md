
# 최부장 비밀창고

로그인한 사용자만 자신의 비밀 메모를 관리할 수 있도록 만드는 보안 실습 프로젝트입니다. 프로젝트에 포함된 메모는 가상 자료이며, 실제 개인정보나 학생 자료를 사용하지 않습니다.

## 프로젝트 정보

- GitHub: https://github.com/yurilee01/choi-bujang-secret-vault
- 배포 주소: https://choi-bujang-secret-vault-umber-beta.vercel.app
- 사용 기술: Node.js, Vercel, Supabase Auth, Supabase Database
- 현재 작업 단계: 10단계 백업 자료 복원
- 추가 실습: 무차별 로그인 공격(XDR)

## 1단계 — 공개 메모 데이터

### 학생이 하는 일

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 Deploy 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 본인 계정의 Public 저장소인지 확인한 뒤 Deploy를 누릅니다.
3. 배포가 끝나면 화면에 나온 `https://…vercel.app` 주소를 방어전 1단계 카드에 제출합니다. 저장소 주소나 설정 파일을 제출하지 않습니다.

배포가 끝나면 `/`에서 가상 자료실을 확인할 수 있습니다. `/data.json`에는 같은 가상 메모가 공개됩니다. 이 공개 상태를 확인하는 것이 1단계의 출발점입니다.

### 시작 틀의 자동 처리

- `vercel.json`은 정적 결과물 `public`을 배포합니다.
- `npm run build`는 Vercel이 제공하는 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다.
- 필요한 배포 정보가 없으면 빌드가 실패합니다.
- `aleph.json`만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 실제 저장소와 배포 자료는 별도로 확인해야 합니다.
- 로컬에서 가상 화면만 확인할 때는 `npm run build -- --local`을 사용합니다. 로컬 빌드는 Vercel 배포나 심판 접수를 증명하지 않습니다.

## 2단계 — 공개 데이터 제거

### 구현 내용

- 공개 메모 데이터 파일을 제거하는 빌드 기능을 구현했습니다.
- 2단계 이후 빌드에서는 `public/data.json`을 제거합니다.
- 루트의 `data.json`은 로컬에 남아 있을 수 있으므로 공개 결과물이나 제출 묶음에 포함되지 않는지 별도로 확인해야 합니다.
- 서버 전용 키와 실제 개인정보는 브라우저 코드, 응답, 로그, Git 및 제출 자료에 포함하지 않습니다.

### 보안상 주의사항

`/data.json`과 공개 API에 남아 있는 자료가 없는지 확인해야 합니다. 과거 공개 커밋과 이전 배포에는 가상 메모가 남아 있을 수 있습니다. 새 배포에서 자료가 보이지 않더라도 과거 노출까지 해소됐다고 단정하지 않습니다.

## 4단계 저장점 — 로그인 사용자별 메모 소유권 보호

### 현재 구현

- `public/index.html`은 Supabase Auth 이메일·비밀번호 로그인을 제공합니다.
- 로그인한 사용자는 자신의 메모를 추가·수정·삭제할 수 있습니다.
- 브라우저는 Supabase 공개용 Publishable Key만 사용합니다. 서버 전용 키는 브라우저에 포함하지 않습니다.
- `api/notes.js`는 `src/verify-login.mjs`를 통해 Bearer 토큰을 검증합니다.
- 요청에서 전달한 사용자 ID나 역할을 신뢰하지 않고, 검증된 토큰의 사용자 ID를 사용합니다.
- 메모 목록 조회는 로그인한 사용자의 `owner_id`를 기준으로 처리합니다.
- 메모 생성 시 서버가 검증한 사용자 ID를 `owner_id`로 저장합니다.
- 메모 단건 조회·수정·삭제 시에도 메모 ID와 소유자 ID를 함께 확인합니다.
- 다른 사용자의 메모에 접근할 수 없도록 처리합니다.
- `aleph.config.json`에는 Supabase issuer, audience, JWKS 주소와 메모 API 허용 경로가 설정되어 있습니다.
- `vercel.json`에는 `X-Content-Type-Options: nosniff` 보안 헤더가 설정되어 있습니다.

### 데이터베이스 구조

`public.notes` 테이블은 다음 컬럼을 사용합니다.

- `id`: UUID 형식의 메모 식별자
- `owner_id`: 메모 소유자 UUID
- `title`: 메모 제목
- `body`: 메모 내용
- `created_at`: 생성 시각

Row Level Security(RLS)를 활성화하고 사용자별 접근 정책을 적용합니다.

- 로그인한 사용자는 자신의 메모만 조회할 수 있습니다.
- 메모 생성 시 본인의 사용자 ID만 지정할 수 있습니다.
- 메모 수정·삭제 시에도 본인 소유 여부를 확인합니다.

### 로컬 검사 기록

이전 단계에서 기록한 검사 결과:

| 검사 | 실행 명령 | 기록된 결과 |
|---|---|---|
| 메모 API 테스트 | `node --test test/notes-api.test.mjs` | 현재 10개 통과 |
| 패키지 테스트 | `npm run test:package` | 3개 통과 |
| R5 테스트 | `npm run test:r5` | 2개 통과 |
| 공격 검사 문법 | `node --check src/attack-check.mjs` | 오류 없음 |
| 로컬 빌드 | `npm run build -- --local` | 성공 |

현재까지 확인한 결과는 로컬 검사이며 실제 배포 성공을 증명하지 않습니다.

### 아직 확인하지 않은 항목

- Vercel 환경변수 설정 여부
- 실제 배포에서 Supabase 로그인 성공 여부
- 사용자 A의 메모 추가·수정·삭제
- 비로그인 API 요청의 401 또는 403 JSON 응답
- 사용자 B가 사용자 A의 메모에 접근할 수 없는지 실제 배포에서 확인
- 새 Vercel 배포 및 제출 심판 결과

실제 배포와 기능의 성공 여부는 직접 확인한 뒤 완료로 기록합니다.

## 추가 실습 — 무차별 로그인 공격 방어(XDR)

### 현재 구현

MITRE ATT&CK T1110(Brute Force)을 기준으로 로그인 공격 탐지 및 대응 실습을 진행합니다.

- `xdr/brute-force/read-alerts.mjs`: 원본 경보 데이터를 읽고 필요한 항목을 추출합니다.
- `xdr/brute-force/patterns.json`: 로그인 공격 탐지 패턴과 신뢰도를 정의합니다.
- `xdr/brute-force/decide.mjs`: 경보 등급과 설명을 분석하여 대응 방법을 결정합니다.
- `xdr/brute-force/result.json`: 경보별 판정 결과를 저장합니다.

### 테스트 실행

```bash
npm run xdr:run -- brute-force
```

기록된 테스트 경보 28건의 판정 결과:

- 차단(block): 10건
- 주의(alert): 9건
- 기록(record): 9건

총 28건의 테스트 경보를 대상으로 판정 결과를 확인합니다.

## 6단계 저장점 — 등록 기기만 자료실 접근

### 현재 구현

- `src/decider.mjs`에 `device_registered` 규칙을 구현했습니다.
- `request.deviceRegistered === true`인 요청만 이 규칙을 통과합니다.
- 미등록 기기는 `deny` 및 `device_not_registered`로 거부합니다.
- 요청·응답 형식은 `docs/DECIDER_REQUEST.md`를 따릅니다.
- 등록 기기와 미등록 기기의 가상 요청을 판정기 테스트로 확인합니다.

## 7단계 저장점 — 복합 이상 접속 추가 확인

### 현재 구현

- `src/decider.mjs`에 `step_up_required` 규칙을 추가했습니다.
- 등록 기기 여부 검사를 기존대로 유지합니다.
- `judge_fixture` 가상 신호에서 비정상 시간, 낯선 네트워크, 최근 활동량 조건이 함께 충족되면 추가 확인을 요구합니다.
- 복합 이상 접속에 대해 유효한 재인증이 확인되지 않았거나 재인증 후 5분이 지나면 `step_up`을 반환합니다.
- `stepUp.verified === true`이고 `authAgeSeconds`가 0~300초이면 최근 재인증으로 인정하여 다음 판정으로 진행합니다.
- 재인증이 유효한 복합 이상 요청은 `allow`로 진행합니다.
- 지역 정보만으로 접근을 영구 차단하지 않습니다.

### 테스트 기록

- `npm run decider:test`: 가상 요청 판정 테스트
- `npm run fixture:7`: 정상 사건과 복합 이상 사건의 판정 확인
- `npm run test:r5`: 2개 통과
- `npm run test:package`: 3개 통과
- `node --test test/verify-login.test.mjs`: 3개 통과
- `node --test test/notes-api.test.mjs`: 현재 10개 통과
- `git diff --check`: 통과

위 테스트는 로컬 가상 요청과 자동화 검사이며 실제 운영 엔진의 사건 수집이나 심판 통과 증거는 아닙니다.

### 미완료 및 확인 필요

- 이상 접속 신호는 `judge_fixture` 기반 가상 데이터입니다.
- `risk_signal`의 실제 이벤트 의미와 대량 메모 읽기 수집 연동은 확인되지 않았습니다.
- 실제 재로그인 및 새 요청 재평가 연동은 확인되지 않았습니다.
- `step_up_required`, `device_not_registered` 운영 허용 코드 등록 여부는 확인되지 않았습니다.
- 실제 심판 통과 및 7단계 배포는 별도로 확인해야 합니다.

## 8단계 — 자료마다 갈 수 있는 구역을 나눕니다

### 작업 상태

- 판정기에 메모 개별 ID 경로 허용 규칙을 추가했습니다.
- 메모 목록 및 생성 경로는 판정기에서 거부하도록 구성했습니다.
- 공지사항과 강사 자료는 실제 API 및 데이터 경로가 없어 운영 연동이 완료되지 않았습니다.
- `src/decider.mjs`는 등록된 메모 단건 GET 경로만 허용하고, 그 외 서비스와 경로는 기본 거부하도록 구성했습니다.
- `aleph.config.json`의 메모 개별 경로 허용 목록을 유지합니다.
- 메모 API는 인증된 사용자 ID와 저장된 `owner_id`를 비교하여 조회·수정·삭제합니다.
- 운영 `allowedReasonCodes` 등록 여부와 실제 심판 통과는 확인되지 않았습니다.

### 로컬 검사 결과

- 판정기 가상 요청 테스트: 당시 14개 통과
- 메모 API 소유권 테스트: 현재 10개 통과
- 위 결과는 로컬 테스트이며 실제 심판 통과 증거가 아닙니다.

## 9단계 저장점 — 대량 조회 폭주 탐지

### 현재 구현

- `src/detect.mjs`에 가상 사건 탐지 함수 `detect(events)`를 구현했습니다.
- 사건에서 `at`, `method`, `sub`를 우선 읽고, `sub`가 없으면 `identity.sub`를 대체값으로 읽습니다.
- 동일한 가명 주체가 10분 안에 GET 요청을 121건 이상 발생시키면 회수 제안 결과를 반환합니다.
- 정확히 120건이면 정상 관찰 결과를 반환합니다.
- 서로 다른 주체의 요청은 각각 따로 계산합니다.
- 10분을 초과해 분산된 요청은 하나의 폭주로 합산하지 않습니다.
- 탐지 결과는 `{ action: 'propose_revocation', reasonCode: 'burst_read', subject: sub }` 형식입니다.
- 일반 요청은 `{ action: 'observe' }`를 반환합니다.
- 실제 권한 회수 API를 호출하지 않습니다.
- 운영 엔진의 실제 사건 수집 및 회수 연동은 확인되지 않았습니다.
- 메모 내용, 토큰, 네트워크, 기기, 지역 정보는 탐지에 사용하지 않습니다.

### 로컬 테스트 실행

```bash
node --check src/detect.mjs
npm run detect:test
```

### 테스트 결과

- 정상 조회 30건: 통과
- 10분 안에 120건: 통과
- 10분 안에 121건: 통과
- 폭주 조회 200건: 통과
- 서로 다른 사용자 각 100건: 통과
- 10분 밖으로 흩어진 조회 200건: 통과

총 6개 가상 사건 테스트가 통과했습니다.

위 결과는 가상 사건을 이용한 로컬 테스트이며 실제 접속 회수나 심판 통과 증거가 아닙니다.

## 10단계 — 백업에서 자료실 복원

### 정책 백업 및 침공 모의

- 정책 백업 대상: `src/decider.mjs`의 접근 규칙, `aleph.config.json`의 `allowedRoutes`, DB 접근 정책
- 백업 위치: `artifacts/policy-drill/`의 시험용 정책 사본과 매니페스트
- 복원 전 1단계: 정책 사본과 매니페스트 파일을 디스크에서 다시 읽습니다.
- 복원 전 2단계: 매니페스트 형식과 버전을 확인하고, 대상 파일 목록 및 각 파일의 SHA-256 해시를 검증합니다.
- 복원 전 3단계: 매니페스트에 기록된 복원 버전, 대상 파일, 현재 시험 정책과의 차이 및 변경 범위를 대조합니다.
- 복원 전 4단계: 검증 결과, 복원할 버전, 변경될 파일과 변경 범위를 실행 전에 출력해 확인합니다.
- 복원 실행: 위 검증과 범위 대조가 모두 통과한 경우에만 `artifacts/policy-drill/` 안의 시험 정책 사본에 복원합니다.
- 중단 조건: 사본 또는 매니페스트가 없거나, 버전·파일별 해시·대상 목록·변경 범위 검증 중 하나라도 실패하면 복원하지 않고 즉시 중단합니다.
- 보존 조건: 복원 대상이 아닌 다른 서비스 규칙과 감사 기록은 보존합니다.
- 안전 경계: 실제 운영 정책, 운영 DB 및 실제 서비스 설정은 읽기 전용으로 취급하며 변경하지 않습니다.

### 가상 메모 백업 및 POST 복원

- 복원 대상: B 테스트 계정의 가상 메모 1개
- 메모 ID: `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`
- 소유자 ID: `22222222-2222-4222-8222-222222222222`
- 백업 버전: `note-backup-v1`
- 백업 경로: `artifacts/note-restore/b-note-backup.json`
- 시험 자료 경로: `artifacts/note-restore/notes-fixture.json`
- 감사 기록 경로: `artifacts/note-restore/audit-fixture.json`
- 복원 기준: `artifacts/note-restore/restore-manifest.json`
- 복원 서비스: `api/notes.js`
- 복원 경로: `POST /api/notes/restore`
- Vercel 경로 연결: `/api/notes/restore` → `/api/notes?restore=1`
- 권한 확인: 심사관 B 인증 및 백업 소유자 ID 대조
- 무결성 확인: 메모 ID, 소유자 ID, 내용 SHA-256 비교
- 백업 재검증: 복원 직전에 백업 파일을 디스크에서 다시 읽음
- 버전 대조: 백업 버전과 매니페스트의 백업 버전 비교
- 해시 대조: 백업 내용 SHA-256과 매니페스트 기록값 비교
- 실패 처리: 백업 누락, 버전 불일치, 해시 불일치 시 POST 복원 중단
- 실행 전 확인: 검증 결과, 복원 버전, 변경 대상 및 보존 대상을 출력
- 매니페스트: 백업 버전 및 백업 내용 SHA-256 기록
- 보존 확인: 다른 메모 해시, 전체 메모 수, 감사 기록 해시 비교

### 로컬 가상 자료 검사 기록

- 백업 파일 재읽기 및 매니페스트 대조: 통과
- 정상 백업 복원 시험: 통과
- 손상된 백업 복원 차단 시험: 통과
- 백업 버전 및 백업 내용 해시: 통과
- 복원된 메모 ID: 통과
- 복원된 메모 소유자 ID: 통과
- 복원된 메모 내용 SHA-256: 통과
- 다른 메모 보존: 통과
- 전체 메모 수 보존: 통과
- 감사 기록 보존: 통과
- 복원 API 테스트: 7개 통과
- 기존 메모 API 테스트: 10개 통과
- 전체 API 테스트: 17개 통과, 실패 0개

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

## 단계별 재실행 순서

아래 명령은 로컬 검증을 다시 수행할 때 참고하는 순서입니다. 각 명령의 실행 결과를 확인한 뒤 다음 단계로 진행합니다.

### 1. 프로젝트 의존성 설치

```bash
npm install
```

### 2. 로컬 빌드

```bash
npm run build -- --local
```

### 3. 로그인 검증 테스트

```bash
node --test test/verify-login.test.mjs
```

### 4. 메모 API 소유권 테스트

```bash
node --test test/notes-api.test.mjs
```

### 5. 패키지 및 R5 테스트

```bash
npm run test:package
npm run test:r5
```

### 6~8. 판정기 테스트

```bash
npm run decider:test
```

### 7. 추가 확인 가상 사건 테스트

```bash
npm run fixture:7
```

### 9. 대량 조회 탐지 테스트

```bash
node --check src/detect.mjs
npm run detect:test
```

### 10. 복원 검증

백업과 가상 자료가 이미 생성된 경우 `--init`과 `--backup`을 다시 실행하지 않습니다. 기존 백업을 보존한 상태에서 손실 모의와 복원을 수행합니다.

```bash
node scripts/note-restore.mjs --simulate-loss
node scripts/note-restore.mjs --restore
```

### 추가 XDR 실습

```bash
npm run xdr:run -- brute-force
```

주의: 위 명령은 재실행 안내입니다. 실제로 실행한 명령과 결과만 검사 완료로 기록합니다. `src/attack-check.mjs`는 배포 URL과 외부 서비스에 요청할 수 있으므로 별도 확인 없이 실행하지 않습니다.

## 개발 및 검사 명령어

```bash
npm install
npm run build -- --local
npm run test:package
npm run test:r5
node --test test/verify-login.test.mjs
node --test test/notes-api.test.mjs
npm run decider:test
npm run fixture:7
npm run detect:test
npm run bundle
```

## 보안 원칙

- 실제 개인정보와 학생 자료를 사용하지 않습니다.
- 비밀번호, 토큰, 서버 전용 키를 코드에 직접 입력하지 않습니다.
- 서버 전용 키를 브라우저 코드에 포함하지 않습니다.
- 사용자 인증 정보는 서버에서 검증합니다.
- 사용자 ID는 검증된 인증 정보에서 가져옵니다.
- 요청 본문의 role이나 화면 메뉴를 권한 근거로 사용하지 않습니다.
- 로컬 테스트 성공과 실제 배포 성공을 구분합니다.
- 가상 사건 테스트 결과를 실제 운영 엔진의 보안 조치 완료로 표현하지 않습니다.
- 운영 정책과 운영 DB를 복원 실습 대상으로 사용하지 않습니다.