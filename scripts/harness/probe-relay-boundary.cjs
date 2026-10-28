// Check that a connection from Windows itself is rejected by the source-IP filter.
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const state = JSON.parse(fs.readFileSync(path.join(__dirname, '../../.harness/runs/windows-relay/state.json'), 'utf8'));
const socket = net.createConnection({ host: state.host, port: state.port });
let received = false;
socket.on('connect', () => socket.write('GET / HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n'));
socket.on('data', () => { received = true; });
socket.on('error', (error) => { if (error.code !== 'ECONNRESET') { console.error('Boundary test could not connect.'); process.exitCode = 1; } });
socket.on('close', () => { console.log(received ? 'FAIL: unexpected source accepted.' : 'OK: Windows source rejected; only Ubuntu is permitted.'); if (received) process.exitCode = 1; });
socket.setTimeout(3000, () => { console.error('Boundary test timed out.'); process.exitCode = 1; socket.destroy(); });
