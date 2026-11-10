# Contribuir a Meridiano-cero

## Licencia

Todo el código propio se distribuye bajo **AGPL-3.0-only**. Al contribuir aceptas que tu aportación se distribuya bajo esa licencia; conservas los derechos que te correspondan sobre ella. Ver [LICENSE](./LICENSE) y [NOTICE.md](./NOTICE.md).

## Flujo de trabajo

1. Trabaja siempre en una rama o worktree nueva, nunca directamente sobre `main`.
2. Antes de trabajar, consulta `docs/plan/BASELINE.md`, `docs/plan/ROADMAP.md`, `docs/plan/BACKLOG.md` y las specs aplicables. El backlog indica el estado y las dependencias; que algo esté documentado no significa que esté implementado o aprobado.
3. Mensajes de commit en español.
4. No hagas commits, merges, push, publicaciones ni despliegues sin autorización: la integración es manual y la decide el responsable del proyecto.
5. Usa datos sintéticos en las pruebas. No modifiques los originales de `docs/meridi` ni las credenciales.
6. Implementa el cambio mínimo, con responsabilidades claras, y actualiza la documentación y la evidencia que le correspondan. No des una fase por aceptada por superar solo una parte de sus pruebas.

## Verificación

Antes de dar un cambio por terminado, ejecuta al menos:

```text
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm eval:ai --mock
python3 scripts/verify_docs.py
```

Los cambios que toquen base de datos, API o juego necesitan además las pruebas de integración y el E2E que les correspondan (ver `docs/manuales/PRUEBAS.md`).
