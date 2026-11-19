# 최부장 비밀창고

로그인한 사용자만 자신의 비밀 메모를 관리할 수 있도록 만드는 보안 실습 프로젝트입니다. 프로젝트에 포함된 메모는 가상 자료이며, 실제 개인정보나 학생 자료를 사용하지 않습니다.

## 프로젝트 정보

- GitHub: https://github.com/yurilee01/choi-bujang-secret-vault
- 배포 주소: https://choi-bujang-secret-vault-umber-beta.vercel.app
- 사용 기술: Node.js, Vercel, Supabase Auth, Supabase Database
- 현재 작업 단계: 6단계 등록 기기만 자료실 접근 허용
- 추가 실습: 무차별 로그인 공격 방어(XDR)

## 1단계 — 공개 메모 데이터

### 학생이 하는 일

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 **Deploy** 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 본인 계정의 Public 저장소인지 확인한 뒤 Deploy를 누릅니다.
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

### 로컬 검사 결과

| 검사 | 실행 명령 | 결과 |
|---|---|---|
| 메모 API 테스트 | `node --test test/notes-api.test.mjs` | 9개 통과 |
| 패키지 테스트 | `npm run test:package` | 3개 통과 |
| R5 테스트 | `npm run test:r5` | 2개 통과 |
| 공격 검사 문법 | `node --check src/attack-check.mjs` | 오류 없음 |
| 로컬 빌드 | `npm run build -- --local` | 성공 |

위 결과는 로컬 검사 결과이며 실제 배포나 Supabase 연결 성공을 증명하지 않습니다.

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

## 개발 및 검사 명령어

```bash
npm install
npm run build -- --local
npm run test:package
npm run test:r5
node --test test/notes-api.test.mjs
```

## 보안 원칙

- 실제 개인정보와 학생 자료를 사용하지 않습니다.
- 비밀번호, 토큰, 서버 전용 키를 코드에 직접 입력하지 않습니다.
- 서버 전용 키를 브라우저 코드에 포함하지 않습니다.
- 사용자 인증 정보는 서버에서 검증합니다.
- 사용자 ID는 검증된 인증 정보에서 가져옵니다.
- 로컬 테스트 성공과 실제 배포 성공을 구분합니다.

## 6단계 저장점 — 등록 기기만 자료실 접근

- `src/decider.mjs`에 `device_registered` 규칙을 구현했습니다.
- `request.deviceRegistered === true`인 요청만 허용합니다.
- 미등록 기기는 `deny` 및 `device_not_registered`로 거부합니다.
- 요청·응답 형식은 `docs/DECIDER_REQUEST.md`를 따릅니다.
- `npm run decider:test`에서 등록 기기와 미등록 기기 가상 요청이 모두 통과했습니다.
- 위 테스트는 로컬 연습이며 실제 심판 판정 증거는 아닙니다.
