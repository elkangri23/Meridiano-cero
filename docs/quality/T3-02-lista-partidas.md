# T3-02: lista paginada de partidas propias

Fecha: 2026-10-29. Continuación autorizada de fase 3 independiente de acciones del motor aún pendientes. Worktree actual, sin commit, merge, push o despliegue. Referencias: SPEC-004, API-juego, SPEC-011/012 y estándares de 7962014ec7031c3694f2378d3983a5e488499239.

Esta evidencia conserva la entrega inicial del listado (57 pruebas de integración). La [entrega posterior del archivo web](T3-03-archivo-conectado.md) añade profileId y caseTitle al contrato y amplía la suite a 58; sus campos/forma vigentes prevalecen sobre la instantánea de abajo.

## Función y uso

GET /api/v1/runs permite localizar partidas de la cuenta actual sin conocer su clave de creación. Ejemplo de consulta: /api/v1/runs?limit=25&status=active. Usa la sesión vigente y devuelve no-store. La aplicación web todavía debe incorporar su pantalla; no hay login público o flujo de reanudación conectado por anticipación.

Entrada cerrada: limit 1–100, defecto 25; status opcional active/closed; cursor. Sin campos ownerId, SQL, rutas, filtros arbitrarios o parámetros repetidos. Items contiene únicamente runId, caseId, status, version de concurrencia HTTP y createdAt RFC3339. No ramas históricas, reloj, conversaciones, payloads, informes, solución, hash o estado del motor. Lista vacía devuelve items=[] y nextCursor=null.

Esta metadata propia puede leerse aunque GET /runs/:runId no pueda proyectar su progreso. La lista no afirma compatibilidad de ejecución ni transforma el recurso en una partida inicial. Una fila de la página con estado o metadata no soportados produce fallo cerrado, sin reflejar valores privados en el error.

## Paginación y autorización

Orden created_at DESC,id DESC. Cursor v1.scope.runId con scope all/active/closed. El cliente lo trata como localizador opaco, sin construirlo para autorizar acceso. No contiene un secreto ni concede permisos: el ancla debe existir en la cuenta y filtro actuales. Cursor ajeno, inexistente, incompatible o malformado devuelve INVALID_REQUEST sin distinguir propiedad. Puede cambiar limit conservando ámbito.

Se usa keyset, sin OFFSET. Ancla, validación de existencia y página pertenecen a la misma consulta/snapshot PostgreSQL. Las comparaciones usan el timestamp completo de DB, no el createdAt mostrado a milisegundos. Se consulta limit+1 para emitir nextCursor solo cuando hay otra página. Inserciones recientes no entran al continuar hacia atrás; cambios de filtro/estado o borrado del ancla pueden exigir reiniciar. No se promete snapshot inmutable entre peticiones.

La transacción de sesión/esquema existente se comparte con creación/lectura mediante su helper real, sin duplicar una política de autorización. La ruta hace el control HTTP y el servicio revalida sesión dentro de SQL antes de consultar. Revocación concurrente no permite aprovechar la primera comprobación. Solo SELECT parametrizado sobre filas propias; engine_state completo nunca sale de SQL: únicamente se extrae status autorizado. Índice existente owner_id/created_at/id, sin migración o dependencia nueva.

## Pruebas

run-list.integration.test.ts añade nueve escenarios con actores/datos sintéticos y PostgreSQL real:

1. Sesión obligatoria, no-store, forma pública exacta y ausencia de contenido privado/recursos ajenos.
2. Seis timestamps separados por microsegundos, idénticos al mostrarse en DTO; tres páginas sin omisiones/duplicados.
3. Active/closed y cuenta sin partidas.
4. Cursor ligado a cuenta/filtro, ajeno e inexistente indistinguibles; cambio de límite válido.
5. Campos extra, límites inválidos, repetidos e intento de SQL en cursor rechazados.
6. Ausencia de escritura y metadata de recurso no proyectable sin engañar al GET actual.
7. Inserción de partida reciente entre páginas no altera el recorrido hacia atrás.
8. Estado sintético desconocido falla cerrado, sin filtración.
9. Revocación posterior al control HTTP: barrera real sobre sesión y pg_blocking_pids observada; resultado 401.

Los estados closed/no proyectable son preparación controlada de metadata mediante el dueño de DB de pruebas, no evidencia de cierre de juego o migración. El actor de aplicación mantiene sus permisos normales. Se eliminan exclusivamente filas sintéticas al terminar. No es E2E de UI, proveedor o investigación.

## Verificación ejecutada

- pnpm lint e imports correctos: 156 módulos y 442 relaciones, sin infracciones. Validación separada en límites/estado/cursor usados por la ruta, manteniendo complejidad máxima diez.
- pnpm typecheck completo correcto.
- pnpm test:integration: 57 pruebas correctas en seis archivos, nueve nuevas. Ancla/página, microsegundos, propiedad y revocación concurrente probados en PostgreSQL/HTTP sintético.
- pnpm test: 523 pruebas generales correctas en 35 archivos. Motor v13/validador 1.4 y rutas originales conservados.
- pnpm build y pnpm smoke correctos; página/TSX y proxy web/API por HTTP real en loopback. No acredita E2E de listado o investigación.
- pnpm scan:secrets sin hallazgos por patrones, sin garantía exhaustiva.
- scripts/verify_docs.py: 94 Markdown, referencias/grafo válidos y hashes originales DOCX intactos. Integridad documental, no certificación funcional/OWASP.
- git diff --check correcto. Formato global conserva ocho incidencias históricas; no se modifican migraciones ni reglas para ocultarlas.

Base sintética meridiano-cero-t3-persistence-test detenida conservando volumen; puerto preexistente 15433 y WSL sin cambios.

## Límites

T3-02 permanece en curso: faltan proyección general de progreso, preview/commit de acciones, operaciones, reportes, guardados y primer resultado oficial, y pantalla conectada. T2 sigue abierto por reglas/políticas generales y aceptación. Motor v13, validador 1.4 y hash original sin cambios. Sin CI remota o certificación OWASP/ASVS. Ocho incidencias históricas de formato pendientes.
