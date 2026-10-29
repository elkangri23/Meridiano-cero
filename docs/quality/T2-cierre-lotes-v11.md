# T2: cierre en lotes v11

Fecha: 2026-10-29. Continuación autorizada en worktree, posterior a v9/v10 aún sin commit. Referencias: SPEC-001/002/003, API-juego y SPEC-012; estándares de 7962014ec7031c3694f2378d3983a5e488499239. Sin commit, merge, push o despliegue.

## Comportamiento

Finish es un paso interno con params vacío. La validación cerrada rechaza confirmed, result, ownerId y cualquier campo adicional antes de aplicar el prefijo. No se almacena una aprobación en el paso ni se deduce del contenido de IA. La aprobación pertenece a la confirmación del lote o de su continuación, futura responsabilidad del servicio autenticado.

Cuando la simulación alcanza finish, resolveAction devuelve confirmation_required incluso con coste cero: estado original, ningún evento y ningún informe prospectivo. La descripción indica que incluye cierre y que no se ejecutarán pasos posteriores. Se mantiene estimación base sin leer seed en viajes; el preview no garantiza viabilidad o resultado.

En confirmAction el adaptador interno invoca el mismo resolveFinish individual con aprobación interna. Usa el evaluador existente de objetivos y detenciones, sin duplicar criterios. Case_closed termina inmediatamente el coordinador, descarta resto y deja pendingBatch=null; no añade batch_completed ni ejecuta solicitudes, espera o conversación posteriores.

Un fallo previo pausa conservando prefijo. Finish dependiente se omite cuando falta su dependencia aplicada; no cierra silenciosamente. Finish independiente pendiente requiere nueva confirmación tras serialización, incluso a cero minutos. Cancelar conserva prefijo sin cierre. Si una acción previa alcanza el plazo, prevalece reason=deadline y no se emite finish ni se madura un resultado situado exactamente en ese plazo.

## Compatibilidad y arquitectura

Motor de ejecución v11; formato del expediente engineCompatibility=1, contenido, hash y seed originales sin cambios. La API crea estados v11 y lee únicamente inicios completos v1–v10 sin reescritura. Progreso anterior conservado/rechazado, sin migración implícita. No se expone un endpoint ni se convierte el informe en primer resultado oficial: ese registro y carrera/reputación siguen pendientes del servicio transaccional.

Se reutiliza el coordinador terminal existente y el resolutor individual. La validación de espera se extrae como helper realmente usado para conservar complejidad máxima diez al ampliar el vocabulario. No dependencias nuevas, clases base o capas sin consumidor. UI/prototipo y estética sin cambios.

## Escenarios de verificación

batch-finish.test.ts añade once escenarios puros de motor con datos sintéticos:

1. Cierre a minuto cero exige preview sin transición/eventos/informe y solo después confirma unresolved.
2. Prefijo aplicado una vez; cierre idéntico al individual; resto sin efectos, tiempo o eventos.
3. Finish dependiente de fallo se omite sin cerrar.
4. Finish independiente después de pausa/serialización necesita nueva confirmación y no repite prefijo.
5. Cancelación sin cierre ni pérdida de prefijo.
6. Vencimiento previo prevalece, sin finish ni maduración exactamente al plazo.
7. Cuatro variantes de parámetros de aprobación/resultado/propiedad rechazadas antes del prefijo.
8. Rama cerrada no vuelve a cerrar y estado v10 no se ejecuta con semántica v11.

Las seis comparaciones A/B de simulation.test.ts con semillas 1, 42 y 14194 ahora incluyen finish en el lote de intervención. Parten de createInitialRun y acciones, sin inyectar conocimiento, y se comparan con las rutas individuales. No son E2E de navegador ni verificación del registro oficial de carrera.

La integración PostgreSQL/HTTP comprueba nuevas partidas v11 y amplía hasta v10 la lectura inicial sin reescritura y el rechazo conservador de progreso anterior.

## Verificación ejecutada

- pnpm lint e imports: correctos, sin infracciones en 139 módulos y 372 relaciones. Complejidad máxima diez y motor puro conservados.
- pnpm test: 442 pruebas correctas en 30 archivos, once escenarios nuevos respecto a v10.
- pnpm typecheck y pnpm build: completos correctos.
- pnpm smoke: página/TSX y proxy web/API correctos con HTTP real en loopback; no equivale a E2E de investigación.
- pnpm scan:secrets: sin hallazgos por patrones; sin garantía exhaustiva.
- pnpm test:integration: 45 pruebas correctas en cinco archivos; PostgreSQL/HTTP reales sintéticos, proyecto aislado meridiano-cero-t3-persistence-test, puerto 15434. Ninguna prueba de proveedor real o navegador.
- scripts/verify_docs.py: 88 Markdown, grafo/referencias válidos y hashes originales DOCX intactos. Integridad documental, no evidencia de cumplimiento OWASP/ASVS.
- git diff --check: correcto. pnpm check:format señala los mismos nueve archivos históricos; no se debilita su control.

La base sintética se detuvo conservando volumen; base preexistente de 15433 y WSL sin cambios.

## Límites

T2/T3 siguen abiertos. Comunicaciones permanecen fuera de los lotes; reglas/vocabularios de expedientes y aceptación completa pendientes. No preview/commit HTTP, DTO de progreso, autoguardados/manuales, primer resultado oficial, UI conectada ni E2E. No evaluación real de proveedor, CI remota o certificación OWASP/ASVS. Persisten nueve incidencias históricas de formato, sin reescribir migraciones para ocultarlas.
