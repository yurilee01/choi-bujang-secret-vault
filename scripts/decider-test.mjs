
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureRequests } from './fixture-7.mjs';

const RESPONSE_KEYS = 'decision,reasonCode,requestId,ruleIds,schema';

function validResponse(request, response, ruleIds) {
  return response && typeof response === 'object' && !Array.isArray(response)
    && Object.keys(response).sort().join(',') === RESPONSE_KEYS
    && response.schema === 'aleph.decision.v1'
    && response.requestId === request.requestId
    && ['allow', 'deny', 'step_up'].includes(response.decision)
    && typeof response.reasonCode === 'string'
    && /^[a-z][a-z0-9_]{0,63}$/u.test(response.reasonCode)
    && Array.isArray(response.ruleIds) && response.ruleIds.length > 0
    && response.ruleIds.every(id => ruleIds.includes(id));
}

function resourceRequest(service, method, path, route) {
  return {
    schema: 'aleph.decision.v1',
    requestId: randomUUID(),
    classId: 'class_fixture',
    projectId: 'project_fixture',
    subjectId: 'subject_fixture',
    deviceId: '0123456789abcdef',
    service,
    method,
    path,
    route,
    queryLength: 0,
    querySha256: 'a'.repeat(64),
    at: new Date().toISOString(),
    policyRevision: 'fixture',
    deviceRegistered: true,
    stepUp: { verified: false, authAgeSeconds: null },
    recentEvents: [],
    signals: {
      source: 'none',
      region: 'unknown',
      network: 'unknown',
      hour: 12,
    },
  };
}

// 로컬 가상 요청으로만 확인하는 연습 테스트입니다.
export async function checkDecider({ decide, ruleIds }) {
  if (typeof decide !== 'function' || !Array.isArray(ruleIds)
      || !ruleIds.includes('device_registered')) {
    throw new Error('device_registered 규칙을 먼저 구현하고 RULE_IDS에 적어 주세요.');
  }

  const { normal, suspicious } = fixtureRequests();

  const checks = [
    { name: '등록 기기의 정상 요청', request: normal, decision: 'allow' },
    {
      name: '미등록 기기의 가상 요청',
      request: {
        ...normal,
        requestId: randomUUID(),
        deviceRegistered: false,
      },
      decision: 'deny',
      reasonCode: 'device_not_registered',
    },
  ];

  if (ruleIds.includes('step_up_required')) {
    checks.push(
      {
        name: '복합 이상 접속',
        request: suspicious,
        decision: 'step_up',
        reasonCode: 'step_up_required',
      },
      {
        name: '다시 확인한 복합 이상 접속',
        request: {
          ...suspicious,
          requestId: randomUUID(),
          stepUp: { verified: true, authAgeSeconds: 60 },
        },
        decision: 'allow',
        reasonCode: 'approved',
      },
      {
        name: '5분이 지난 재확인',
        request: {
          ...suspicious,
          requestId: randomUUID(),
          stepUp: { verified: true, authAgeSeconds: 301 },
        },
        decision: 'step_up',
        reasonCode: 'step_up_required',
      },
      {
        name: '확인되지 않은 재인증',
        request: {
          ...suspicious,
          requestId: randomUUID(),
          stepUp: { verified: false, authAgeSeconds: null },
        },
        decision: 'step_up',
        reasonCode: 'step_up_required',
      },
    );
  }

  const resourceChecks = [
    {
      name: '개별 메모 조회 허용',
      request: resourceRequest('notes', 'GET', '/notes/demo', 'GET /notes/:id'),
      decision: 'allow',
    },
    {
      name: '개별 메모 수정 허용',
      request: resourceRequest('notes', 'PUT', '/notes/demo', 'PUT /notes/:id'),
      decision: 'allow',
    },
    {
      name: '메모 목록 경로 거부',
      request: resourceRequest('notes', 'GET', '/notes', 'GET /notes'),
      decision: 'deny',
    },
    {
      name: '메모 생성 경로 거부',
      request: resourceRequest('notes', 'POST', '/notes', 'POST /notes'),
      decision: 'deny',
    },
    {
      name: '공지사항 조회 허용',
      request: resourceRequest(
        'class_announcements',
        'GET',
        '/announcements/demo',
        'GET /announcements/:id',
      ),
      decision: 'allow',
    },
    {
      name: '공지사항 수정 거부',
      request: resourceRequest(
        'class_announcements',
        'PUT',
        '/announcements/demo',
        'PUT /announcements/:id',
      ),
      decision: 'deny',
    },
    {
      name: '강사 자료 접근 거부',
      request: resourceRequest(
        'instructor_materials',
        'GET',
        '/materials/demo',
        'GET /materials/:id',
      ),
      decision: 'deny',
    },
    {
      name: '알 수 없는 서비스 거부',
      request: resourceRequest(
        'unknown_service',
        'GET',
        '/unknown/demo',
        'GET /unknown/:id',
      ),
      decision: 'deny',
    },
  ];

  checks.push(...resourceChecks);

  const results = [];

  for (const item of checks) {
    const response = await decide(item.request);

    const valid = validResponse(item.request, response, ruleIds)
      && response.decision === item.decision
      && (!item.reasonCode || response.reasonCode === item.reasonCode);

    results.push({ name: item.name, passed: valid });
  }

  return results;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { decide, RULE_IDS } = await import('../src/decider.mjs');
    const results = await checkDecider({ decide, ruleIds: RULE_IDS });

    for (const item of results) {
      process.stdout.write(`${item.passed ? '통과' : '확인 필요'} · ${item.name}\n`);
    }

    process.stdout.write('이 명령은 가상 요청으로 연습하며 심판 통과 증거가 아닙니다.\n');

    if (results.some(item => !item.passed)) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(`판정기 연습 첫 오류: ${error.message}\n`);
    process.exitCode = 1;
  }
}
