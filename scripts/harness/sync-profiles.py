"""Embed reviewed Markdown role profiles into Harness using only stdlib.

Default writes only roles and adds profile files to protected_paths.
--check verifies synchronization without writing. No daemon or model is started.
"""
import argparse
import json
from pathlib import Path
import re

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check', action='store_true')
arguments = parser.parse_args()
root = Path(__file__).resolve().parents[2]
directory = root / 'docs/agents'
team = json.loads((directory / 'equipo.json').read_text(encoding='utf-8'))
common = (directory / team['common']).read_text(encoding='utf-8').strip()
roles = team['roles']
lines = ['roles:']
for role_id, role in roles.items():
    if not re.fullmatch(r'[a-z][a-z0-9-]*', role_id):
        raise SystemExit('Identificador de rol inválido.')
    if role['mode'] not in ('readonly', 'write'):
        raise SystemExit('Modo de rol inválido.')
    if role['mode'] == 'readonly' and role['paths_allow']:
        raise SystemExit('Un rol de lectura no puede tener parcela de escritura.')
    if role['mode'] == 'write' and not role['paths_allow']:
        raise SystemExit('Un escritor necesita una parcela explícita.')
    if any(other not in roles or other == role_id for other in role.get('independent_of', [])):
        raise SystemExit('Dependencia de revisión inválida.')
    profile_path = (directory / role['profile']).resolve()
    if profile_path.parent != directory.resolve():
        raise SystemExit('El perfil debe estar en docs/agents.')
    profile = profile_path.read_text(encoding='utf-8').strip()
    instructions = common + '\n\n' + profile
    denied = ['**'] if role['mode'] == 'readonly' else team['paths_deny']
    lines.extend([
        '  ' + role_id + ':',
        '    route: ' + team['route'],
        '    mode: ' + role['mode'],
        '    concurrency: 1',
        '    paths_allow: ' + json.dumps(role['paths_allow'], ensure_ascii=False),
        '    paths_deny: ' + json.dumps(denied, ensure_ascii=False),
        '    fallback: none',
    ])
    if role.get('independent_of'):
        lines.append('    independent_of: ' + json.dumps(role['independent_of']))
    lines.append('    instructions: |')
    lines.extend('      ' + line if line else '' for line in instructions.splitlines())

config_path = root / 'harness.yaml'
current = config_path.read_text(encoding='utf-8')
pattern = re.compile(r'^roles:\n.*?(?=^limits:)', re.MULTILINE | re.DOTALL)
if len(pattern.findall(current)) != 1:
    raise SystemExit('No se encuentra una única sección roles antes de limits; se requiere revisión.')
updated = pattern.sub(lambda _: '\n'.join(lines) + '\n', current, count=1)
protection = re.compile(r'^(  protected_paths: )(\[[^\n]+\])$', re.MULTILINE)
match = protection.search(updated)
if not match:
    raise SystemExit('protected_paths no tiene el formato de lista esperado; se requiere revisión.')
# The existing inline list is both valid JSON and valid YAML.
protected = json.loads(match[2])
for entry in ['AGENTS.md', 'docs/agents/**']:
    if entry not in protected:
        protected.append(entry)
updated = protection.sub(lambda _: '  protected_paths: ' + json.dumps(protected, ensure_ascii=False), updated, count=1)
if arguments.check:
    if updated != current:
        raise SystemExit('Perfiles desincronizados: ejecuta python3 scripts/harness/sync-profiles.py y revisa el diff.')
    print('OK: 9 perfiles completos sincronizados con harness.yaml; no se ha ejecutado ningún agente.')
else:
    with config_path.open('w', encoding='utf-8', newline='\n') as output:
        output.write(updated)
    print('9 perfiles incorporados a harness.yaml. Límites, proveedor y aprobación conservados.')
