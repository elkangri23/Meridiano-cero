"""Check DNS/TCP/TLS only; no API request or credential transmission."""
import json
from pathlib import Path
import socket
import ssl
from urllib.parse import urlsplit

settings = Path.home() / '.local/share/meridiano-harness/claude-config/settings.json'
endpoint = urlsplit(json.loads(settings.read_text())['env']['ANTHROPIC_BASE_URL'])
if endpoint.scheme not in ('http', 'https') or not endpoint.hostname or endpoint.username or endpoint.password:
    raise SystemExit('Formato de URL inesperado; no se muestran valores.')
port = endpoint.port or (443 if endpoint.scheme == 'https' else 80)
print('Destino:', 'local' if endpoint.hostname in ('localhost', '127.0.0.1', '::1') else 'remoto')
try:
    socket.getaddrinfo(endpoint.hostname, port)
    print('DNS: OK')
    with socket.create_connection((endpoint.hostname, port), timeout=8) as connection:
        print('TCP: OK')
        if endpoint.scheme == 'https':
            with ssl.create_default_context().wrap_socket(connection, server_hostname=endpoint.hostname):
                print('TLS: OK')
except (OSError, ssl.SSLError) as error:
    raise SystemExit('Fallo de conectividad: ' + type(error).__name__ + '; valores omitidos.')
