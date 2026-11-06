// The student changes this check as each stage adds an attack to the same app.
// Never return tokens, private keys, real names, or note bodies.
export async function runAttackChecks(config) {
  if (![1, 3].includes(config.step)) {
    throw new Error('이 단계의 공격 점검을 src/attack-check.mjs에 구현해 주세요.');
  }

  let app;
  try {
    app = new URL(config.publicAppUrl);
  } catch {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }

  if (
    app.protocol !== 'https:' ||
    app.username ||
    app.password ||
    app.search ||
    app.hash ||
    app.pathname !== '/' ||
    app.hostname.endsWith('.example')
  ) {
    throw new Error('aleph.config.json의 실제 배포 주소를 먼저 넣어 주세요.');
  }

  if (config.step === 1) {
    if (typeof config.sampleMarker !== 'string' || !config.sampleMarker) {
      throw new Error('가상 메모의 확인 표시를 넣어 주세요.');
    }

    const response = await fetch(new URL('/data.json', app), {
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });

    let visible = false;

    if (response.ok) {
      try {
        const data = await response.json();
        visible =
          data?.sampleMarker === config.sampleMarker &&
          Array.isArray(data.notes) &&
          data.notes.length > 0;
      } catch {
        // A non-JSON response is a failed check.
      }
    }

    return [{
      attackId: 'anonymous_note_read',
      expected: '비로그인 화면에서 가상 메모를 확인',
      observed: visible
        ? '비로그인 요청에서 공개 가상 메모 확인 표시가 보임'
        : `비로그인 요청에서 확인 표시가 보이지 않음 (HTTP ${response.status})`,
    }];
  }

  const response = await fetch(new URL('/api/notes', app), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });

  let jsonError = false;

  try {
    const data = await response.json();
    jsonError =
      data !== null &&
      typeof data === 'object' &&
      typeof data.error === 'string';
  } catch {
    // HTML or invalid JSON is not a successful denial.
  }

  const denied =
    [401, 403].includes(response.status) && jsonError;

  return [{
    attackId: 'anonymous_note_read',
    expected: '비로그인 메모 목록 요청을 401 또는 403 JSON 오류로 거절',
    observed: denied
      ? `비로그인 요청이 JSON 오류로 거절됨 (HTTP ${response.status})`
      : `비로그인 요청 거절 확인 실패 (HTTP ${response.status}, JSON 오류: ${jsonError})`,
  }];
}