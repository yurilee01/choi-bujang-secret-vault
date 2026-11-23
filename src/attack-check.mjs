import { readFileSync } from 'node:fs';

export async function runAttackChecks(config) {
if (![1, 3, 5, 6, 7, 8, 9].includes(config.step)) {
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
      } catch {}
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
  } catch {}

  const denied = [401, 403].includes(response.status) && jsonError;

  const attempts = [{
    attackId: 'anonymous_note_read',
    expected: '비로그인 메모 목록 요청을 401 또는 403 JSON 오류로 거절',
    observed: denied
      ? `비로그인 요청이 JSON 오류로 거절됨 (HTTP ${response.status})`
      : `비로그인 요청 거절 확인 실패 (HTTP ${response.status}, JSON 오류: ${jsonError})`,
  }];

  if (config.step >= 5) {
    if (typeof config.originalApiUrl !== 'string') {
      throw new Error('원본 메모 API HTTPS 주소가 필요합니다.');
    }

    const originalUrl = new URL(config.originalApiUrl);

    if (
      originalUrl.protocol !== 'https:' ||
      originalUrl.username ||
      originalUrl.password ||
      originalUrl.search ||
      originalUrl.hash
    ) {
      throw new Error('원본 메모 API 주소를 확인해 주세요.');
    }

    const html = readFileSync(
      new URL('../public/index.html', import.meta.url),
      'utf8'
    );

    const keyStart = html.indexOf('SUPABASE_PUBLISHABLE_KEY');
    const equalsIndex = html.indexOf('=', keyStart);
    const quoteStart = html.indexOf(String.fromCharCode(39), equalsIndex);
    const quoteEnd = html.indexOf(String.fromCharCode(39), quoteStart + 1);
    const publishableKey = quoteStart >= 0 && quoteEnd > quoteStart
      ? html.slice(quoteStart + 1, quoteEnd)
      : null;

    if (!publishableKey || !publishableKey.startsWith('sb_publishable_')) {
      throw new Error('공개용 Supabase Publishable Key 설정을 확인해 주세요.');
    }

    const originalResponse = await fetch(originalUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        apikey: publishableKey,
      },
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });

    let originalJsonError = false;

    try {
      const data = await originalResponse.json();
      originalJsonError =
        data !== null &&
        typeof data === 'object' &&
        !Array.isArray(data) &&
        (typeof data.message === 'string' ||
          typeof data.error === 'string');
    } catch {}

    const originalDenied =
      [401, 403].includes(originalResponse.status) && originalJsonError;

    attempts.push({
      attackId: 'anonymous_original_api_read',
      expected: '공개용 키를 사용한 원본 메모 API 직접 읽기를 401 또는 403 JSON 오류로 거절',
      observed: originalDenied
        ? `원본 API 직접 요청이 JSON 오류로 거절됨 (HTTP ${originalResponse.status})`
        : `원본 API 직접 접근 차단 확인 실패 (HTTP ${originalResponse.status}, JSON 오류: ${originalJsonError})`,
    });
  }

  return attempts;
}