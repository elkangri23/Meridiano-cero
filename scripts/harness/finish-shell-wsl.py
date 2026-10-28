"""Make Linux tools available in interactive WSL shells without reading secrets."""
from pathlib import Path

home = Path.home()
entry = '\n# Meridiano-cero: herramientas Linux\nexport PATH="$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin:$PATH"\n'
for name in ('.profile', '.bashrc'):
    target = home / name
    current = target.read_text() if target.exists() else ''
    if '# Meridiano-cero: herramientas Linux' not in current:
        with target.open('a') as output:
            output.write(entry)
launcher = home / '.local/bin/harness-meridiano'
content = '#!/usr/bin/env bash\nexec bash /mnt/c/Users/amoles/Documents/Codex/Meridiano-cero/scripts/harness/wsl.sh "$@"\n'
if launcher.exists() and launcher.read_text() != content:
    raise SystemExit('El lanzador ya existe con contenido diferente; no se sobrescribe.')
launcher.write_text(content)
launcher.chmod(0o755)
print('PATH Linux y comando harness-meridiano preparados para nuevas terminales.')
