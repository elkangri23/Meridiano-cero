// Smoke de actualización compatible T6-05 (entorno AISLADO).
// Datos viejos (backup 2026-11-09 11:55 UTC, código anterior) + API actual
// de la rama de distribución: las migraciones deben aplicarse (o ser no-op),
// los datos y las partidas deben seguir intactos y el juego debe ser jugable.
// API directa en 127.0.0.1:13002 (sin web). Proveedor mock, sin correo real.
// Uso: node scripts/drill-upgrade-smoke.mjs   (en el VPS, con la API de upgrade en marcha)
import { randomUUID } from 'node:crypto';

const BASE = 'http://127.0.0.1:13002';
const EMAIL = 'prueba-actualizacion-chochi@ejemplo.com';
const PASSWORD = 'Prueba-Actualiza-2026!';
const DISPLAY = 'Prueba Actualización';

let cookie = '';
let csrf = '';
let passed = 0;
const failures = [];

function check(name, cond, detail = '') {
  if (cond) { passed++; console.log(`  PASS ${name}${detail ? ' — ' + detail : ''}`); }
  else { failures.push(name); console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
}

async function api(method, path, body, extraHeaders = {}) {
  const headers = { Origin: BASE, 'Content-Type': 'application/json', ...extraHeaders };
  if (cookie) headers.Cookie = cookie;
  if (csrf && method !== 'GET') headers['X-CSRF-Token'] = csrf;
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  let json = null;
  const text = await res.text();
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, json, text: text.slice(0, 500) };
}

async function view(runId) {
  const v = await api('GET', '/api/v1/runs/' + runId);
  if (v.status !== 200) throw new Error('vista ' + v.status + ' ' + v.text);
  return v.json;
}

async function main() {
  console.log('== A. Salud (API actual + datos viejos) ==');
  const health = await api('GET', '/api/v1/health');
  check('salud 200', health.status === 200, 'status ' + health.status);
  const ready = await api('GET', '/api/v1/ready');
  check('ready 200', ready.status === 200, 'status ' + ready.status);

  console.log('== B. Cuenta de prueba (solo upgrade) ==');
  let r = await api('POST', '/api/v1/auth/register', { email: EMAIL, displayName: DISPLAY, password: PASSWORD });
  if (r.status === 409) r = await api('POST', '/api/v1/auth/login', { email: EMAIL, password: PASSWORD });
  check('registro/login 200', r.status === 200, 'status ' + r.status + ' ' + r.text);
  if (r.status !== 200) throw new Error('abortado: sin sesión');
  csrf = r.json.csrfToken;

  console.log('== C. Catálogo viejo intacto ==');
  r = await api('GET', '/api/v1/cases');
  check('catálogo 200', r.status === 200, 'status ' + r.status);
  const cases = Array.isArray(r.json) ? r.json : (r.json?.items ?? []);
  check('13 expedientes', cases.length === 13, 'n=' + cases.length);
  check('generado-21d02570 presente', cases.some(c => c.caseId === 'generado-21d02570'));

  console.log('== D. Partida jugable sobre un caso viejo ==');
  r = await api('POST', '/api/v1/runs', { caseId: 'generado-21d02570', idempotencyKey: randomUUID(), difficulty: 'normal', explorationMode: 'guided' });
  check('crear partida en caso viejo 201', r.status === 201, 'status ' + r.status + ' ' + r.text);
  if (r.status !== 201) throw new Error('abortado: no se creó la partida');
  const runId = r.json.runId ?? r.json.id;
  let v = await view(runId);
  check('vista 200 y minuto 0', v.clock.minute === 0, 'minuto ' + v.clock.minute);
  const offers = v.offers ?? [];
  const offer = offers[0];
  if (!offer) throw new Error('sin ofertas en el caso viejo: ' + JSON.stringify(v).slice(0, 300));
  const acted = await api('POST', '/api/v1/runs/' + runId + '/action',
    { action: offer.action, confirm: true, expectedVersion: v.version, idempotencyKey: randomUUID() });
  check('primera acción 200', acted.status === 200, 'status ' + acted.status + ' ' + acted.text);
  v = await view(runId);
  check('el reloj avanzó', v.clock.minute > 0, 'minuto ' + v.clock.minute);

  console.log(`\nRESULTADO: ${passed} PASS, ${failures.length} FAIL`);
  if (failures.length) { console.log('fallos: ' + failures.join(', ')); process.exit(1); }
}

main().catch(error => { console.error('ERROR:', error.message); process.exit(1); });
