# T3-06: recuperación del identificador de creación

Fecha: 2026-10-29. Entrega parcial autorizada, posterior al checkpoint 8f9c288 del motor v8. T3-06 permanece en curso.

## Comportamiento y uso

Cuando se pierde la respuesta de POST /api/v1/runs, conservar la misma intención y su idempotencyKey. Con la sesión vigente, enviar POST /api/v1/run-creations/lookup con Content-Type application/json, Origin exacto y x-csrf-token actual. El cuerpo admite exclusivamente {"idempotencyKey":"clave-original-16-a-128"}; usar la clave real original, no el ejemplo. No colocarla en URL, telemetría o mensajes de error.

Una respuesta 200 contiene exactamente schemaVersion=1, kind=create_run, status=committed y runId. Recuperar después la vista actual mediante GET /api/v1/runs/:runId. El localizador no devuelve una vista histórica ni la solución. Puede identificar una creación cuyo progreso todavía no sea proyectable; el GET conserva en ese caso su 503 y los datos intactos.

404 NOT_FOUND significa que no hay una creación confirmada visible para esa cuenta en esa consulta. La petición original puede seguir en vuelo: no afirmar rollback ni generar otra clave. Reintentar la consulta o la creación original con la misma clave y cuerpo. No se inventa estado pending ni se toma el bloqueo de creación durante lookup.

401 exige sesión vigente; 403 indica Origin/CSRF rechazados; 400 rechaza cuerpo/campos/query inválidos; 415 rechaza formato no admitido; 503 conserva el fallo cerrado de disponibilidad/esquema. Las respuestas mantienen no-store y el formato de error común. Una clave ajena y una inexistente tienen el mismo error público.

## Implementación y controles

- Contrato público mínimo en packages/contracts; creationLookup=true y operationLookup=false distinguen las capacidades realmente disponibles.
- Validación de clave ASCII de 16–128 caracteres compartida con la creación, sin cambiar su sintaxis existente.
- Consulta parametrizada mediante run_creations unido a runs por propietario y partida. No lee engine_state ni modifica partidas/ledger.
- Sesión y esquema revalidados dentro de la transacción existente, después del control HTTP; la revocación concurrente no reutiliza autoridad antigua.
- Sin migración ni dependencia nueva. Motor, hash original y versión v8 se conservan. Sin cambios visuales.

## Evidencia ejecutada

apps/api/src/game/creation-lookup.integration.test.ts añade siete pruebas sintéticas de integración PostgreSQL/HTTP:

1. Misma clave desde otra instancia de API: idéntico identificador y una sola fila durable.
2. Aislamiento entre cuentas; misma clave textual puede resolver distintas creaciones propias.
3. Estado privado incompatible no se proyecta ni filtra; lookup no escribe y GET sigue fallando cerrado.
4. Sesión, Origin, CSRF, cuerpo cerrado, longitud/tipos, query y Content-Type rechazados según contrato.
5. Creación realmente bloqueada en SQL: pg_blocking_pids acredita la barrera; lookup da 404 antes del commit y encuentra la misma intención después.
6. Revocación después del control HTTP: barrera real sobre sesión; la revalidación transaccional devuelve 401.
7. Caducidad y ausencia de claves, cookies, CSRF, identidades y marcador privado en telemetría.

pnpm test:integration: 45 pruebas correctas en cinco archivos, en el proyecto aislado meridiano-cero-t3-persistence-test, puerto 15434. Las barreras esperan una relación de bloqueo observada, no solo un sleep. Las filas sintéticas se eliminan al terminar; no se modifica el servicio preexistente de 15433.

## Controles generales de esta entrega

- pnpm lint: correcto; límites de dependencias sin infracciones en 136 módulos y 357 relaciones.
- pnpm test: 407 pruebas correctas en 27 archivos. Son pruebas generales del repositorio, distintas de las 45 de integración.
- pnpm typecheck y pnpm build: completos correctos.
- pnpm smoke: página/TSX y proxy web/API con HTTP real en loopback correctos; no es E2E de investigación.
- pnpm scan:secrets: sin hallazgos por patrones; no es garantía exhaustiva.
- scripts/verify_docs.py: 85 Markdown, grafo/referencias válidos y hashes originales DOCX intactos; comprueba integridad documental.
- git diff --check: correcto. pnpm check:format sigue señalando los mismos nueve archivos históricos; no se reescriben migraciones ni se relaja el control para ocultarlo.

Se detuvo la base sintética conservando el volumen. Sin ejecución de CI remota, proveedor real o navegador en esta entrega.

## Límites y trabajo restante

Son pruebas de integración con app.inject y PostgreSQL real; no una nueva prueba de pérdida TCP, navegador o E2E. La pérdida del identificador se representa conservando únicamente la clave al consultar desde otra instancia. El ensayo TCP previo del acuse de COMMIT conserva su evidencia separada.

No hay recuperación general de acciones, guardados, carga o cierre; tampoco sesión persistida de UI, sessionStorage, retención/purga/tombstones, lista de partidas o PlayerView de progreso. Los diez guardados manuales por caso, autoguardado independiente y primer resultado oficial siguen en alcance pendiente. No proveedor real, despliegue, merge o push. Esta entrega no cierra T3 ni acredita cumplimiento integral de OWASP/ASVS.
