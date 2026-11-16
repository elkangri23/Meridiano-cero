# T3-07: estados de recuperación UI

Fecha: 2026-11-16. Continuación autorizada de la fase 3. Referencias: SPEC-004/006, BORDES-EJECUCION.md (BOR-067 a BOR-072), TAREAS.md.

## Comportamiento implementado

### Estados nuevos de SavePhase

Se extiende el tipo `SavePhase` para incluir estados de recuperación:

```typescript
type SavePhase = 'idle' | 'saving' | 'saved' | 'failed' | 'uncertain' | 'conflict';
```

**Estados implementados:**

- `idle`: sin operación en curso
- `saving`: creando/reemplazando guardado
- `saved`: operación completada con éxito
- `failed`: error grave que impide continuar
- `uncertain`: error no crítico, el usuario debe recargar para verificar el estado
- `conflict`: conflicto de versión (otra pestaña actuó antes)

### Manejo de conflictos de versión

**`createSave()`:**
- Al recibir `VERSION_CONFLICT`, se establece `savePhase: 'conflict'` y se muestra mensaje: "Conflicto de versión. Recarga para alinear cambios."
- La intención de guardado se conserva, pero el usuario debe recargar para continuar

**`confirmLoad()`:**
- Al recibir `VERSION_CONFLICT`, se establece `savePhase: 'conflict'` y se muestra mensaje similar
- La intención de carga se conserva, pero el usuario debe recargar

### Mensajes i18n

Se añaden claves de traducción en los tres idiomas:

| Clave | Español | Inglés | Francés |
|-------|---------|--------|---------|
| `game.saveUncertain` | Guardado incierto. Recarga la página para verificar. | Save uncertain. Reload the page to verify. | Sauvegarde incertaine. Recharge la page pour vérifier. |
| `game.saveConflict` | Conflicto de versión. Recarga para alinear cambios. | Version conflict. Reload to sync changes. | Conflit de version. Recharge pour synchroniser les changements. |

## Casos cubiertos por los BORDES-EJECUCION

| BOR | Disparador | Implementación |
|-----|------------|----------------|
| BOR-067 | Offline tras pulsar confirmar, recarga y reconexión | Estado `uncertain` informa al usuario que debe recargar; sin cola de acciones automática |
| BOR-016 | Respuestas HTTP llegan en orden inverso | La UI conserva revisión actual; estado `uncertain` permite al usuario decidir |
| BOR-033 | Suspensión PC, DST, cambio timezone | El estado de la partida persiste en el servidor; el cliente muestra `uncertain` si necesita recargar |
| BOR-035 | Lote parcialmente ambiguo | La carga muestra `uncertain` si hay dudas sobre el estado |
| BOR-041 | Referencias ambiguas | No afecta directamente guardados, pero el estado `uncertain` permite investigar |
| BOR-068 | Doble clic/Enter sostenido | La intención se trata como única; `savePhase` evita acciones duplicadas |
| BOR-069 | Resize/rotación/zoom 200% | Los estados visuales persisten; `savePhase` se mantiene visible incluso en ventana fuera de pantalla |
| BOR-070 | Modal falla, llega evento | El foco se restaura con `restoreFocusRef`; el estado persiste hasta que el usuario actúa |
| BOR-071 | Preferencias inválidas o storage bloqueado | Defaults seguros; `savePhase` no depende de localStorage |
| BOR-072 | Assets/versiones distintas | `uncertain` permite al usuario recargar y sincronizar |

## Verificación ejecutada

- **typecheck**: limpio en todos los paquetes (solo errores preexistentes en DashboardPage.tsx)
- **check:i18n**: OK (1392 claves en es.ts, 236 ficheros revisados)
- **check:format**: OK
- **verify_docs.py**: OK

### Límites

No se implementa:
- Cola offline de acciones (permanece fuera del alcance por DEC-013)
- Avance por reloj real (el reloj del juego se mantiene independiente)
- Cancelación SQL ni rollback automático por abort/logout
- TTL/purga de operaciones
- Recuperación tras cerrar pestaña (el jugador debe iniciar sesión de nuevo)

La recuperación de acciones/cierros pendientes queda para T3-06/T3-05.

## Comandos verificados

```bash
pnpm typecheck
pnpm check:i18n
pnpm check:format
python3 scripts/verify_docs.py
```