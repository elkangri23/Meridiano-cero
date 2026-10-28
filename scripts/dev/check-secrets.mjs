import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname, sep } from 'node:path';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';

const image = 'ghcr.io/gitleaks/gitleaks:v8.30.1@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f';
const root = process.cwd();
const temporary = mkdtempSync(resolve(tmpdir(), 'meridiano-secret-scan-'));
function scan() {
  const result = spawnSync('docker', ['run', '--rm', '--network', 'none', '-v', temporary + ':/scan:ro',
    image, 'dir', '/scan', '--redact', '--verbose', '--no-banner', '--no-color', '--ignore-gitleaks-allow'],
    { encoding: 'utf8', timeout: 120000 });
  if (result.error) throw result.error;
  return result;
}
try {
  const names = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const name of names) {
    const source = resolve(root, name);
    assert.ok(source.startsWith(root + sep), 'Ruta fuera del proyecto');
    // Never mount the real working tree: local ignored credentials are not copied.
    const destination = resolve(temporary, name);
    assert.ok(destination.startsWith(temporary + sep));
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(source, destination);
  }
  let result = scan();
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  assert.equal(result.status, 0, 'Hallazgo o fallo de Gitleaks');
  if (process.argv.includes('--verify-detector')) {
    // Synthetic nonfunctional canary, assembled only inside the temporary scan copy.
    const canary = randomBytes(32).toString('hex');
    writeFileSync(resolve(temporary, 'negative-secret-probe.txt'), 'api_key = "' + canary + '"\n');
    result = scan();
    assert.equal(result.status, 1, 'El detector debe rechazar el secreto sintético');
    assert.match(result.stderr + result.stdout, /generic-api-key/);
    console.log('OK: Gitleaks detecta el canario sintético sin imprimirlo.');
  }
} finally {
  assert.ok(temporary.startsWith(resolve(tmpdir()) + sep + 'meridiano-secret-scan-'));
  rmSync(temporary, { recursive: true, force: true });
}
