import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const IGNORE = new Set(['node_modules', 'dist', '.git', 'coverage', '.pnpm']);
const EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.cjs', '.json', '.env', '.yml', '.yaml']);

const SECRET_PATTERNS = [
  /password\s*[:=]\s*['"][^'"]{8,}['"]/i,
  /secret\s*[:=]\s*['"][^'"]{8,}['"]/i,
  /api[_-]?key\s*[:=]\s*['"][^'"]{8,}['"]/i,
  /token\s*[:=]\s*['"][^'"]{8,}['"]/i,
];

function walk(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    if (IGNORE.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walk(full));
    } else if (EXTENSIONS.has(entry.slice(entry.lastIndexOf('.')))) {
      results.push(full);
    }
  }
  return results;
}

let found = false;
for (const file of walk(ROOT)) {
  const content = readFileSync(file, 'utf8');
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.test(lines[i])) {
        const rel = relative(ROOT, file);
        console.error(`[SECRET SCAN] ${rel}:${i + 1}: ${lines[i].trim().slice(0, 80)}`);
        found = true;
      }
    }
  }
}

if (found) {
  console.error('\nSe encontraron posibles secretos. Revisa antes de commit.');
  process.exit(1);
} else {
  console.log('Secret scan: sin hallazgos.');
}