# T2: detención y recuperación en lotes v9

Fecha: 2026-10-29. Continuación en el worktree existente, según SPEC-001/002/003 y SPEC-012, con referencia normativa 7962014ec7031c3694f2378d3983a5e488499239. Sin commit, merge, push ni despliegue en esta entrega.

## Comportamiento implementado

El vocabulario interno de lotes admite detain y recover. Detain exige exactamente suspectId, warrantId, locationId y mode=interactive; recover exige exactamente objectId. Identificadores ASCII no vacíos, hasta 128 caracteres; no se admiten flags de autoridad, admisibilidad ni campos adicionales. La forma completa de todos los pasos se valida antes de aplicar el prefijo.

La coordinación reutiliza applyMaterial y los resolutores individuales: detención 15 minutos y recuperación 20 en el caso fijo. No se duplica lógica de orden, identidad, ubicación conocida, presencia, acceso o procedencia. Detener no concede acceso al almacén ni cierra la partida. Recuperar conserva las reglas de admisibilidad existentes.

Un preview costoso devuelve la partida de entrada y ningún evento. Confirmar valida cada paso sobre el resultado previo. Si falla, conserva el prefijo aplicado, pausa y permite cancelar o continuar independientes con nueva confirmación; no repite detenciones aplicadas al reanudar. Dependencias omitidas no consumen tiempo. Al llegar exactamente al plazo no se aplica el efecto terminal ni el resto del lote.

Se conserva límite de ocho pasos, grafo interno acíclico hacia ordinales previos, cadena conservadora por defecto y límites del snapshot. No cambia el contrato público de acciones HTTP; no se acepta un grafo suministrado por IA/cliente como autoridad.

## Compatibilidad

ENGINE_VERSION=9 distingue el vocabulario ampliado y sus snapshots. El expediente original, su seed=42, hash y engineCompatibility=1 permanecen intactos. Nuevas partidas se registran v9. La API reconoce inicios completos v1–v8 sin modificarlos; progreso antiguo permanece conservado y devuelve indisponibilidad, sin reinterpretación o migración implícita. Ejecutar estado v8 en motor v9 produce ENGINE_VERSION_UNSUPPORTED.

## Pruebas y alcance

batch-interventions.test.ts añade doce escenarios de motor: preview sin efectos; equivalencia con acciones individuales; orden ausente y omisión dependiente; continuación independiente tras serialización sin detención duplicada; empates de plazo a 15/35 minutos; cinco variantes de parámetros inválidos; acceso/presencia; rechazo de ejecución antigua.

Los estados preparados en ese archivo son datos sintéticos controlados para probar bordes, no evidencia de que el caso sea resoluble. simulation.test.ts sí obtiene todo desde createInitialRun y acciones del motor: las rutas A/B ahora agrupan conversación de identidad, detención y recuperación, y se comparan con sus versiones individuales en semillas 1, 42 y 14194. No se inyectan órdenes ni descubrimientos para acreditar esas rutas.

La integración PostgreSQL/HTTP comprueba creación v9 y lectura de inicios v1–v8, incluyendo rechazo y conservación del progreso anterior. Es distinta de las pruebas puras de motor.

## Verificación de la entrega

- pnpm lint e imports: correctos, sin infracciones en 137 módulos y 362 relaciones; complejidad máxima y límites del motor conservados.
- pnpm test: 419 pruebas correctas en 28 archivos, doce más que la entrega anterior. Primer intento bajo sandbox: 418 correctas y un fallo unavailable en el HTTP Ollama sintético. Repetición completa con acceso a loopback: 419 correctas; no se cambió la prueba ni el transporte para obtener ese resultado.
- pnpm test:integration: 45 pruebas correctas en cinco archivos, PostgreSQL/HTTP sintéticos en puerto 15434; ampliada compatibilidad de inicios hasta v8.
- pnpm typecheck y pnpm build: correctos en todos los paquetes.
- pnpm smoke: página/TSX y proxy web/API correctos con HTTP real en loopback, sin afirmar E2E del juego.
- pnpm scan:secrets: sin hallazgos por patrones, sin garantía exhaustiva.
- scripts/verify_docs.py: 86 Markdown, referencias/grafo válidos, originales DOCX intactos. Verifica documentación, no producto.
- git diff --check: correcto. Sin dependencias añadidas ni cambios visuales.

La base sintética se detiene conservando volumen; el servicio preexistente de 15433 y WSL permanecen sin cambios. El proyecto conserva las nueve incidencias históricas de formato, distintas de los cambios de esta entrega.

## Límites

T2/T3 siguen abiertos. Viajes, comunicaciones y cierre aún no se admiten como pasos de lote. Finish continúa como acción separada confirmada. Faltan vocabularios/reglas generales del expediente, proyección de progreso, acciones HTTP, guardados, primer resultado oficial, interfaz conectada y E2E. No evaluación de proveedor real ni aceptación manual de investigación. El formato histórico sigue pendiente; no se reescriben migraciones para ocultarlo ni se acredita OWASP/ASVS integral.
