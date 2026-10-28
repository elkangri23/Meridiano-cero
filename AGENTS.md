# Trabajo en Meridiano-cero

Las instrucciones actuales del usuario tienen prioridad. Antes de trabajar,
consultar docs/plan/BASELINE.md, ROADMAP.md, BACKLOG.md y las specs aplicables.
El backlog indica estado y dependencias; la existencia de documentación no
supone que una tarea esté implementada o aprobada.

Trabajar siempre en worktrees para las nuevas tareas. Escribir siempre los
mensajes de commit en español. No hacer nuevos commits, merges, push,
publicaciones o despliegues sin autorización del usuario. La integración es manual.
No generar subagentes ni delegaciones sin una petición expresa.

Conservar los originales de docs/meridi y las credenciales. No modificar la
instalación WSL ni otros proyectos como efecto de una tarea de producto.
Usar datos sintéticos en pruebas. Distinguir pruebas documentales, pruebas
unitarias, integración y comprobaciones manuales; registrar sus límites.

Verificar documentación con:

```text
python3 scripts/verify_docs.py
```
