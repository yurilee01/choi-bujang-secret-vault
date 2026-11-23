
import {
  copyFile,
  mkdir,
  readFile,
  writeFile,
  access,
  rename,
} from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';

const ROOT = process.cwd();
const BACKUP_DIR = path.join(ROOT, 'artifacts', 'policy-backup', 'v1');
const DRILL_DIR = path.join(ROOT, 'artifacts', 'policy-drill');
const MANIFEST_PATH = path.join(BACKUP_DIR, 'manifest.json');

const TARGETS = [
  'src/decider.mjs',
  'aleph.config.json',
  'supabase/notes.sql',
];

const SAFE_ROUTE = 'GET /api/notes/:id';
const ATTACK_ROUTE = 'POST /api/notes/:id';

function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function verifyBackup() {
  if (!(await exists(MANIFEST_PATH))) {
    throw new Error('backup_manifest_missing_stop');
  }

  const manifest = JSON.parse(
    await readFile(MANIFEST_PATH, 'utf8'),
  );

  if (manifest.version !== 'policy-v1') {
    throw new Error('backup_version_mismatch_stop');
  }

  for (const target of TARGETS) {
    const record = manifest.files?.[target];

    if (!record) {
      throw new Error(`backup_record_missing:${target}`);
    }

    const backupPath = path.join(BACKUP_DIR, target);
    const backup = await readFile(backupPath);

    if (sha256(backup) !== record.sha256) {
      throw new Error(`backup_hash_mismatch:${target}`);
    }
  }

  console.log('통과 · 안전 백업 3개 해시 검증');
  return manifest;
}

async function createVerifiedBackup() {
  if (await exists(BACKUP_DIR)) {
    throw new Error('backup_already_exists_stop');
  }

  await mkdir(BACKUP_DIR, { recursive: true });

  const files = {};

  for (const target of TARGETS) {
    const sourcePath = path.join(ROOT, target);
    const backupPath = path.join(BACKUP_DIR, target);
    const content = await readFile(sourcePath);

    await mkdir(path.dirname(backupPath), { recursive: true });
    await writeFile(backupPath, content, { flag: 'wx' });

    files[target] = {
      sha256: sha256(content),
    };
  }

  const manifest = {
    version: 'policy-v1',
    createdAt: new Date().toISOString(),
    files,
  };

  await writeFile(
    MANIFEST_PATH,
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: 'wx' },
  );

  console.log('완료 · 안전 정책 백업 3개 생성');
  return manifest;
}

async function createAttackCopy(manifest) {
  if (await exists(DRILL_DIR)) {
    throw new Error('drill_copy_already_exists_stop');
  }

  await mkdir(DRILL_DIR, { recursive: true });

  for (const target of TARGETS) {
    const source = path.join(BACKUP_DIR, target);
    const destination = path.join(DRILL_DIR, target);

    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }

  const configPath = path.join(DRILL_DIR, 'aleph.config.json');
  const original = await readFile(configPath, 'utf8');

  if (!original.includes(`"${SAFE_ROUTE}"`)) {
    throw new Error('drill_target_rule_not_found_stop');
  }

  const modified = original.replace(
    `"${SAFE_ROUTE}"`,
    `"${ATTACK_ROUTE}"`,
  );

  await writeFile(configPath, modified);

  const verified = await readFile(
    path.join(BACKUP_DIR, 'aleph.config.json'),
  );

  if (
    sha256(verified) !==
    manifest.files['aleph.config.json'].sha256
  ) {
    throw new Error('verified_backup_changed_stop');
  }

  console.log('\n===== 복원 기준 버전 =====');
  console.log(`버전: ${manifest.version}`);
  console.log(
    `설정 파일 SHA-256: ${manifest.files['aleph.config.json'].sha256}`,
  );

  console.log('\n===== 시험 정책에서 바뀐 한 줄 =====');
  console.log(`안전 정책: "${SAFE_ROUTE}"`);
  console.log(`시험 정책: "${ATTACK_ROUTE}"`);

  console.log('\n===== 변경 범위 =====');
  console.log('시험 사본: artifacts/policy-drill/aleph.config.json');
  console.log('안전 백업: artifacts/policy-backup/v1/');
  console.log('실제 운영 정책: 변경하지 않음');
}

