// MITRE ATT&CK: T1190 - Exploit Public-Facing Application

const PATTERNS = [
  {
    name: 'repeated_sql_injection',
    match: (description, count) =>
      /SQL 구문을 이어 붙인 요청|SQL 구문 표기|SQL 표식이 같은 주소에서 번갈아|데이터베이스 조회를 이어 붙이는 표기/.test(description) &&
      count >= 8,
    confidence: 0.98,
  },
  {
    name: 'repeated_script_injection',
    match: (description, count) =>
      /스크립트 삽입 표기/.test(description) &&
      count >= 8,
    confidence: 0.97,
  },
  {
    name: 'repeated_path_traversal',
    match: (description, count) =>
      /경로를 여러 단계 거슬러 올라가는 표기|경로 이탈 표기/.test(description) &&
      count >= 8,
    confidence: 0.96,
  },
];

export function decide(alert) {
  const description = String(alert?.rule?.description ?? '');
  const count = Number(alert?.data?.count ?? 0);

  const matched = PATTERNS.find((pattern) =>
    pattern.match(description, count)
  );

  if (matched) {
    return {
      action: 'block',
      confidence: matched.confidence,
      reason: matched.name,
    };
  }

  const ambiguous =
    count > 0 &&
    /주입처럼 보이는 표기|이상한 검색|따옴표/.test(description);

  if (ambiguous) {
    return {
      action: 'alert',
      confidence: 0.6,
      reason: 'ambiguous_single_indicator',
    };
  }

  return {
    action: 'record',
    confidence: 0.1,
    reason: 'no_supported_attack_pattern',
  };
}
