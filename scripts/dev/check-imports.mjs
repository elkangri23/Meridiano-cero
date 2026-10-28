import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../../', import.meta.url));
export function runImportCheck() {
  const directory = resolve(root, 'node_modules/dependency-cruiser');
  const manifest = JSON.parse(readFileSync(resolve(directory, 'package.json'), 'utf8'));
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin.depcruise;
  assert.equal(typeof bin, 'string');
  const cli = resolve(directory, bin);
  assert.ok(cli.startsWith(directory + sep));
  const entries = [];
  for (const base of ['apps', 'packages']) {
    for (const item of readdirSync(resolve(root, base), { withFileTypes: true })) {
      if (!item.isDirectory()) continue;
      const project = base + '/' + item.name;
      if (!existsSync(resolve(root, project, 'package.json'))) continue;
      assert.ok(existsSync(resolve(root, project, 'src')), 'Paquete sin fuente: ' + project);
      entries.push(project + '/src');
      if (existsSync(resolve(root, project, 'vite.config.ts'))) entries.push(project + '/vite.config.ts');
    }
  }
  assert.ok(entries.length);
  const result = spawnSync(process.execPath, [cli, '--config', '.dependency-cruiser.cjs', ...entries], { cwd: root, encoding: 'utf8', timeout: 60000 });
  if (result.error) throw result.error;
  return { status: result.status, text: result.stdout + result.stderr };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = runImportCheck();
  process.stdout.write(result.text);
  process.exitCode = result.status ?? 1;
}
