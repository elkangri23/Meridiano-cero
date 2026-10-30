import { db } from './database.js';
import type { BackupConfig, BackupMetadata } from './types.js';

const CHECKSUM_ALGORITHM = 'SHA-256';

export interface BackupResult {
  id: string;
  timestamp: string;
  type: 'full' | 'incremental';
  sizeBytes: number;
  durationMs: number;
  tables: string[];
  checksum: string;
  encrypted: boolean;
  compressed: boolean;
  destination: 'local' | 's3';
}

export async function createFullBackup(config: BackupConfig): Promise<BackupResult> {
  const id = `backup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const start = performance.now();
  const timestamp = new Date().toISOString();

  // En producción: pg_dump con --format=custom, compresión, cifrado opcional
  const dump = await db.query('SELECT * FROM pg_dump_all()'); // Placeholder
  const dumpStr = JSON.stringify(dump.rows);
  const sizeBytes = new TextEncoder().encode(dumpStr).length;
  const checksum = await hashData(dumpStr);
  const durationMs = Math.round(performance.now() - start);

  if (config.destination === 'local') {
    await writeLocalBackup(config, id, dumpStr, checksum);
  } else if (config.destination === 's3') {
    // await uploadToS3(config, id, dumpStr, checksum);
  }

  return { id, timestamp, type: 'full', sizeBytes, durationMs, tables: ['all'], checksum, encrypted: config.encryption ?? false, compressed: config.compression ?? false, destination: config.destination };
}

export async function createIncrementalBackup(config: BackupConfig, since: string): Promise<BackupResult> {
  const id = `backup-inc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const start = performance.now();
  const timestamp = new Date().toISOString();

  const tables = ['case_run', 'case_definition', 'evidence_record', 'conversation_record'];
  const changes = await db.query('SELECT * FROM pg_wal_lsn_diff($1, pg_current_wal_lsn())', [since]); // Placeholder
  const dumpStr = JSON.stringify(changes.rows);
  const sizeBytes = new TextEncoder().encode(dumpStr).length;
  const checksum = await hashData(dumpStr);
  const durationMs = Math.round(performance.now() - start);

  if (config.destination === 'local') {
    await writeLocalBackup(config, id, dumpStr, checksum);
  }

  return { id, timestamp, type: 'incremental', sizeBytes, durationMs, tables, checksum, encrypted: config.encryption ?? false, compressed: config.compression ?? false, destination: config.destination };
}

async function writeLocalBackup(config: BackupConfig, id: string, data: string, checksum: string): Promise<void> {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  const dir = config.localPath ?? '/tmp/meridiano_backups';
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${id}.dump`), data);
  const meta = { id, timestamp: new Date().toISOString(), checksum, sizeBytes: new TextEncoder().encode(data).length };
  await fs.writeFile(path.join(dir, `${id}.meta.json`), JSON.stringify(meta));
}

async function hashData(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest(CHECKSUM_ALGORITHM, encoder.encode(data));
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function restoreBackup(config: BackupConfig, backupId: string): Promise<void> {
  let dump = '';
  if (config.destination === 'local') {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const dir = config.localPath ?? '/tmp/meridiano_backups';
    dump = await fs.readFile(path.join(dir, `${backupId}.dump`), 'utf8');
  }
  await restoreTables(db, dump);
}

async function restoreTables(db: any, dump: string): Promise<void> {
  const statements = dump.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));
  await db.query('BEGIN');
  try {
    for (const stmt of statements) {
      if (stmt.trim()) await db.query(stmt);
    }
    await db.query('COMMIT');
  } catch {
    await db.query('ROLLBACK');
    throw new Error('Restore failed');
  }
}

async function getLastBackupMetadata(config: BackupConfig): Promise<BackupMetadata | null> {
  if (config.destination === 'local') {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const dir = config.localPath ?? '/tmp/meridiano_backups';
    try {
      const files = await fs.readdir(dir);
      const metaFiles = files.filter(f => f.endsWith('.meta.json')).sort().reverse();
      if (metaFiles.length > 0) {
        const content = await fs.readFile(path.join(dir, metaFiles[0]), 'utf8');
        return JSON.parse(content);
      }
    } catch {
      return null;
    }
  }
  return null;
}

export async function scheduleBackups(config: BackupConfig, intervalMs: number): Promise<NodeJS.Timeout> {
  return setInterval(() => {
    void createFullBackup(config).catch(err => console.error('Backup fallido:', err));
  }, intervalMs);
}

export function stopScheduledBackups(interval: NodeJS.Timeout): void {
  clearInterval(interval);
}