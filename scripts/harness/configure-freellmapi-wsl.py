"""Import only the approved provider fields; never print credential values."""
import json
import os
from pathlib import Path

source = Path('/mnt/c/Users/amoles/.claude/settings.json')
destination = Path.home() / '.local/share/meridiano-harness/claude-config'
fields = (
    'ANTHROPIC_BASE_URL', 'ANTHROPIC_AUTH_TOKEN', 'ANTHROPIC_MODEL',
    'ANTHROPIC_DEFAULT_OPUS_MODEL', 'ANTHROPIC_DEFAULT_SONNET_MODEL',
    'ANTHROPIC_DEFAULT_HAIKU_MODEL',
)
settings = json.loads(source.read_text())
approved = {key: settings.get('env', {})[key] for key in fields if key in settings.get('env', {})}
if not approved.get('ANTHROPIC_AUTH_TOKEN') or not approved.get('ANTHROPIC_BASE_URL'):
    raise SystemExit('Falta URL o token en la configuración de origen; valores omitidos.')
destination.mkdir(parents=True, exist_ok=True, mode=0o700)
os.chmod(destination, 0o700)
target = destination / 'settings.json'
if target.exists():
    raise SystemExit('La configuración aislada ya existe; no se sobrescribe.')
descriptor = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(descriptor, 'w') as output:
    json.dump({'env': approved}, output, indent=2)
    output.write('\n')
print('Configuración aislada creada con permisos 600. Valores secretos omitidos.')
