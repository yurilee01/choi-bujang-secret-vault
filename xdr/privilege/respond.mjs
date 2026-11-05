import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decide } from './decide.mjs';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const fixturePath = join(root, 'xdr', 'fixtures', 'privilege.json');
const rulesPath = join(root, 'xdr', 'privilege', 'ztna-deny-rules.json');
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
    const now = new Date();
    let expiresAt = null;

    if (decision.action === 'block' && isValidIPv4(alert.data?.srcip)) {
      expiresAt = new Date(now.getTime() + EXPIRY_MINUTES * 60 * 1000).toISOString();
      denyRules.push({
        ruleId: 'xdr.privilege.' + alert.id,
        action: 'deny',
        sourceIp: alert.data.srcip,
        evidenceAlertId: alert.id,
        reason: decision.reason,
        createdAt: now.toISOString(),
        expiresAt,
      });
    }

    logLines.push(JSON.stringify({
      timestamp: now.toISOString(),
      alertId: alert.id,
      action: decision.action,
      reason: decision.reason,
      expiresAt,
    }));
  }

  await writeFile(rulesPath, JSON.stringify(denyRules, null, 2) + '\n', 'utf8');

  const existing = await readFile(logPath, 'utf8').catch(() => '');
  const preserved = existing.split('\n').filter(line => {
    if (line.trim() === '') return false;
    try { return JSON.parse(line).alertId?.startsWith('pv-') !== true; }
    catch { return true; }
  });
  await writeFile(logPath, [...preserved, ...logLines].join('\n') + '\n', 'utf8');

  return {
    totalAlerts: fixture.alerts.length,
    blockRules: denyRules.length,
    logEntries: logLines.length,
  };
}

const result = await respond();
console.log('전체 경보:', result.totalAlerts);
console.log('임시 차단 규칙:', result.blockRules);
console.log('로그 추가:', result.logEntries);
console.log('만료 시간:', EXPIRY_MINUTES + '분');
