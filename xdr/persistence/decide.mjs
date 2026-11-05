const PATTERNS = [
  {
    name: 'unsigned_new_service',
    match: (alert) => {
      const description = String(alert?.rule?.description ?? '');
      const path = String(alert?.data?.path ?? '');
      const count = Number(alert?.data?.count ?? 0);
      return /서명 없는 새 서비스|서명 없는 서비스 등록|서비스 실행 파일이 바뀌었고 서명이 없습니다|평소 목록에 없는 서비스.*등록/i.test(description) && (/\\AppData\\Local\\Temp\\/i.test(path) || count >= 3 || /평소 목록에 없는 서비스.*등록/i.test(description));
    },
    confidence: 0.98,
  },
  {
    name: 'unfamiliar_scheduled_task',
    match: (alert) => {
      const description = String(alert?.rule?.description ?? '');
      const path = String(alert?.data?.path ?? '');
      return /처음 보는 예약 작업|예약 작업 이름이 임의 문자열/i.test(description) && /\\AppData\\Local\\Temp\\/i.test(path);
    },
    confidence: 0.96,
  },
  {
    name: 'combined_startup_scheduled_task',
    match: (alert) => {
      const description = String(alert?.rule?.description ?? '');
      const path = String(alert?.data?.path ?? '');
      return /시작 프로그램과 예약 작업이 같은 임시 파일을 함께 가리킵니다/i.test(description) && /\\AppData\\Local\\Temp\\/i.test(path);
    },
    confidence: 0.93,
  },
  {
    name: 'startup_folder_change',
    match: (alert) => {
      const description = String(alert?.rule?.description ?? '');
      const path = String(alert?.data?.path ?? '');
      return /시작 폴더에 평소 목록에 없는 프로그램이 추가/i.test(description) && /\\Startup\\/i.test(path);
    },
    confidence: 0.95,
  },
];

export function decide(alert) {
  const matched = PATTERNS.find((pattern) => pattern.match(alert));

  if (matched) {
    return {
      action: matched.confidence >= 0.85 ? 'block' : 'alert',
      confidence: matched.confidence,
      reason: matched.name,
    };
  }

  const description = String(alert?.rule?.description ?? '');
  const ambiguous = /수업 중 예약 작업|시작 항목에 수업 도구|서비스 설명만|예약 작업이 하나 있고|임시 폴더에 실행 파일|시작 폴더 변경이 1건|예약 작업 이름이 수업 과제|서비스가 한 번 멈췄다가|서명은 확인되지 않았습니다|서명은 아직 모릅니다/i.test(description);

  if (ambiguous) {
    return {
      action: 'alert',
      confidence: 0.6,
      reason: 'ambiguous_persistence_indicator',
    };
  }

  return {
    action: 'record',
    confidence: 0.1,
    reason: 'no_supported_persistence_pattern',
  };
}
