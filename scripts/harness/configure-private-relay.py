"""Change only WSL's endpoint; preserve credentials without displaying them."""
import ipaddress
import json
import os
from pathlib import Path
import re
import subprocess
from urllib.parse import urlsplit, urlunsplit

route = subprocess.check_output(['ip', 'route', 'show', 'default'], text=True)
match = re.search(r'default via (\d+\.\d+\.\d+\.\d+)', route)
if not match or not ipaddress.ip_address(match[1]).is_private:
    raise SystemExit('No se ha encontrado la interfaz privada de Windows.')
config = Path.home() / '.local/share/meridiano-harness/claude-config/settings.json'
settings = json.loads(config.read_text())
endpoint = urlsplit(settings['env']['ANTHROPIC_BASE_URL'])
if endpoint.scheme != 'http' or endpoint.username or endpoint.password:
    raise SystemExit('Configuración de URL inesperada; no se ha modificado.')
try:
    previous_relay = endpoint.port == 31416 and ipaddress.ip_address(endpoint.hostname).is_private
except ValueError:
    previous_relay = False
if endpoint.hostname not in ('localhost', '127.0.0.1', match[1]) and not previous_relay:
    raise SystemExit('El destino configurado ya no es el puente local; no se modifica.')
updated = urlunsplit((endpoint.scheme, match[1] + ':31416', endpoint.path, endpoint.query, endpoint.fragment))
if updated != settings['env']['ANTHROPIC_BASE_URL']:
    backup = config.with_name('settings.before-private-relay.json')
    if not backup.exists():
        descriptor = os.open(backup, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(descriptor, 'w') as output:
            output.write(config.read_text())
    settings['env']['ANTHROPIC_BASE_URL'] = updated
    temporary = config.with_name('settings.relay-update.json')
    descriptor = os.open(temporary, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(descriptor, 'w') as output:
        json.dump(settings, output, indent=2)
        output.write('\n')
    os.replace(temporary, config)
print('URL privada de WSL preparada. Credenciales conservadas; valores omitidos.')
