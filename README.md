
# BYTE BACK | 최부장 비밀창고

로그인한 사용자만 자신의 가상 메모를 관리할 수 있도록 만드는 보안 실습 프로젝트입니다.

실제 개인정보나 학생 자료는 사용하지 않습니다. 판정기·탐지기·복구 기능 중 일부는 로컬 가상 데이터와 모의 환경을 사용합니다.

## 프로젝트 정보

- GitHub: https://github.com/yurilee01/choi-bujang-secret-vault
- 배포 주소: https://choi-bujang-secret-vault-umber-beta.vercel.app
- 현재 작업 단계: 12단계 탈환 작전실
- 기술: Node.js, Vercel, Supabase Auth, Supabase Database
- 프런트엔드: `public/index.html`
- 운영 대시보드: `public/operations.html`
- 접근 판정기: `src/decider.mjs`
- 이상 접속 탐지기: `src/detect.mjs`
- 메모 API: `api/notes.js`

## 12단계 작업 현황

### 1~3단계 — 공개 자료 및 인증 기반

- 공개 자료를 이용한 초기 실습 환경을 구성합니다.
- 이후 단계의 빌드에서는 공개 메모 데이터 파일을 제거합니다.
- Supabase Auth 이메일·비밀번호 로그인 기능을 사용합니다.
- 인증 앱을 이용한 TOTP 2단계 인증 기능을 제공합니다.

### 4단계 — 사용자별 메모 소유권 보호

- 로그인 사용자의 메모 추가·수정·삭제 기능을 제공합니다.
- 서버에서 Bearer 토큰을 검증합니다.
- 검증된 사용자 ID를 기준으로 메모 소유권을 확인합니다.
- 다른 사용자의 메모에 접근하지 못하도록 처리합니다.
- 메모 API 테스트는 로컬 환경에서 수행합니다.

### 6~8단계 — 접근 판정 및 자원 구분

`src/decider.mjs`에서 접근 요청을 판정합니다.

현재 구현된 규칙 ID:

| 규칙 ID | 목적 |
|---|---|
| `device_registered` | 등록되지 않은 기기 거부 |
| `step_up_required` | 추가 본인 확인 요구 |
| `note_resource_access` | 허용된 메모 경로 확인 |
| `instructor_material_denied` | 강사 자료 접근 거부 |
| `unknown_resource_denied` | 알 수 없는 자원 접근 거부 |

판정 응답은 다음 다섯 항목으로 구성합니다.

- `schema`
- `requestId`
- `decision`
- `reasonCode`
- `ruleIds`

요청 필드와 응답 형식은 `docs/DECIDER_REQUEST.md`를 기준으로 합니다.

판정기 테스트는 가상 요청을 이용한 로컬 검사입니다. 실제 운영 엔진의 판정이나 심판 통과를 증명하지 않습니다.

### 9단계 — 대량 조회 탐지

`src/detect.mjs`에 가상 사건 탐지 기능을 구현했습니다.

- 동일 주체의 10분 내 GET 요청이 120건을 초과하면 회수 제안을 생성합니다.
- 정확히 120건이면 회수 제안을 생성하지 않습니다.
- 탐지 결과는 `propose_revocation`과 `burst_read`를 사용합니다.
- 실제 계정·토큰 폐기 API를 호출하지 않습니다.

실행 명령:

```bash
npm run detect:test
```

이 테스트는 로컬 가상 사건 검사이며 실제 운영망의 접속 차단이나 권한 회수 증거가 아닙니다.

### 10단계 — 백업 자료 복구

복구 스크립트:

- `scripts/note-restore.mjs`

복구 관련 자료:

- 백업 버전: `note-backup-v1`
- 매니페스트 버전: `note-restore-manifest-v1`
- 매니페스트 파일: `restore-manifest.json`
- 검증 방식: SHA-256 내용 해시 대조

복구 연습 순서:

```bash
node scripts/note-restore.mjs --init
node scripts/note-restore.mjs --backup
node scripts/note-restore.mjs --simulate-loss
node scripts/note-restore.mjs --restore
```

복구 과정에서 백업 버전, 메모 ID, 소유자 ID, 내용 해시 등을 확인합니다.

현재 복구 스크립트는 로컬 가짜 DB를 이용한 연습 코드입니다. 실제 운영 DB 복구 완료를 의미하지 않습니다.

### 11단계 — 인증 및 기기 승인

- Supabase Auth 로그인을 사용합니다.
- TOTP 방식의 2단계 인증을 제공합니다.
- 서버의 기기 승인 API를 통해 승인 상태를 확인합니다.
- 승인되지 않은 기기는 메모 화면에 접근하지 못하도록 처리합니다.
- 앱 설치 여부와 서버의 기기 승인은 별도로 취급합니다.

관련 파일:

- `public/index.html`
- `api/device-approval.js`
- `api/notes.js`

### 12단계 — 탈환 작전실

운영 대시보드 파일:

- `public/operations.html`

