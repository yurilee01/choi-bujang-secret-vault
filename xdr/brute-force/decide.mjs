// MITRE ATT&CK: T1110 - Brute Force

const PATTERNS = [
  {
    id: 'rapid_failures',
    indicators: ['2분 안에 로그인 실패', '1분 안에 로그인 실패'],
    confidence: 0.98,
  },
  {
    id: 'password_spraying',
    indicators: ['여러 계정에 같은 비밀번호', '계정 20개', '서로 다른 계정'],
    confidence: 0.96,
  },
  {
    id: 'account_enumeration',
    indicators: ['계정 이름을 바꿔'],
    confidence: 0.90,
  },
];

export function decide(alert) {
  const description = String(alert?.rule?.description ?? '');
  const level = Number(alert?.rule?.level ?? 0);

  // 경보 설명과 등급을 확인할 수 없으면 기록만 남깁니다.
  if (!description || !Number.isFinite(level)) {
    return {
      action: 'record',
      confidence: 0.1,
      reason: '경보 정보가 부족하여 기록만 남깁니다.',
    };
  }

  // 일반적인 정상 활동은 차단하지 않습니다.
  if (level <= 3) {
    return {
      action: 'record',
      confidence: 0.1,
      reason: '낮은 등급의 일반 활동으로 판단했습니다.',
    };
  }

  // 강한 공격 징후를 먼저 검사합니다.
  const pattern = PATTERNS.find((item) =>
    item.indicators.some((indicator) => description.includes(indicator))
  );

  const failureCount = Number(description.match(/(\d+)\s*건/)?.[1] ?? 0);

  const highVolumeAttack =
    level >= 10 && failureCount >= 30;

  const passwordVariationAttack =
    level >= 10 && description.includes('비밀번호를 한 글자씩 바꿔');

  const repeatedSameAccountAttack =
    level >= 10 &&
    description.includes('같은 계정') &&
    failureCount >= 30;

  if (
    pattern ||
    highVolumeAttack ||
    passwordVariationAttack ||
    repeatedSameAccountAttack
  ) {
    return {
      action: 'block',
      confidence: pattern?.confidence ?? 0.95,
      reason: '대량 로그인 실패 또는 비밀번호 반복 시도 등 강한 공격 징후가 확인됐습니다.',
    };
  }

  // 실패가 반복되지만 공격 여부가 확실하지 않은 경우입니다.
  if (description.includes('실패') && level >= 5) {
    return {
      action: 'alert',
      confidence: 0.65,
      reason: '로그인 실패가 반복되어 추가 확인이 필요합니다.',
    };
  }

  return {
    action: 'record',
    confidence: 0.2,
    reason: '뚜렷한 공격 징후가 확인되지 않아 기록만 남깁니다.',
  };
}
