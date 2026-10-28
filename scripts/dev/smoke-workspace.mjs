// Comprueba HTTP y proxy locales reales, sin DB, IA, sesión ni navegador.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createApp } from '../../apps/api/src/app.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const fromWeb = createRequire(new URL('../../apps/web/package.json', import.meta.url));
const { createServer } = await import(pathToFileURL(fromWeb.resolve('vite')).href);
const api = createApp();
let web;
try {
  const apiAddress = await api.listen({ host: '127.0.0.1', port: 0 });
  web = await createServer({
    root: root + '/apps/web', configFile: root + '/apps/web/vite.config.ts',
    server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false,
      watch: { ignored: ['**/*'] }, proxy: { '/api': { target: apiAddress, changeOrigin: false } } },
  });
  await web.listen();
  const address = web.httpServer.address();
  assert.ok(address && typeof address !== 'string');
  const base = 'http://127.0.0.1:' + address.port;
  const page = await fetch(base);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Meridiano-cero/);
  const module = await fetch(base + '/src/main.tsx');
  assert.equal(module.status, 200);
  assert.match(await module.text(), /Comprobar API/);
  const health = await fetch(base + '/api/v1/health');
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: 'ok' });
  console.log('OK: página y TSX servidos; proxy web -> API con HTTP real en loopback.');
} finally {
  if (web) await web.close();
  await api.close();
}
