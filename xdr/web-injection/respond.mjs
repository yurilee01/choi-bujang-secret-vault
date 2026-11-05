import { readFile, writeFile, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide } from './decide.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const fixturePath = join(root, 'xdr', 'fixtures', 'web-injection.json');
const rulesPath = join(root, 'xdr', 'web-injection', 'ztna-deny-rules.json');
const logPath = join(root, 'xdr', 'alerts.log');

const EXPIRY_MINUTES = 15;

function isValidIPv4(value) {
  const parts = String(value ?? '').split('.');
  return parts.length === 4 &&
    parts.every(part =>
      /^\d{1,3}$/.test(part) &&
      Number(part) >= 0 &&
      Number(part) <= 255
    );
}

export async function respond() {
  const fixture = JSON.parse(await readFile(fixturePath, 'utf8'));
  const denyRules = [];
  const logLines = [];

  for (const alert of fixture.alerts) {
    const decision = decide(alert);

    if (decision.action !== 'block') continue;

    const sourceIp = alert.data?.srcip;
    if (!isValidIPv4(sourceIp)) continue;

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + EXPIRY_MINUTES * 60 * 1000
    ).toISOString();

    const rule = {
      ruleId: `xdr.web-injection.${alert.id}`,
      action: 'deny',
      sourceIp,
      evidenceAlertId: alert.id,
      reason: decision.reason,
      createdAt: now.toISOString(),
      expiresAt,
    };

    denyRules.push(rule);
    logLines.push(JSON.stringify({
      timestamp: now.toISOString(),
      alertId: alert.id,
      action: 'block',
      reason: decision.reason,
      expiresAt,
    }));
  }

  await writeFile(
    rulesPath,
    `${JSON.stringify(denyRules, null, 2)}\n`,
    'utf8'
  );

  if (logLines.length > 0) {
    await appendFile(logPath, `${logLines.join('\n')}\n`, 'utf8');
  }

  return {
    blockRules: denyRules.length,
    logEntries: logLines.length,
  };
}

const result = await respond();
console.log('임시 차단 규칙:', result.blockRules);
console.log('로그 추가:', result.logEntries);
console.log('만료 시간:', `${EXPIRY_MINUTES}분`);
