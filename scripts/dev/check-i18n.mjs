import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, relative, resolve } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const localesDir = join(root, 'packages/contracts/src/locales');

// Clave con puntos: `seccion.subseccion.nombre` (guiones permitidos en el
// último tramo, p. ej. `labels.crime.misterio-historico`).
const KEY_PATTERN = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)+$/;

function collectTsFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectTsFiles(path));
    else if (/\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}

/** Claves definidas en un fichero de locale (`'clave': 'texto',`). */
function localeKeys(path) {
  const text = readFileSync(path, 'utf8');
  const keys = [];
  const duplicates = [];
  const seen = new Set();
  for (const match of text.matchAll(/^  '([^']+)':/gm)) {
    const key = match[1];
    if (seen.has(key)) duplicates.push(key);
    seen.add(key);
    keys.push(key);
  }
  return { keys, duplicates };
}

/** Claves usadas en el código: primer argumento de `t(...)` /
 * `translateUi(...)`, segundo de `resolveMessage(locale, ...)`, y valores
 * de los mapas `*_KEYS` / `*Keys` (p. ej. `WINDOW_KEYS`, `channelKeys`). */
function usedKeys(path) {
  const text = readFileSync(path, 'utf8');
  const found = new Map(); // clave -> línea
  const record = (key, index) => {
    if (!KEY_PATTERN.test(key)) return;
    // Sin comentarios: la documentación menciona `t('seccion.clave')`
    // como ejemplo y no es un uso real.
    const lineStart = text.lastIndexOf('\n', index) + 1;
    const before = text.slice(lineStart, index);
    if (before.includes('//') || before.trimStart().startsWith('*')) return;
    if (!found.has(key)) found.set(key, text.slice(0, index).split('\n').length);
  };
  for (const match of text.matchAll(/\bt\(\s*'([^']+)'/g)) record(match[1], match.index);
  for (const match of text.matchAll(/\bt\(\s*"([^"]+)"/g)) record(match[1], match.index);
  for (const match of text.matchAll(/translateUi\(\s*'([^']+)'/g)) record(match[1], match.index);
  for (const match of text.matchAll(/resolveMessage\(\s*'[^']+'\s*,\s*'([^']+)'/g)) record(match[1], match.index);
  for (const match of text.matchAll(/resolveMessage\(\s*[A-Za-z_$][\w$]*\s*,\s*'([^']+)'/g)) record(match[1], match.index);
  for (const map of text.matchAll(/(?:_KEYS|Keys)\b[^=]*=\s*\{([^}]*)\}/g)) {
    for (const match of map[1].matchAll(/'([^']+)'/g)) record(match[1], map.index + match.index);
  }
  return found;
}

const errors = [];

// 1. El español es la referencia: sin duplicados.
const es = localeKeys(join(localesDir, 'es.ts'));
for (const key of es.duplicates) errors.push(`duplicada en es.ts: ${key}`);
const esSet = new Set(es.keys);

// 2. Los demás idiomas solo pueden usar claves que existen en español.
for (const locale of ['en', 'fr']) {
  const { keys, duplicates } = localeKeys(join(localesDir, `${locale}.ts`));
  for (const key of duplicates) errors.push(`duplicada en ${locale}.ts: ${key}`);
  for (const key of keys) {
    if (!esSet.has(key)) errors.push(`${locale}.ts usa una clave que no está en es.ts: ${key}`);
  }
}

// 3. Cada clave usada en el código existe en español (los tests quedan
// fuera: prueban el fallback con claves que no existen a propósito).
const sources = [
  ...collectTsFiles(join(root, 'apps')),
  ...collectTsFiles(join(root, 'packages')),
].filter(path => !/\.test\.tsx?$/.test(path));
for (const path of sources) {
  for (const [key, line] of usedKeys(path)) {
    if (!esSet.has(key)) errors.push(`${relative(root, path)}:${line}: clave sin traducir en es.ts: ${key}`);
  }
}

if (errors.length > 0) {
  console.error(`check:i18n: ${errors.length} problema(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`check:i18n: OK (${es.keys.length} claves en es.ts, ${sources.length} ficheros revisados).`);
