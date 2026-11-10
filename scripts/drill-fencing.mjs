// BOR-085 / BOR-090: comprobaciones de fencing tras el restore (drill T6-05).
// BOR-085: tras restaurar, no hay jobs de generación pendientes ni llamadas
// reales automáticas (proveedor mock, 0 conexiones).
// BOR-090: un cliente viejo (expectedVersion desfasada) no ejecuta a ciegas:
// la acción se rechaza por conflicto de versión y el estado no cambia.
// Uso: node scripts/drill-fencing.mjs   (en el VPS, con el drill en marcha)
import { randomUUID } from 'node:crypto';

const BASE = 'http://127.0.0.1:15173';
const EMAIL = 'prueba-desastre-chochi@ejemplo.com';
const PASSWORD = 'Prueba-Desastre-2026!';

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
  console.log('== A. Sesión en el drill restaurado ==');
  let r = await api('POST', '/api/v1/auth/login', { email: EMAIL, password: PASSWORD });
  check('login 200', r.status === 200, 'status ' + r.status);
  if (r.status !== 200) throw new Error('abortado: sin sesión');
  csrf = r.json.csrfToken;

  console.log('== B. BOR-090: cliente viejo con versión desfasada ==');
  r = await api('POST', '/api/v1/runs', { caseId: 'astrolabio-tres-ciudades', idempotencyKey: randomUUID(), difficulty: 'normal', explorationMode: 'guided' });
  check('crear partida 201', r.status === 201, 'status ' + r.status);
  const runId = r.json.runId ?? r.json.id;
  let v = await view(runId);
  const versionNow = v.version;
  const minuteNow = v.clock.minute;
  const offers = v.offers ?? [];
  const offer = offers[0];
  console.log(`  partida ${runId} versión ${versionNow} minuto ${minuteNow} primera oferta ${offer?.id}`);
  // Acción con expectedVersion deliberadamente vieja (versión 1 menos que la real
  // si la real es > 1; si es 1, usamos 0 que nunca es válido).
  const staleVersion = versionNow > 1 ? versionNow - 1 : 0;
  const bad = await api('POST', '/api/v1/runs/' + runId + '/action',
    { action: offer.action, confirm: true, expectedVersion: staleVersion, idempotencyKey: randomUUID() });
  check('acción con versión vieja rechazada (no 200)', bad.status !== 200, 'status ' + bad.status);
  v = await view(runId);
  check('el estado no cambió tras el rechazo', v.version === versionNow && v.clock.minute === minuteNow,
    `versión ${versionNow} -> ${v.version}, minuto ${minuteNow} -> ${v.clock.minute}`);
  // Y con la versión correcta sí avanza (el cliente actualizado funciona).
  const good = await api('POST', '/api/v1/runs/' + runId + '/action',
    { action: offer.action, confirm: true, expectedVersion: v.version, idempotencyKey: randomUUID() });
  check('acción con versión actual aceptada', good.status === 200, 'status ' + good.status + ' ' + good.text);
  v = await view(runId);
  check('el reloj avanzó con la acción válida', v.clock.minute > minuteNow, `minuto ${minuteNow} -> ${v.clock.minute}`);

  console.log(`\nRESULTADO: ${passed} PASS, ${failures.length} FAIL`);
  if (failures.length) { console.log('fallos: ' + failures.join(', ')); process.exit(1); }
}

main().catch(error => { console.error('ERROR:', error.message); process.exit(1); });
