
// ALEPH SDP 엔진이 확인한 요청만 받는 학생 판정기입니다.
export const RULE_IDS = Object.freeze([
  'device_registered',
  'step_up_required',
]);

function isValidFixtureInput(request) {
  const signals = request.signals;

  // 실제 경로의 신호 없음은 계약에 명시된 상태입니다.
  if (signals?.source === 'none') return true;

  // 가상 검증 신호만 별도로 검사합니다.
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

function response(request, decision, reasonCode, ruleIds) {
  return {
    schema: 'aleph.decision.v1',
    requestId: request.requestId,
    decision,
    reasonCode,
    ruleIds,
  };
}

export async function decide(request) {
  if (request.deviceRegistered !== true) {
    return response(
      request,
      'deny',
      'device_not_registered',
      ['device_registered'],
    );
  }

  if (!isValidFixtureInput(request)) {
    return response(
      request,
      'step_up',
      'step_up_required',
      ['step_up_required'],
    );
  }

  if (hasFixtureRisk(request)) {
    return response(
      request,
      'step_up',
      'step_up_required',
      ['step_up_required'],
    );
  }

  return response(request, 'allow', 'approved', ['device_registered']);
}
