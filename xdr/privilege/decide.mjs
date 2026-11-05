const PATTERNS = [
  {
    name: 'rapid_privilege_command',
    match: (alert) => {
      const description = String(alert?.rule?.description ?? '');
      const mitre = alert?.rule?.mitre ?? [];
      return /관리자 그룹에 들어가고 곧바로 권한 명령을 실행|관리자 그룹 추가와 명령 실행이 같이|방금 관리자가 된 .*관리자 명령을 실행/i.test(description) && mitre.includes('T1078');
    },
    confidence: 0.98,
  },
  {
    name: 'multi_account_escalation',
    match: (alert) => {
      const description = String(alert?.rule?.description ?? '');
      const count = Number(alert?.data?.count ?? 0);
      return /계정 .*개가 관리자 그룹에 추가/i.test(description) && count >= 3 && String(alert?.data?.group ?? '').toLowerCase() === 'administrators';
    },
    confidence: 0.97,
  },
  {
    name: 'admin_group_escalation',
    match: (alert) => {
      const description = String(alert?.rule?.description ?? '');
      const group = String(alert?.data?.group ?? '').toLowerCase();
      return group === 'administrators' && /관리자 그룹에 추가|관리자 그룹에 들어왔/i.test(description) && Number(alert?.rule?.level ?? 0) >= 10;
    },
    confidence: 0.90,
  },
];

export function decide(alert) {
  const matched = PATTERNS.find((pattern) => pattern.match(alert));
  if (matched) {
    return {
      action: matched.confidence >= 0.85 ? 'block' : matched.confidence >= 0.5 ? 'alert' : 'record',
      confidence: matched.confidence,
      reason: matched.name,
    };
  }

  const description = String(alert?.rule?.description ?? '');
  const mitre = alert?.rule?.mitre ?? [];
  const ambiguous = mitre.some(code => code === 'T1068' || code === 'T1078') && /처음 보는 주소|권한 상승|관리자 명령|관리자 권한|관리자 그룹에서 빠진 계정/i.test(description);
  if (ambiguous) {
    return { action: 'alert', confidence: 0.6, reason: 'ambiguous_privilege_indicator' };
  }

  return { action: 'record', confidence: 0.1, reason: 'no_supported_privilege_pattern' };
}
