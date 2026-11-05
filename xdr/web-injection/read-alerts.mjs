import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function readAlerts(root) {
  const filePath = join(root, 'xdr', 'fixtures', 'web-injection.json');
  const fixture = JSON.parse(await readFile(filePath, 'utf8'));

  if (
    fixture?.schema !== 'aleph.xdr.fixture.v1' ||
    fixture.moduleKey !== 'web-injection' ||
    !Array.isArray(fixture.alerts)
  ) {
    throw new Error('경보 파일 형식이 올바르지 않습니다.');
  }

  return fixture.alerts.map((alert) => ({
    timestamp: alert.timestamp ?? '',
    srcip: alert.data?.srcip ?? '',
    srcuser: alert.data?.srcuser ?? '',
    level: alert.rule?.level ?? 0,
    description: alert.rule?.description ?? '',
  }));
}