홈페이지에서 다음 주소로 이동할 수 있습니다.

```text
/operations.html
```

대시보드 표시 항목:

1. 접근 판정기 규칙 5개
2. XDR 모의 탐지 결과
3. 대량 조회 탐지 및 회수 제안 기준
4. 백업 및 복구 버전
5. 1~11단계 심사 증거 현황
6. 로컬 검증 및 복구 명령

대시보드의 정보는 저장소 코드·문서·로컬 기록을 기준으로 표시합니다. 실시간 운영 서버 상태를 조회한 결과가 아닙니다.

## XDR 모의 탐지 기록

관련 파일:

- `xdr/README.md`
- `xdr/alerts.log`

기록이 확인된 모의 탐지 결과:

| 유형 | 전체 건수 | 차단 기록 |
|---|---:|---:|
| Web Injection | 26 | 7 |
| Known CVE | 24 | 8 |
| Persistence | 24 | 8 |
| Privilege | 26 | 5 |
| Exfiltration | 30 | 7 |
| Brute Force | 결과 자료 없음 | 확인 불가 |

XDR 모듈은 다음과 같이 실행할 수 있습니다.

```bash
npm run xdr:run -- brute-force
npm run xdr:run -- web-injection
npm run xdr:run -- known-cve
npm run xdr:run -- persistence
npm run xdr:run -- privilege
npm run xdr:run -- exfiltration
```

위 수치는 저장소에 기록된 로컬 모의 탐지 결과입니다. 실제 네트워크 장비나 운영 서버에서 차단한 건수가 아닙니다.

## 심사 증거 기록 원칙

1~11단계의 실제 심사 결과, 요청 ID, 심사 시각은 확인 가능한 증거를 기준으로 기록합니다.

현재 대시보드에서 증거가 확인되지 않은 항목은 `미확인`으로 표시합니다.

- 미확인은 성공을 의미하지 않습니다.
- 미확인은 실패를 의미하지 않습니다.
- 실제 심사 응답을 확인하기 전에는 통과로 기록하지 않습니다.
- 로컬 테스트 결과를 실제 심사 결과로 바꾸어 기록하지 않습니다.

## 로컬 설치 및 실행

### 1. 저장소 내려받기

```bash
git clone https://github.com/yurilee01/choi-bujang-secret-vault.git
cd choi-bujang-secret-vault
```

### 2. 의존성 설치

```bash
npm install
```

Node.js 22 이상을 사용합니다.

### 3. 로컬 빌드

```bash
npm run build -- --local
```

로컬 빌드는 화면 및 정적 결과물 확인용입니다. Vercel 배포나 심판 접수를 증명하지 않습니다.

## 주요 로컬 검사 명령

### 판정기 테스트

```bash
npm run decider:test
```

### 탐지기 테스트

```bash
npm run detect:test
```

### 로그인 검증 테스트

```bash
node --test test/verify-login.test.mjs
```

### 메모 API 테스트

```bash
node --test test/notes-api.test.mjs
```

### 패키지 테스트

```bash
npm run test:package
```

### R5 테스트

```bash
npm run test:r5
```

### 공개 결과물 빌드

```bash
npm run build -- --local
```

## 저장소 설정

`aleph.config.json`의 현재 주요 설정:

- `step`: 12
- `repoUrl`: GitHub 저장소 주소
- `publicAppUrl`: 설정된 Vercel 주소
- `judgeIssuer`: 기존 심판 주소
- `identityProvider`: Supabase 인증 정보
- `allowedRoutes`: 허용된 메모 API 경로
- `restoreRoute`: `/api/notes/restore`

`judgeIssuer`는 임의로 변경하지 않습니다.

## 배포 및 제출 주의사항

- Vercel 배포 환경변수는 배포 환경에서 확인해야 합니다.
- 로컬 빌드와 실제 배포는 별개의 작업입니다.
- `npm run bundle`은 외부 서비스에 실제 요청을 보낼 수 있으므로 실행 전에 요청 내용을 확인합니다.
- 실행하지 않은 검사는 통과로 기록하지 않습니다.
- `bundle-notes.json`과 `artifacts/submission.json`은 Git에 포함하지 않습니다.
- 심판 응답과 요청 ID는 실제로 확인한 값만 기록합니다.

## 보안 원칙

- 실제 개인정보와 학생 자료를 사용하지 않습니다.
- 비밀번호, 토큰, 서버 전용 키를 코드·로그·Git·제출 자료에 포함하지 않습니다.
- 브라우저에는 공개용 Publishable Key만 사용합니다.
- 사용자 권한은 화면이나 요청 본문의 역할 값만으로 판단하지 않습니다.
- 서버에서 인증 정보와 메모 소유권을 검증합니다.
- 가상 데이터 테스트와 실제 운영 결과를 구분합니다.
- 로컬 복구 연습을 실제 운영 DB 복구로 표현하지 않습니다.
- 탐지기의 회수 제안과 실제 계정·토큰 폐기를 구분합니다.
