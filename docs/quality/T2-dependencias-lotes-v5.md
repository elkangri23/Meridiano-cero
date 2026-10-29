# T2-03: dependencias de lotes y reanudación v5

Fecha: 2026-10-29. Estándares: 7962014ec7031c3694f2378d3983a5e488499239, SPEC-001/002/012, API-juego, GUARDADOS y ADR-005. Continuación en worktree existente; sin commit, merge, push ni despliegue.

## Problema y comportamiento implementado

Antes, continuar trataba todos los pasos posteriores al fallo como independientes. V5 persiste dependsOn por ordinal; solo ejecuta pendientes cuyos requisitos estén applied. Una dependencia fallida/omitida omite el paso transitivamente, sin ejecutar ni cobrar su acción. Sin matriz interna, la entrada es una cadena conservadora. Listas vacías explícitas significan independencia determinada por el servicio; no se confía en datos del modelo/cliente para autorizarla.

Solo se admiten índices enteros únicos hacia pasos anteriores, impidiendo ciclos por construcción. Se rechaza el lote entero antes del prefijo si la forma, parámetros, referencias o tamaño son inválidos; no se coaccionan números/decisiones. Los tipos básicos siguen inspect/collect/talk, con campos cerrados. Arrays dispersos no eluden validación.

Toda continuación requiere preview y confirmación incluso con cero minutos. El preview no cambia estado ni devuelve eventos prospectivos. Confirmar no reintenta prefijo aplicado, fallo anterior u omisiones; una nueva imposibilidad vuelve a pausar con historial/dependencias. Cancelar no ejecuta resto. El vencimiento conserva lo ya completado, descarta resto y no materializa el efecto terminal.

El parser valida forma y coherencia de estados/dependencias, hasta ocho registros de 4.096 caracteres y motivos de hasta 512. Corrupción es BATCH_STATE_INVALID operativo sin transición, incluso al cancelar. Se emiten eventos de omisión, pausa y finalización por ordinal, sin IDs ocultos. Son eventos del motor; su DTO público aún debe adaptarse, no serializarse íntegro.

La coordinación de pasos iniciales/reanudados se comparte en batch.ts; validación/serialización queda en pending-batch.ts. Módulos usados, sin dependencia ni framework adicional; motor puro y complejidad máxima diez conservados.

## Versionado y datos

EngineVersion pasa a 5 porque cambia semántica de reanudación; engineCompatibility del expediente sigue 1. El fixture, seed y hash originales no cambian. La API crea v5 y lee inicios vírgenes v1/v2/v3/v4 por comparación completa sin escribirlos. Progreso antiguo se conserva y rechaza; no se añade metadata ni se cambia versión para forzar compatibilidad. No hay migración de snapshots ni acciones HTTP nuevas.

## Pruebas

La suite añade escenarios de cadena por defecto, dependencia transitiva, independencia explícita, prefijo aplicado, segunda pausa y serialización, cancelación, grafos inválidos, parámetros/arrays dispersos, mutación de entrada, corrupción persistida, decisión objeto, versión v4 rechazada, metadata acotada y vencimiento en continuación. Los estados corruptos son unidades sintéticas; serializar/deserializar no es un reinicio PostgreSQL con guardados. Las dos rutas completas del caso continúan en simulaciones por acciones.

- pnpm test: 356 pruebas correctas, 25 archivos; 29 nuevas de dependencias/reanudación. Se conservan las dos rutas del caso y sus tiempos base. Las pruebas anteriores de continuación independiente declaran ahora esa independencia en la metadata interna.
- pnpm lint: ESLint e imports globales correctos; motor puro, complejidad máxima diez, sin rebajar reglas. Revisión focal final del motor y archivos API afectados correcta.
- pnpm typecheck y pnpm build completos correctos. La compilación de dependencias del motor se repite en integración para verificar los últimos cierres de metadata.
- pnpm test:integration: 38 pruebas correctas, cuatro archivos, PostgreSQL/HTTP real aislado en 15434. Se verifica nueva ejecución v5, lectura de inicios v1–v4 sin reescritura y preservación/rechazo de progreso de esas versiones. No acredita guardados/reinicio de lotes, que todavía no tienen API.
- Repetición focal final: 60 pruebas correctas de lotes, costes y dependencias en tres archivos tras el último ajuste de validación.
- Smoke real loopback de página/TSX/proxy API correcto; escaneo por patrones sin hallazgos. No son E2E de investigación ni auditoría exhaustiva de secretos.
- scripts/verify_docs.py: 81 Markdown, enlaces/IDs y grafo válidos, hashes DOCX originales intactos. Integridad documental, no prueba de controles OWASP.

Entorno: proyecto meridiano-cero-t3-persistence-test, puerto 15434 y datos sintéticos. Se detiene únicamente su contenedor conservando volumen; base preexistente 15433 y WSL sin cambios. No nuevos commits, merges o push.

## Límites

No se cierra T2-03/T2 ni se declara GDD/OWASP cumplido. Faltan lotes de otros tipos y construcción de dependencias a partir de órdenes autorizadas en la integración API/IA; no se revela azar de viajes para facilitar un preview. El API público continúa limitado a catálogo y partidas iniciales, sin grafo configurable del cliente. Revisión/rama, tokens, idempotencia de acciones, guardados, primer resultado oficial y UI/E2E siguen pendientes.

El máximo de retraso, vocabulario NPC/solución, reglas genéricas y formato histórico conservan sus pendientes anteriores. Sin proveedor real, credenciales, descargas, backup/restore o despliegue en esta entrega.
