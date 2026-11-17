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
// Alto contraste: style.css tiene VARIAS reglas html.game-high-contrast
// (la compartida y las de .game/.prototype); hay que fusionarlas todas,
// no solo la primera.
function tokensOfAll(css, pattern) {
  const out = {};
  for (const match of css.matchAll(pattern)) {
    for (const [, name, value] of match[0].matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6})/gi)) out[name] = value.toLowerCase();
  }
  return out;
}
const highContrast = {
  ...tokensOf(gameCss, /\.game-high-contrast\s*\{[^}]*\}/),
  ...tokensOfAll(styleCss, /html\.game-high-contrast[^{]*\{[^}]*\}/g),
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
  ['blanco sobre tinta (botones, burbuja propia)', t => [t.white, t.ink], 4.5],
  ['dorado claro sobre tinta', t => [t['gold-bright'], t.ink], 4.5],
  ['tinta sobre dorado claro (botón primario)', t => [t.ink, t['gold-bright']], 4.5],
  // El par 'blanco sobre teal' se quita: ningún elemento usa texto blanco
  // sobre fondo teal (los únicos fondos teal son las tierras del atlas,
  // decorativas, sin texto); en alto contraste --teal es claro para que
  // el texto teal sobre panel negro sea legible. En su lugar, los pares
  // reales de texto teal/verde sobre panel y sobre fichas.
  ['teal oscuro sobre panel (enlaces del juego)', t => [t['teal-dark'], t.panel], 4.5],
  ['teal sobre panel', t => [t.teal, t.panel], 4.5],
  ['verde sobre panel', t => [t.green, t.panel], 4.5],
  ['papel sobre teal-bg (respuesta de equipo)', t => [t.paper, t['teal-bg']], 4.5],
  ['teal oscuro sobre teal-bg (portavoz, estado)', t => [t['teal-dark'], t['teal-bg']], 4.5],
  ['papel sobre gold-bg (confirmación, hallazgo)', t => [t.paper, t['gold-bg']], 4.5],
  ['dorado sobre gold-bg', t => [t.gold, t['gold-bg']], 4.5],
  ['verde sobre gold-bg (revisado)', t => [t.green, t['gold-bg']], 4.5],
  ['verde sobre verde claro (objetivo logrado)', t => [t.green, t['green-bg']], 4.5],
  ['dorado sobre panel (foco, 3:1)', t => [t.gold, t.panel], 3],
];
const fixedPairs = [
  ['tinta sobre dorado #C9A227 (botón primario)', ['#101828', '#C9A227'], 4.5],
  ['blanco sobre teal #0E7C7B (botón teal)', [WHITE, '#0E7C7B'], 4.5],
  ['blanco sobre tinta #101828 (botón activo, burbuja propia)', [WHITE, '#101828'], 4.5],
  ['negro sobre blanco (campos de ventana)', [BLACK, WHITE], 4.5],
  ['verde sobre verde claro (objetivo logrado)', ['#1E7A46', '#E7F4EC'], 4.5],
  // Alto contraste en las pantallas públicas (landing, archivo/login,
  // glosario, créditos — ver style.css): el fondo de página es negro y el
  // texto blanco; los enlaces usan teal claro y los avisos verde claro.
  // Si cambian esos valores en style.css, hay que cambiarlos aquí también.
  ['blanco sobre negro (texto de página en alto contraste)', [WHITE, BLACK], 4.5],
  ['dorado claro #FFE14D sobre negro (alto contraste)', ['#FFE14D', BLACK], 4.5],
  ['teal claro #7FD1CE sobre negro (enlaces en alto contraste)', ['#7FD1CE', BLACK], 4.5],
  ['verde claro #5BC98A sobre negro (aviso ok en alto contraste)', ['#5BC98A', BLACK], 4.5],
  ['tinta sobre dorado claro #FFE14D (botón primario en alto contraste)', ['#000000', '#FFE14D'], 4.5],
  // Alto contraste en el juego (style.css): fichas oscuras con texto claro.
  ['blanco sobre teal oscuro #062E2E (ficha de equipo en alto contraste)', [WHITE, '#062E2E'], 4.5],
  ['blanco sobre dorado oscuro #332A00 (ficha dorada en alto contraste)', [WHITE, '#332A00'], 4.5],
  ['blanco sobre verde oscuro #0B2E1A (ficha verde en alto contraste)', [WHITE, '#0B2E1A'], 4.5],
  ['teal oscuro #0A5C5B sobre teal claro #E3F2F1 (estado de análisis)', ['#0A5C5B', '#E3F2F1'], 4.5],
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
const goldBrightOnPanel = ratio(defaults['gold-bright'], defaults.panel);
console.log(`\nINFO dorado claro ${defaults['gold-bright']} sobre panel ${defaults.panel}: ${goldBrightOnPanel.toFixed(2)} < 4.5 — solo bordes y acentos, nunca texto; el texto dorado usa ${defaults.gold}.`);
console.log(failures === 0 ? '\nContraste AA: todos los pares pasan.' : `\nContraste AA: ${failures} pares por debajo del mínimo.`);
process.exit(failures === 0 ? 0 : 1);
