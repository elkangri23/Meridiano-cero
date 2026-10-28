"""Explicitly authorized, minimal provider request, without project context or tools."""
import json
import os
from pathlib import Path
import subprocess
import tempfile

config = Path.home() / '.local/share/meridiano-harness/claude-config'
environment = os.environ.copy()
environment['CLAUDE_CONFIG_DIR'] = str(config)
environment['DISABLE_AUTOUPDATER'] = '1'
environment['CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC'] = '1'
command = [str(Path.home() / '.local/bin/claude'), '--print', 'Reply exactly WSL_OK.',
           '--system-prompt', 'Connectivity check. Reply only WSL_OK.',
           '--model', 'auto', '--tools', '', '--setting-sources', 'user',
           '--strict-mcp-config', '--mcp-config', '{"mcpServers":{}}',
           '--no-session-persistence', '--disable-slash-commands', '--output-format', 'json']
with tempfile.TemporaryDirectory(prefix='meridiano-provider-smoke-') as directory:
    try:
        result = subprocess.run(command, cwd=directory, env=environment, capture_output=True, text=True, timeout=90)
    except subprocess.TimeoutExpired:
        raise SystemExit('La prueba agotó 90 segundos; no se muestran datos internos.')
try:
    response = json.loads(result.stdout)
except (ValueError, TypeError):
    raise SystemExit('La prueba no devolvió JSON válido; contenido omitido para proteger credenciales.')
passed = result.returncode == 0 and not response.get('is_error') and response.get('result', '').strip() == 'WSL_OK'
print('FreeLLMAPI desde Claude en WSL: ' + ('OK (WSL_OK)' if passed else 'FALLO'))
if isinstance(response.get('total_cost_usd'), (int, float)):
    print('Coste estimado por Claude (USD):', response['total_cost_usd'])
if not passed:
    print('Código de salida:', result.returncode)
    print('Detalle de respuesta omitido; no se ha enviado contenido del proyecto.')
    raise SystemExit(1)
