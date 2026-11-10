// Smoke del simulacro de desastre T6-05 (entorno AISLADO del drill).
// Contra la web del drill (vite dev en 15173, proxy /api -> API 13000).
// Proveedor mock, sin correo real. Cuenta de prueba solo en el drill.
// Uso: node scripts/drill-smoke.mjs   (en el VPS, con el drill en marcha)
import { randomUUID } from 'node:crypto';

const BASE = 'http://127.0.0.1:15173';
const EMAIL = 'prueba-desastre-chochi@ejemplo.com';
const PASSWORD = 'Prueba-Desastre-2026!';
const DISPLAY = 'Prueba Desastre';

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

async function doOffer(runId, prefix) {
  const v = await view(runId);
  const offers = v.offers ?? [];
  const offer = offers.find(o => o.id === prefix) ?? offers.find(o => o.id.startsWith(prefix + ':')) ?? offers.find(o => o.id.startsWith(prefix));
  if (!offer) throw new Error('sin oferta ' + prefix + ' en ' + offers.map(o => o.id).join(','));
  const r = await api('POST', '/api/v1/runs/' + runId + '/action',
    { action: offer.action, confirm: true, expectedVersion: v.version, idempotencyKey: randomUUID() });
  if (r.status !== 200) throw new Error('acción ' + prefix + ' ' + r.status + ' ' + r.text);
  if (typeof r.json?.reason === 'string') throw new Error('acción ' + prefix + ' imposible: ' + r.json.reason);
  if (r.json?.version !== v.version + 1) throw new Error('acción ' + prefix + ' sin subir versión: ' + v.version + ' -> ' + r.json?.version);
  return view(runId);
}

async function main() {
  console.log('== A. Salud y web del drill ==');
  const health = await api('GET', '/api/v1/health');
  check('salud 200', health.status === 200, 'status ' + health.status);
  const ready = await api('GET', '/api/v1/ready');
  check('ready 200', ready.status === 200, 'status ' + ready.status);
  const index = await fetch(BASE + '/');
  const indexText = await index.text();
  check('web 200', index.status === 200, 'status ' + index.status);
  const credits = await fetch(BASE + '/creditos');
  const creditsText = await credits.text();
  check('ruta /creditos 200', credits.status === 200, 'status ' + credits.status);
  const jsAssets = [...indexText.matchAll(/\/src\/[^"']+\.(?:ts|tsx|js|jsx)/g)].map(m => m[0]);
  console.log('  assets en index (dev): ' + jsAssets.length);
  check('el HTML sirve la app', indexText.includes('<div id="root">'));

  console.log('== B. Cuenta de prueba (solo drill) ==');
  let r = await api('POST', '/api/v1/auth/register', { email: EMAIL, displayName: DISPLAY, password: PASSWORD });
  if (r.status === 409) {
    console.log('  registro 409 (la cuenta ya existía): login de respaldo');
    r = await api('POST', '/api/v1/auth/login', { email: EMAIL, password: PASSWORD });
  }
  check('registro/login 200', r.status === 200, 'status ' + r.status + ' ' + r.text);
  if (r.status !== 200) throw new Error('abortado: sin sesión');
  csrf = r.json.csrfToken;
  check('sesión + csrf', Boolean(cookie && csrf), 'profile ' + r.json.profile.id);

  console.log('== C. Proveedor efectivo: mock, sin IA real ==');
  r = await api('GET', '/api/v1/ai/connections');
  check('conexiones 200', r.status === 200, 'status ' + r.status);
  check('proveedor efectivo mock', r.json?.effective?.source === 'mock' && r.json?.effective?.providerId === 'mock',
    JSON.stringify(r.json?.effective));
  check('cero conexiones personales', Array.isArray(r.json?.connections) && r.json.connections.length === 0);

  console.log('== D. Catálogo restaurado (fijo + 12 generados) ==');
  r = await api('GET', '/api/v1/cases');
  check('catálogo 200', r.status === 200, 'status ' + r.status);
  const cases = Array.isArray(r.json) ? r.json : (r.json?.items ?? []);
  check('13 expedientes', cases.length === 13, 'n=' + cases.length);
  check('generado-21d02570 presente', cases.some(c => c.caseId === 'generado-21d02570'));

  console.log('== E. Partida jugable del caso fijo ==');
  r = await api('POST', '/api/v1/runs', { caseId: 'astrolabio-tres-ciudades', idempotencyKey: randomUUID(), difficulty: 'normal', explorationMode: 'guided' });
  check('crear partida 201', r.status === 201, 'status ' + r.status + ' ' + r.text);
  if (r.status !== 201) throw new Error('abortado: no se creó la partida');
  const runId = r.json.runId ?? r.json.id;
  console.log('  run de prueba: ' + runId);
  let v = await view(runId);
  check('vista 200 y minuto 0', v.clock.minute === 0, 'minuto ' + v.clock.minute);
  v = await doOffer(runId, 'inspect:MAD-SALA');
  check('inspeccionar sala: 10 min', v.clock.minute === 10, 'minuto ' + v.clock.minute);
  v = await doOffer(runId, 'inspect:MAD-SALA:cerradura');
  check('inspeccionar cerradura: 30 min', v.clock.minute === 30, 'minuto ' + v.clock.minute);
  v = await doOffer(runId, 'collect:EV-02');
  check('recoger EV-02 (inventario y dossier)', (v.objects ?? []).some(o => o.id === 'EV-02') && (v.dossier ?? []).includes('EV-02'),
    'objects ' + JSON.stringify(v.objects) + ' dossier ' + JSON.stringify(v.dossier));

  console.log(`\nRESULTADO: ${passed} PASS, ${failures.length} FAIL`);
  if (failures.length) { console.log('fallos: ' + failures.join(', ')); process.exit(1); }
}

main().catch(error => { console.error('ERROR:', error.message); process.exit(1); });
