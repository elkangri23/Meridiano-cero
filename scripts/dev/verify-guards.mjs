// Pruebas negativas de las herramientas reales; no sustituye pruebas del juego.
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';
import assert from 'node:assert/strict';
import { runImportCheck } from './check-imports.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const files = [];
function put(relative, content) {
  const target = resolve(root, relative);
  assert.ok(target.startsWith(resolve(root) + sep));
  assert.equal(existsSync(target), false, 'No sobrescribir archivos existentes: ' + relative);
  writeFileSync(target, content);
  files.push(target);
}
function clean() { while (files.length) unlinkSync(files.pop()); }
function run(binary, args) {
  const result = spawnSync(process.execPath, [resolve(root, binary), ...args], { cwd: root, encoding: 'utf8', timeout: 60000 });
  if (result.error) throw result.error;
  return { status: result.status, text: result.stdout + result.stderr };
}
try {
  put('packages/contracts/src/__negative_contract.ts', "import type { HealthResponse } from './index.js';\nconst invalid: HealthResponse = { status: 'ready' };\nvoid invalid;\n");
  const types = run('node_modules/typescript/bin/tsc', ['-p', 'packages/contracts/tsconfig.json', '--noEmit']);
  assert.equal(types.status, 2, types.text);
  assert.match(types.text, /TS2322/);
  clean();
  console.log('OK: el compilador rechaza un contrato incompatible.');

  put('apps/web/src/__boundary_probe.ts', "import { createApp } from '../../api/src/app.ts';\nvoid createApp;\n");
  const boundary = runImportCheck();
  assert.notEqual(boundary.status, 0, boundary.text);
  assert.match(boundary.text, /web-isolation/);
  clean();
  console.log('OK: se rechaza web -> API por ruta relativa.');

  put('apps/web/src/__compiled_probe.ts', "import { createApp } from '../../api/dist/app.js';\nvoid createApp;\n");
  const compiled = runImportCheck();
  assert.notEqual(compiled.status, 0, compiled.text);
  assert.match(compiled.text, /web-isolation/);
  clean();
  console.log('OK: se rechaza web -> API compilada.');

  put('apps/web/src/__node_probe.ts', "import { readFile } from 'node:fs';\nvoid readFile;\n");
  const builtin = runImportCheck();
  assert.notEqual(builtin.status, 0, builtin.text);
  assert.match(builtin.text, /web-no-node/);
  clean();
  console.log('OK: se rechaza web -> Node nativo.');

  put('packages/contracts/src/__cycle_a.ts', "import './__cycle_b.js';\nexport const a = 1;\n");
  put('packages/contracts/src/__cycle_b.ts', "import './__cycle_a.js';\nexport const b = 1;\n");
  const cycle = runImportCheck();
  assert.notEqual(cycle.status, 0, cycle.text);
  assert.match(cycle.text, /no-cycles/);
  clean();
  console.log('OK: se rechaza un ciclo real de imports.');

  const valid = runImportCheck();
  assert.equal(valid.status, 0, valid.text);
  console.log('OK: el árbol limpio vuelve a pasar límites e imports.');
} finally { clean(); }
