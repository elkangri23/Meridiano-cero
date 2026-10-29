# T2: viajes en lotes v10

Fecha: 2026-10-29. Continuación autorizada en worktree; sin commit, merge, push o despliegue. Mantiene la entrega v9 de intervenciones aún sin commit. Referencias: SPEC-001/002/003, SPEC-012 y commit normativo 7962014ec7031c3694f2378d3983a5e488499239.

## Implementación

Travel admite únicamente toCityId ASCII de 1–128 caracteres como paso de lote. Forma cerrada de todos los pasos antes del prefijo; máximo ocho, grafo interno de dependencias y cadena conservadora por defecto. La ruta se obtiene desde la posición que dejó el paso anterior, sin rutas ni retrasos aportados por el cliente.

La confirmación de viajes individuales y agrupados usa el mismo resolutor. Conserva tripCount persistido, retraso seeded por índice, costes, maduración de solicitudes, llegada al primer lugar accesible y plazo exclusivo. El cálculo de posición se separa en una función usada por ese resolutor para mantener complejidad máxima diez; no hay regla paralela de viajes.

Preview de lote y continuación ejecutan una simulación interna con costes base y retraso cero, sin consultar seed. La respuesta costosa conserva estado de entrada, no emite eventos ni revela resultado, destino aplicado, solicitudes prospectivas o sorteo. Advierte que los retrasos pueden cambiar la viabilidad de pasos posteriores. La simulación solo estima: confirmar vuelve a evaluar sobre tiempos y efectos reales. Un cierre o pausa prospectivo tras avanzar tampoco expone ese estado simulado.

La estimación incluye lo simulable hasta una pausa/plazo; no garantiza que todos los pasos se ejecuten. Incluso un viaje de coste base cero exige confirmación si llega a aplicarse en la simulación; no permite consumir el contador silenciosamente. Una ruta imposible no consume índice ni tiempo.

## Pausa, reanudación y versión

Viajes aplicados quedan como historial del lote. Tras serialización, continuar no repite ese prefijo ni su retraso; una ruta fallida pausa y sus dependientes se omiten, mientras independientes requieren nuevo preview. Cancelar conserva viajes hechos y descarta pendientes. Un viaje interrumpido al plazo consume su salida una vez, pero no cambia posición ni revela llegada; descarta el resto del lote.

ENGINE_VERSION=10 registra la semántica nueva y su vocabulario persistible. Hash, seed=42 y expediente original permanecen intactos; engineCompatibility=1 no cambia. Nuevas partidas v10; API reconoce únicamente inicios completos v1–v9 sin escritura. Progreso previo se conserva y falla cerrado; no hay migración automática ni estimación de tripCount desde ciudades descubiertas.

## Pruebas de comportamiento

batch-travel.test.ts incorpora doce escenarios de motor con datos sintéticos:

- Preview de dos viajes sin una lectura de seed, entrada intacta y 330 minutos base; ejecución de la variante máxima tarda 420 y consume dos índices.
- Misma estimación en semilla sin retrasos y con máximos cerca del plazo; solo la ejecución real distingue llegada/vencimiento.
- Solicitud madura al minuto 30 durante viaje y el paso posterior se valida en París.
- Pausa, serialización y continuación independiente conservan el primer viaje; solo se ejecuta el segundo pendiente.
- Omisión de dependientes y cancelación sin otro índice ni coste.
- Empate exacto con plazo sin llegada ni conversación posterior.
- Cuatro entradas inválidas rechazadas antes del prefijo, incluidos delay suministrado y campos malformados.
- Destinos repetidos equivalentes a acciones individuales con contador persistido.
- Contador agotado y versión v9 rechazados operativamente, sin mutación.

simulation.test.ts añade el desplazamiento inicial al lote de ambas rutas ya existentes, además de conversación/detención/recuperación agrupadas en v9. Las seis comparaciones A/B con semillas 1, 42 y 14194 parten de createInitialRun y acciones; no inyectan conocimiento para acreditar solvencia. Mantienen tiempos 455/545 y 485/575 y equivalencia factual con las rutas individuales.

La prueba antigua de vocabulario que rechazaba travel se actualiza para rechazar travel con delay extra; no se elimina la comprobación de forma cerrada. PostgreSQL/HTTP amplía la lectura conservadora de inicios hasta v9 y comprueba que su progreso no se reinterpreta ni sobrescribe.

## Verificación y correcciones de la comprobación

- pnpm lint e imports: correctos, sin infracciones en 138 módulos y 367 relaciones; complejidad máxima diez mantenida tras separar el cálculo de llegada.
- pnpm test: 431 pruebas correctas en 29 archivos; doce escenarios nuevos respecto a v9. El primer intento detectó una expectativa antigua que rechazaba todo travel; se actualizó a travel con delay externo y se repitió la suite completa.
- pnpm typecheck y pnpm build: correctos en todos los paquetes.
- pnpm smoke: página/TSX y proxy web/API correctos con HTTP real en loopback; no es E2E de investigación.
- pnpm scan:secrets: sin hallazgos por patrones; sin dependencias añadidas ni cambios visuales.
- pnpm test:integration tras corregir los tiempos sintéticos: 45 pruebas correctas en cinco archivos. Proyecto aislado meridiano-cero-t3-persistence-test, puerto 15434; base preexistente 15433 y WSL sin cambios.
- scripts/verify_docs.py: 87 Markdown; referencias, grafo e integridad de los DOCX originales correctos. Comprueba documentación, no cumplimiento funcional o de seguridad.
- Primer intento PostgreSQL: 44 correctas, una prueba previa de caducidad incumplía expires_at > created_at si la suite tardaba menos de un segundo. Se corrige únicamente el dato sintético: created_at dos horas antes y expires_at un segundo antes. La restricción SQL y el código de sesiones se conservan. Se repite integración completa tras corregirlo.

- git diff --check correcto; pnpm check:format sigue señalando los mismos nueve archivos históricos, sin nuevas incidencias.

La base sintética se detuvo conservando su volumen.

## Límites

Viajes ya disponibles en lotes internos; cierre y comunicaciones siguen pendientes como pasos. No rutas de acciones HTTP, DTO de progreso, guardados, primer resultado oficial, UI conectada ni E2E. La estimación no es una garantía de ejecución o suficiencia de pruebas. No evaluación real de proveedores ni auditoría integral OWASP/ASVS. Continúan las nueve incidencias históricas de formato; no se modifica el SQL antiguo para ocultarlas.
