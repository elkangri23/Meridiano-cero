import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it } from 'vitest';
import { createOllamaProvider } from './ollama.ts';

async function withServer(
  handler: (request: IncomingMessage, response: ServerResponse) => void,
  run: (origin: string) => Promise<void>,
) {
  const server = createServer(handler);
  try {
    await new Promise<void>(resolve => { server.listen(0, '127.0.0.1', resolve); });
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No hay puerto de prueba.');
    await run('http://127.0.0.1:' + address.port);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close(error => { if (error) reject(error); else resolve(); });
    });
  }
}
const request = { operation: 'interpretAction' as const, requestId: 'synthetic-http',
  schema: { type: 'object' }, context: { text: 'Examinar' } };

describe('Integración HTTP local sintética, sin modelo', () => {
  it('intercambia JSON con fetch nativo y conserva solo la respuesta validada', async () => {
    let received: unknown;
    await withServer((req, res) => {
      let body = '';
      req.setEncoding('utf8');
      req.on('data', chunk => { body += String(chunk); });
      req.on('end', () => {
        received = JSON.parse(body);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ model: 'synthetic:local', done: true, done_reason: 'stop',
          message: { role: 'assistant', content: '{"kind":"clarification","actionIds":[]}' } }));
      });
    }, async origin => {
      const provider = createOllamaProvider({ model: 'synthetic:local', origin });
      expect(await provider.request(request)).toMatchObject({ payload: { kind: 'clarification', actionIds: [] } });
    });
    expect(received).toMatchObject({ stream: false, format: request.schema });
  });
  it('no sigue redirects aunque apunten a otro recurso local', async () => {
    let destinationRequests = 0;
    await withServer((req, res) => {
      if (req.url === '/destination') destinationRequests++;
      res.writeHead(302, { Location: '/destination' });
      res.end();
    }, async origin => {
      const provider = createOllamaProvider({ model: 'synthetic:local', origin });
      await expect(provider.request(request)).rejects.toMatchObject({ code: 'unavailable' });
    });
    expect(destinationRequests).toBe(0);
  });
});
