import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
const deleted = new Set(execFileSync('git', ['ls-files', '--deleted', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean));
const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(file => file && !deleted.has(file));
let failures = 0;
for (const file of files) {
  if (!/\.(?:ts|tsx|mjs|cjs|json|sql|ya?ml|sh)$/.test(file)) continue;
  const content = readFileSync(file, 'utf8');
  if ((!file.startsWith('apps/api/migrations/') && !content.endsWith('\n')) || content.split(/\r?\n/).some(line => /[ \t]+$/.test(line))) {
    console.error('Formato de espacios/final de línea: ' + file);
    failures++;
  }
}
if (failures) process.exitCode = 1;
else console.log('OK: archivos de código/configuración sin espacios finales; newline final excepto artefactos generados de migración.');
