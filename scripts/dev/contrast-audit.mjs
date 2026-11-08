// Auditoría de contraste WCAG 2.2 AA (§15): lee los tokens reales de
// game.css (.game) y style.css (paletas) y calcula los pares texto/fondo
// que usa de verdad la pantalla de juego. No inventa valores: si un token
// cambia en el CSS, la tabla cambia con él. Salida 1 si algún par exigido
// baja de su mínimo (4.5 texto normal, 3.0 indicador de foco).
// Uso: node scripts/dev/contrast-audit.mjs
/* global console, process */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const gameCss = readFileSync(join(root, 'apps/web/src/game/game.css'), 'utf8');
const styleCss = readFileSync(join(root, 'apps/web/src/style.css'), 'utf8');

function luminance(hex) {
  const full = hex.replace('#', '');
  const channel = offset => {
    const value = parseInt(full.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4);
}
function ratio(fg, bg) {
  const light = Math.max(luminance(fg), luminance(bg));
  const dark = Math.min(luminance(fg), luminance(bg));
  return (light + 0.05) / (dark + 0.05);
}

/** Extrae --token:#xxxxxx de un bloque CSS. */
function tokensOf(css, pattern) {
  const match = css.match(pattern);
  if (!match) return {};
  const out = {};
  for (const [, name, value] of match[0].matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/gi)) out[name] = value.toLowerCase();
  return out;
}

const defaults = tokensOf(gameCss, /\.game\s*\{[^}]*\}/);
const paletteOverrides = {
  protanopia: tokensOf(styleCss, /html\.palette-protanopia[^{]*\{[^}]*\}/),
  deuteranopia: tokensOf(styleCss, /html\.palette-deuteranopia[^{]*\{[^}]*\}/),
  tritanopia: tokensOf(styleCss, /html\.palette-tritanopia[^{]*\{[^}]*\}/),
};
const highContrast = {
  ...tokensOf(gameCss, /\.game-high-contrast\s*\{[^}]*\}/),
  ...tokensOf(styleCss, /html\.game-high-contrast[^{]*\{[^}]*\}/),
};

const palettes = {
  default: { ...defaults },
  ...Object.fromEntries(Object.entries(paletteOverrides).map(([name, over]) => [name, { ...defaults, ...over }])),
  'high-contrast': { ...defaults, ...highContrast },
};

const BLACK = '#000000';
const WHITE = '#ffffff';
const pairs = [
  ['papel sobre panel', t => [t.paper, t.panel], 4.5],
  ['dorado sobre panel', t => [t.gold, t.panel], 4.5],
  ['apagado sobre panel', t => [t.muted, t.panel], 4.5],
  ['error sobre panel', t => [t.error, t.panel], 4.5],
  ['papel sobre negro', t => [t.paper, BLACK], 4.5],
  ['dorado sobre negro', t => [t.gold, BLACK], 4.5],
  ['apagado sobre negro', t => [t.muted, BLACK], 4.5],
  ['error sobre negro', t => [t.error, BLACK], 4.5],
  ['dorado sobre panel (foco, 3:1)', t => [t.gold, t.panel], 3],
];
const fixedPairs = [
  ['blanco sobre #005555 (botón activo)', [WHITE, '#005555'], 4.5],
  ['negro sobre dorado (botón primario)', [BLACK, '#ffff55'], 4.5],
  ['negro sobre #aaaaaa (botones, cabecera escena)', [BLACK, '#aaaaaa'], 4.5],
  ['negro sobre blanco (campos de ventana)', [BLACK, WHITE], 4.5],
];

let failures = 0;
for (const [name, tokens] of Object.entries(palettes)) {
  console.log(`\n== ${name} ==`);
  for (const [label, pick, min] of pairs) {
    const [fg, bg] = pick(tokens);
    const value = ratio(fg, bg);
    const ok = value >= min;
    if (!ok) failures++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'} ${label}: ${fg} / ${bg} = ${value.toFixed(2)} (mín ${min})`);
  }
}
console.log('\n== pares fijos (todas las paletas) ==');
for (const [label, [fg, bg], min] of fixedPairs) {
  const value = ratio(fg, bg);
  const ok = value >= min;
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'} ${label}: ${value.toFixed(2)} (mín ${min})`);
}
const oldActive = ratio(WHITE, defaults.teal);
console.log(`\nINFO blanco sobre teal ${defaults.teal} (antiguo botón activo, ya no se usa como fondo): ${oldActive.toFixed(2)} < 4.5 — resto documentado, no fallo.`);
console.log(failures === 0 ? '\nContraste AA: todos los pares pasan.' : `\nContraste AA: ${failures} pares por debajo del mínimo.`);
process.exit(failures === 0 ? 0 : 1);
