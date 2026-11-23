
export const RULE_IDS = Object.freeze([
  'device_registered',
  'step_up_required',
  'note_resource_access',
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

function checkResourceAccess(request) {
  const { service, method, path, route, queryLength } = request;

  // 쿼리가 포함된 요청은 허용하지 않습니다.
  if (queryLength !== 0) {
    return deny(
      request,
      REASONS.unknownDenied,
      'unknown_resource_denied',
    );
  }

  // 메모는 ID가 있는 단건 GET만 허용합니다.
  if (service === 'notes') {
    const validPath =
      typeof path === 'string'
      && /^\/notes\/[^/]+$/.test(path);

    const validRoute = route === 'GET /notes/:id';

    if (method === 'GET' && validPath && validRoute) {
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

  // 강사 자료는 모두 거부합니다.
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

  // 공지사항을 포함해 등록되지 않은 서비스와 경로는 모두 거부합니다.
  return deny(
    request,
    REASONS.unknownDenied,
    'unknown_resource_denied',
  );
}

export async function decide(request) {
  if (request.deviceRegistered !== true) {
    return response(
      request,
      'deny',
      REASONS.deviceDenied,
      ['device_registered'],
    );
  }

  if (!isValidFixtureInput(request)) {
    return response(
      request,
      'step_up',
      REASONS.stepUp,
      ['step_up_required'],
    );
  }

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
