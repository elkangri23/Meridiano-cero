// Private TCP transport only: never inspect or log request/response contents.
const net = require('node:net');
const fs = require('node:fs');
const [host, client, portText, stateFile] = process.argv.slice(2);
const port = Number(portText);
if (net.isIP(host) !== 4 || net.isIP(client) !== 4 || port !== 31416 || host === client) {
  throw new Error('Invalid private relay configuration');
}
const connections = new Set();
const server = net.createServer({ maxConnections: 64 }, (incoming) => {
  if (incoming.remoteAddress !== client) { incoming.destroy(); return; }
  const outgoing = net.createConnection({ host: '127.0.0.1', port: 31415 });
  connections.add(incoming);
  connections.add(outgoing);
  const close = () => { incoming.destroy(); outgoing.destroy(); };
  for (const socket of [incoming, outgoing]) {
    socket.setTimeout(600000, close);
    socket.on('error', close);
    socket.on('close', () => { connections.delete(socket); close(); });
  }
  outgoing.once('connect', () => { incoming.pipe(outgoing); outgoing.pipe(incoming); });
});
server.maxConnections = 64;
server.on('error', () => { console.error('Private relay could not listen.'); process.exit(1); });
server.listen(port, host, () => {
  fs.writeFileSync(stateFile, JSON.stringify({ pid: process.pid, host, client, port }));
});
const shutdown = () => { for (const socket of connections) socket.destroy(); server.close(() => process.exit(0)); };
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