async function getRestorePlan(manifest) {
  const backupPath = path.join(BACKUP_DIR, 'aleph.config.json');
  const drillPath = path.join(DRILL_DIR, 'aleph.config.json');

  if (!(await exists(drillPath))) {
    throw new Error('drill_config_missing_stop');
  }

  const backupText = await readFile(backupPath, 'utf8');
  const drillText = await readFile(drillPath, 'utf8');

  const backupConfig = JSON.parse(backupText);
  const drillConfig = JSON.parse(drillText);

  if (
    JSON.stringify(drillConfig.allowedRoutes) !==
    JSON.stringify([ATTACK_ROUTE])
  ) {
    throw new Error('unexpected_drill_routes_stop');
  }

  const expectedConfig = {
    ...backupConfig,
    allowedRoutes: [ATTACK_ROUTE],
  };

  if (
    JSON.stringify(drillConfig) !==
    JSON.stringify(expectedConfig)
  ) {
    throw new Error('unexpected_policy_change_stop');
  }

  if (
    JSON.stringify(backupConfig.allowedRoutes) !==
    JSON.stringify([SAFE_ROUTE])
  ) {
    throw new Error('backup_route_unexpected_stop');
  }

  return {
    backupText,
    drillText,
    backupConfig,
    drillConfig,
    targetHash: manifest.files['aleph.config.json'].sha256,
  };
}

function printRestorePlan(manifest) {
  console.log('\n===== 복원 계획 =====');
  console.log(`복원 기준: ${manifest.version}`);
  console.log(
    `백업 SHA-256: ${manifest.files['aleph.config.json'].sha256}`,
  );
  console.log(`현재 시험 경로: ${ATTACK_ROUTE}`);
  console.log(`복원할 경로: ${SAFE_ROUTE}`);

  console.log('\n===== 변경 대상 =====');
  console.log('파일: artifacts/policy-drill/aleph.config.json');
  console.log('항목: allowedRoutes');

  console.log('\n===== 보존 대상 =====');
  console.log('판정 규칙 사본: 변경하지 않음');
  console.log('DB 정책 사본: 변경하지 않음');
  console.log('다른 서비스 규칙: 변경하지 않음');
  console.log('감사 기록: 변경하지 않음');
  console.log('실제 운영 정책 및 DB: 접근하지 않음');
}

async function planRestore() {
  const manifest = await verifyBackup();
  await getRestorePlan(manifest);
  printRestorePlan(manifest);
  console.log('\n완료 · 복원 계획 확인만 수행함');
  console.log('실제 복원은 아직 실행하지 않음');
}

async function restoreDrill() {
  const manifest = await verifyBackup();
  const plan = await getRestorePlan(manifest);

  printRestorePlan(manifest);

  const drillPath = path.join(DRILL_DIR, 'aleph.config.json');
  const tempPath = `${drillPath}.restore.tmp`;

  await writeFile(tempPath, plan.backupText, { flag: 'wx' });
  await rename(tempPath, drillPath);

  const restored = await readFile(drillPath);

  if (sha256(restored) !== plan.targetHash) {
    throw new Error('restored_config_hash_mismatch_stop');
  }

  const restoredConfig = JSON.parse(restored.toString('utf8'));

  if (
    JSON.stringify(restoredConfig.allowedRoutes) !==
    JSON.stringify([SAFE_ROUTE])
  ) {
    throw new Error('restored_route_mismatch_stop');
  }

  console.log('\n통과 · 시험용 설정 복원 및 해시 재검증');
  console.log(`복원 경로: ${SAFE_ROUTE}`);
  console.log('운영 정책 및 DB: 변경하지 않음');
}

async function main() {
  const command = process.argv[2];

  if (command === '--plan-restore') {
    await planRestore();
    return;
  }

  if (command === '--restore-drill') {
    await restoreDrill();
    return;
  }

  if (command) {
    throw new Error(`unknown_command:${command}`);
  }

  const manifest = await createVerifiedBackup();
  await createAttackCopy(manifest);

  console.log('\n통과 · 안전 백업 및 시험용 침공 모의 완료');
}

main().catch((error) => {
  console.error(`중단 · ${error.message}`);
  process.exitCode = 1;
});
