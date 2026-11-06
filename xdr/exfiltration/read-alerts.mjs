import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function readAlerts(root) {
  const filePath = join(root, 'xdr', 'fixtures', 'exfiltration.json');
  const fixture = JSON.parse(await readFile(filePath, 'utf8'));

  return fixture.alerts.map((alert) => ({
    id: alert.id,
    timestamp: alert.timestamp,
    srcip: alert.data?.srcip ?? null,
    srcuser: alert.data?.srcuser ?? null,
    level: alert.rule?.level ?? null,
    description: alert.rule?.description ?? ''
  }));
}
