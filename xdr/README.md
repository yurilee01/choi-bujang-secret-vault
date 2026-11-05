# XDR 보너스 경보

이 폴더는 보너스 여섯 개의 연습 경보입니다. 경보는 수업용으로 만든 Wazuh 모양이며, 실제 로그가 아닙니다. 정답은 이 저장소에 없습니다.

## 경보 묶음

`xdr/fixtures/<moduleKey>.json` 을 읽습니다. `moduleKey` 는 아래 여섯 개입니다.

| moduleKey | 보는 것 |
|---|---|
| `brute-force` | 짧은 시간에 몰린 로그인 실패 |
| `web-injection` | 웹 요청에 섞인 주입 형태 |
| `known-cve` | 이미 공개된 취약점을 노린 요청 형태 |
| `persistence` | 다시 켜도 남도록 심긴 서비스·예약 작업 |
| `privilege` | 평범한 계정의 갑작스러운 권한 상승 |
| `exfiltration` | 처음 보는 곳으로 빠지는 큰 전송 |

한 파일에는 명확한 공격, 애매한 시도, 정상 이벤트가 함께 들어 있습니다. 주소는 문서용 대역만 쓰고, 계정은 `user01` 같은 가상 이름입니다. `known-cve` 의 원격 조회 구문은 문서용 표기입니다. 그 문자열을 다른 시스템에 넣거나 변형하지 않습니다.

## 학생이 만드는 파일

항목마다 `xdr/<moduleKey>/decide.mjs` 를 만듭니다. `decide(alert)` 를 내보냅니다. 비동기 함수여도 됩니다. 반환은 아래 세 값입니다.

- `action`: `block`, `alert`, `record` 중 하나
- `confidence`: 0 이상 1 이하 숫자
- `reason`: 짧은 이유

명확한 공격은 `block`, 애매한 시도는 `alert`, 정상 이벤트는 `record` 입니다. 경보 원본은 고치지 않습니다.

## 실행

저장소 루트에서 항목 키 하나를 넣습니다.

```
node scripts/xdr-run.mjs brute-force
```

`npm run xdr:run -- brute-force` 도 같은 명령입니다. 실행기는 해당 경보마다 `decide` 를 부르고, 결과를 `xdr/<moduleKey>/result.json` 에 씁니다. 형식은 `aleph.xdr.result.v1` 이고, `decisions` 에는 경보 id·행동·확신도·이유가, `counts` 에는 `block`·`alert`·`record` 건수가 있습니다.

반환 형식이 틀린 경보는 `record` 로 남고, 오류 한 줄이 출력됩니다. 실행기 자체는 네트워크를 쓰지 않습니다. 판정자는 격리된 환경에서 같은 명령을 다시 실행해 결과를 봅니다. 이미 커밋된 `result.json` 만으로 판정이 끝나지 않습니다.

## 심판 격리 환경에서 지킬 것

심판은 인터넷 없이 `decide.mjs` 한 파일을 불러와 경보마다 바로 답을 받습니다. 이 파일이 돌지 못하면 건수를 셀 수 없어 `XDR_DECIDE_NOT_RUNNING` 으로 끝납니다.

- `decide.mjs` 에는 `import` 문을 두지 않습니다. 필요한 패턴은 `patterns.json` 에서 파일 맨 위 상수로 옮겨 적습니다.
- 파일을 읽거나 쓰지 않고, 바깥에 묻지 않고, 그 파일 안에서 혼자 계산해 답합니다. 경보 하나에 2초 안에 답합니다.
- `confidence`(확신도)는 경보가 패턴과 얼마나 뚜렷하게 맞는지를 `decide` 가 스스로 0~1 로 매긴 값입니다.
- `xdr/alerts.log` 기록과 판정기 연결은 `respond.mjs` 같은 다른 파일에서 합니다. `decide.mjs` 는 판단 결과만 돌려줍니다.

인터넷을 끈 상태에서 `npm run xdr:run -- <moduleKey>` 를 돌려도 같은 결과가 나오면 심판에서도 같은 결과가 나옵니다.

## web-injection 대응 결과

`web-injection`은 MITRE ATT&CK T1190을 참고해 SQL 삽입, 스크립트 삽입, 경로 탐색의 반복 패턴을 탐지합니다.

- `read-alerts.mjs`: 원본 경보에서 필요한 항목만 추출합니다.
- `patterns.json`: 탐지 조건과 근거를 기록합니다.
- `decide.mjs`: 파일·네트워크 접근 없이 경보를 판정합니다.
- `respond.mjs`: 명확한 공격 후보에 한해 15분 만료의 로컬 ZTNA deny 규칙과 `xdr/alerts.log` 기록을 생성합니다.

실행 방법:

```bash
npm run xdr:run -- web-injection
node xdr/web-injection/respond.mjs
```

검증 결과: 전체 26건 중 차단 7건, 경고 3건, 기록 16건이며 정상·애매한 이벤트의 오차단은 0건입니다. 차단 규칙에는 증거 경보 ID와 만료 시간이 포함됩니다.

※ 대응 결과는 로컬 연습용 규칙 파일이며 실제 네트워크 장비에 차단 정책을 적용한 것은 아닙니다.


## known-cve 대응 결과

known-cve는 MITRE ATT&CK T1190과 CVE-2021-44228 요청 형태를 참고해 원격 조회 구문과 취약점 점검 흔적을 판별합니다.

- read-alerts.mjs: 원본 경보 24건에서 필요한 항목만 추출합니다.
- patterns.json: 탐지 조건과 근거를 기록합니다.
- decide.mjs: 외부 의존성 없이 경보를 block, alert, record로 판정합니다.
- respond.mjs: 차단 후보에 한해 15분 만료의 로컬 ZTNA deny 규칙을 만들고, 전체 경보 24건을 xdr/alerts.log에 추가합니다.

실행 방법:

npm run xdr:run -- known-cve
node xdr/known-cve/respond.mjs

검증 결과: 전체 24건 중 차단 8건, 경고 3건, 기록 13건이며 정상 사용자 이벤트의 오차단은 0건입니다. 차단 규칙에는 증거 경보 ID와 만료 시간이 포함됩니다.

※ 대응 결과는 로컬 연습용 규칙 파일이며 실제 ZTNA 판정기나 네트워크 장비에 차단 정책을 적용한 것은 아닙니다.
