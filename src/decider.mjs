
// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기입니다.
export const RULE_IDS = Object.freeze([
  'device_registered',
  'step_up_required',
  'note_resource_access',
  'class_announcement_read',
  'instructor_material_denied',
  'unknown_resource_denied',
]);

const REASONS = Object.freeze({
  approved: 'approved',
  deviceDenied: 'device_not_registered',
  stepUp: 'step_up_required',
  resourceDenied: 'resource_access_denied',
  unknownDenied: 'unknown_resource_denied',
});

function isValidFixtureInput(request) {
  const signals = request.signals;

  if (signals?.source === 'none') return true;

  if (signals?.source !== 'judge_fixture') return false;

  if (
    typeof signals.region !== 'string'
    || typeof signals.network !== 'string'
    || !Number.isInteger(signals.hour)
    || signals.hour < 0
    || signals.hour > 23
  ) {
    return false;
  }

  if (
    !Array.isArray(request.recentEvents)
    || request.recentEvents.length > 12
  ) {
    return false;
  }

  return request.recentEvents.every(event =>
    event
    && typeof event.kind === 'string'
    && Number.isFinite(event.ageSeconds)
    && event.ageSeconds >= 0
    && Number.isFinite(event.count)
    && event.count >= 0
  );
}

function hasFixtureRisk(request) {
  const signals = request.signals;

  if (signals.source !== 'judge_fixture') return false;

  const unusualTime = signals.hour <= 5 || signals.hour >= 22;
  const unfamiliarNetwork = signals.network === 'unusual';

  const recentHighVolume = request.recentEvents.some(event =>
    event.kind === 'risk_signal'
    && event.ageSeconds <= 300
    && event.count >= 20
  );

  return unusualTime && unfamiliarNetwork && recentHighVolume;
}

function hasRecentStepUp(request) {
  const stepUp = request.stepUp;

  return stepUp?.verified === true
    && Number.isFinite(stepUp.authAgeSeconds)
    && stepUp.authAgeSeconds >= 0
    && stepUp.authAgeSeconds <= 300;
}

function response(request, decision, reasonCode, ruleIds) {
  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision,
    reasonCode,
    ruleIds,
  };
}

function deny(request, reasonCode, ruleId) {
  return response(request, 'deny', reasonCode, [ruleId]);
}

// 서비스별 자료 접근 규칙
function checkResourceAccess(request) {
  const { service, method, path, route } = request;

  // 메모: ID가 있는 개별 자료 경로만 허용
  if (service === 'notes') {
    const validPath =
      typeof path === 'string'
      && /^\/notes\/[^/]+$/.test(path);

    const validRoute =
      route === 'GET /notes/:id'
      || route === 'PUT /notes/:id'
      || route === 'DELETE /notes/:id';

    const validMethod =
      method === 'GET'
      || method === 'PUT'
      || method === 'DELETE';

    if (validPath && validRoute && validMethod) {
      return response(
        request,
        'allow',
        REASONS.approved,
        ['note_resource_access'],
      );
    }

    return deny(
      request,
      REASONS.resourceDenied,
      'note_resource_access',
    );
  }

  // 수업 공지사항: 읽기만 허용
  if (
    service === 'class_announcements'
    || service === 'announcements'
  ) {
    const validPath =
      typeof path === 'string'
      && /^\/(?:class-)?announcements\/[^/]+$/.test(path);

    const validRoute =
      route === 'GET /announcements/:id'
      || route === 'GET /class-announcements/:id';

    if (
      method === 'GET'
      && validPath
      && validRoute
    ) {
      return response(
        request,
        'allow',
        REASONS.approved,
        ['class_announcement_read'],
      );
    }

    return deny(
      request,
      REASONS.resourceDenied,
      'class_announcement_read',
    );
  }

  // 강사 자료: 학생 판정기에서는 전부 거부
  if (
    service === 'instructor_materials'
    || service === 'instructor-materials'
  ) {
    return deny(
      request,
      REASONS.resourceDenied,
      'instructor_material_denied',
    );
  }

  // 알 수 없는 서비스와 경로는 거부
  return deny(
    request,
    REASONS.unknownDenied,
    'unknown_resource_denied',
  );
}

export async function decide(request) {
  // 기존 기기 등록 검사
  if (request.deviceRegistered !== true) {
    return response(
      request,
      'deny',
      REASONS.deviceDenied,
      ['device_registered'],
    );
  }

  // 기존 신호 검증
  if (!isValidFixtureInput(request)) {
    return response(
      request,
      'step_up',
      REASONS.stepUp,
      ['step_up_required'],
    );
  }

  // 기존 복합 이상 접속 재인증
  if (hasFixtureRisk(request) && !hasRecentStepUp(request)) {
    return response(
      request,
      'step_up',
      REASONS.stepUp,
      ['step_up_required'],
    );
  }

  return checkResourceAccess(request);
}
