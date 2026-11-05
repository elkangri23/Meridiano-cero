# Estado integrado del proyecto

Estado vigente: motor v14 y validador 1.5; rutas A/B verificadas con tiempos base/máximos 455/545 y 485/575. T3 conecta archivo, catálogo, creación web recuperable y consulta de ficha inicial por cuenta/pestaña; conserva lectura inicial y recuperación por clave en API. **T3-04 completada**: adaptador Ollama, rutas HTTP IA (interpret/narrate/converse/health), integración prototype web, motor conectado (POST /api/v1/runs/:runId/action). **Fase A (2026-11-05) completada**: persistencia de acciones confirmadas y de cargas de guardado (migración 0004), pantalla de juego en /runs/:runId con órdenes en texto libre, ofertas del motor, guardados manuales, ventanas y informe final, y E2E T3-05 con ambas rutas en navegador. Fase 4 (T4-01 a T4-07) completada: generador (pipeline 9 etapas, checkpoints, validadores), simulador de rutas, worker/cola PostgreSQL, import/export, E2E generador y fencing. Fase 5 (T5-01 a T5-07) completada: catálogo, geografía, NPCs, carrera, audio/TTS, auditoría GDD. Fase 6 (T6-01 a T6-03, T7-01 a T7-06) completada: setup/admin, migraciones/health, backup/restore, FreeLLMAPI, conexiones personales, cuotas/corte, staging/OWASP, SLO/capacidad, residencia/retención. **Fase B (2026-11-05)**: modo producción en la API (APP_MODE=production, origen https://meridianocero.laurafernandezenfermeria.com, registro público activado, sesión local de desarrollo desactivada fail-closed), registro público real con contraseñas Argon2id, verificación de email y recuperación con tokens de un solo uso en base de datos (migración 0005), compose de producción (PostgreSQL 18 con volumen + API con migraciones al arrancar) y backups con rotación de 7. 797 pruebas pasando globalmente (62 archivos), 77 de integración PostgreSQL/HTTP, typecheck limpio en todos los paquetes. Calidad de formato histórica, juego conectado y aceptación completa siguen pendientes.

Últimas evidencias: [cierre individual v14](../quality/T2-cierre-individual-v14.md), [formato cerrado 1.5](../quality/T2-formato-cerrado.md), [ficha inicial conectada](../quality/T3-ficha-inicial-conectada.md), [contenido reconocido 1.4](../quality/T2-contenido-ejecutable.md), [permisos del testimonio v13](../quality/T2-permisos-testimonio-v13.md) y [lista propia](../quality/T3-02-lista-partidas.md) y [archivo web](../quality/T3-03-archivo-conectado.md) y [creación recuperable](../quality/T3-creacion-web-recuperable.md). c4a86cd consolida v6, 8f9c288 registra v7/v8 y 42aaa42 el localizador de creación; los avances posteriores se consolidan para su integración en main por autorización expresa del usuario. Las cifras de integración inicial siguientes son históricas.

Actualizado: 2026-10-30. La línea consolidada incluye main 6298be7 (base 6f43ba2), codex/t3-04-integracion-ia 3a28abd y los avances de motor/API/web posteriores. El usuario autoriza integrarlos en main y mantenerla como única rama. [Evidencia de integración](../quality/INTEGRACION-T3-04.md). Las instantáneas previas de T1/T3 conservan su alcance histórico.

El [backlog](BACKLOG.md) conserva dependencias; este documento refleja código y verificaciones de la combinación, sin declarar el juego terminado.

## Implementación disponible

| Área | Disponible | Pendiente |
|---|---|---|
| Base | Seis proyectos de producto más la raíz pnpm | No distribución del juego completa |
| API | Health/readiness, sesión local, catálogo, creación/lectura, lista propia paginada y localización por clave; preview/commit con persistencia transaccional e idempotencia, proyección de progreso (PlayerViewDto), guardados manuales (crear/listar/cargar/borrar/reemplazar) y registro de operaciones | Reportes y primer resultado oficial en API |
| DB | Migrador activo, roles locales, partidas y ledger de creación transaccional; migración 0004: manual_saves, operation_records, ai_usage, ai_quotas, ai_global_cutoff, ai_connections y GRANT UPDATE mínimo sobre runs | Columna runs.status solo en el modelo drizzle, no en SQL (deuda: el estado autoritativo vive en engine_state); src/db conservado como histórico no activo |
| Motor | Ejecución v14: cierre individual con confirmación separada y conocimiento específico para testimonio, evidencias/órdenes, costes, lotes con solicitudes/esperas, viajes, detención/recuperación, cierre y acuses de comunicación y ambas rutas con retrasos máximos | Comunicaciones factuales/equipo, dependencias en API, reglas/vocabularios y aceptación completa |
| Expediente | Validador estructural 1.5: formato cerrado, referencias/ciclos, mapa, conocimientos/solución y contenido reconocido; creación valida copia estable | Condiciones NPC/conversación, operadores/payloads y solvencia general |
| UI | Archivo MS-DOS en raíz (sesión/lista/filtros/páginas/catálogo/creación recuperable y ficha inicial); prototipo separado en /prototype; pantalla de juego en /runs/:runId (escena, inventario, reloj, mapa 3 ciudades, dossier, laboratorio/comunicaciones, guardados manuales, informe final, ventanas movibles/minimizables por teclado y ratón, orden en texto libre con preview/confirmación y recuperación de commit perdido) | Preferencias de presentación persistidas en servidor; dossier/conversación en forma rica (hoy string[]) |
| IA | Frontera AiProvider, adaptador Ollama y doble, memoria factual y evaluación CLI, validación estricta de campos no autorizados (T3-04) | Adaptadores externos, configuración y conexión al juego |
| Generador (Fase 4) | Pipeline 9 etapas, checkpoints, validadores coherencia/conocimiento/contenido/geografía, simulador rutas (cooperación, errores, retrasos, presupuestos), worker/cola PostgreSQL (leases, deduplicación, cancelación, recuperación), import/export JSON versionado, fencing/terminales/reservas/equidad, E2E generar→validar→simular→guardar | Integración con API/UI, proveedores reales |
| Distribución (Fase 6) | Setup/admin, migraciones/health runbooks, backup/restore RPO-RTO, FreeLLMAPI provider, conexiones IA personales, cuotas/corte global, staging/OWASP checks, SLO/capacidad, residencia/retención datos | T6-04 autoría/licencias, T6-05 desastre medido |
| CI | Workflow único con controles de base/seguridad y corpus IA | La ejecución local global no está verde |

El artefacto heredado packages/web/RetroScreen fue conservado durante la integración inicial y se retira en esta continuación al verificar ausencia de manifest/consumidores y tipos inexistentes. Solicitaba CaseDefinition/cooperación privados; no se conecta como sustituto del DTO autorizado. La aplicación y el prototipo vigentes en apps/web se conservan. El commit de main 6298be7 añadió packages/ai-adapters durante la verificación y se incorporó sin perderlo. Coexiste con apps/api/src/ai; no está consumido por la API y requiere consolidación de transporte/configuración y revisión de seguridad antes de conectarse.

## Verificación de la combinación

- Instalación congelada correcta, con versiones fijadas; se eliminó una entrada Vite idéntica duplicada que impedía parsear el lockfile de main.
- Build completo y typecheck del generador correctos.
- 739 pruebas correctas, 56 archivos.
- Lint del módulo IA correcto; corpus determinista de 17 escenarios correcto.
- Smoke HTTP web/proxy/API y escaneo local por patrones correctos.
- Lint global: doce errores heredados de main (api, case-schema), incluidos complejidad y componente no consumido.
- Imports: siete infracciones heredadas (contratos/case-schema y engine con crypto/tests).
- Formato: 22 archivos heredados señalados; no se debilitan sus controles.
- Verificación documental y revisión de diff en el [registro](../quality/INTEGRACION-T3-04.md).

## Fases y próximos pasos

T1 tiene entrega técnica local incorporada con evidencias históricas F1; no se infiere CI remota aprobada. T2 tiene implementación parcial y tareas reabiertas por defectos de reglas/tiempos y calidad. **T3-01/02/03/04/05/06/07/08 completados** (T3-05 ejecutada en la Fase A del 2026-11-05: ambas rutas en navegador, guardar/reanudar y teclado). Fases 4, 5 y 6 (T6-01/02/03, T7-01/02/03/05/06) completadas.

1. Integrar generador (Fase 4) con API/UI para generación de casos de punta a punta.
2. Fase B (producción/registro público) y Fase C (FreeLLMAPI y configuración de proveedor por usuario) según decisión del usuario.

## Arranque vigente

[BASE-LOCAL](../manuales/BASE-LOCAL.md) describe setup:local, compose.yaml para PostgreSQL y db:migrate; API y Vite van en host. Ese procedimiento sustituye las limitaciones antiguas que decían que no había migrador/readiness/sesión.

docker-compose.yml es otro stack heredado que no debe confundirse con compose.yaml ni mezclarse con sus volúmenes. No se modifican secretos, configuración privada, Docker o WSL para integrar esta rama.

## Aclaraciones de producto incorporadas

El usuario confirma cuentas registradas y casos en solitario, con un detective jugador por partida y sin multijugador local/VPS. El primer caso jugable debe incluir autoguardado y guardado manual, ventanas movibles/minimizables y aclaración previa de órdenes ambiguas. Referencias DEC-013/014/015/016 en BASELINE. Se han documentado; todavía no se declaran implementadas.

DEC-017 confirma retroceder cargando un guardado manual del mismo caso. Es una decisión documentada, no una capacidad ya conectada al prototipo; DEC-020 fija el primer resultado definitivo para carrera y reputación.

## Proveedores: alcance aclarado

DEC-018/019: Ollama doméstico; FreeLLMAPI en trabajo/VPS; instalaciones propias con proveedor/endpoint configurable. El VPS ofrecerá proveedor del administrador y claves personales opcionales. Solo están implementados adaptador Ollama, doble y contrato de servicio común; no se declara soporte externo ni almacenamiento de claves por cuenta. La ausencia de Ollama en el trabajo no bloquea programar; la evaluación real espera acceso al proveedor elegido. [Contrato detallado](../specs/IA-proveedores.md).

## Detalle técnico desarrollado, sin nueva implementación

La ampliación documental concreta [API](../specs/API-juego.md), [guardados](../specs/GUARDADOS.md), [conversaciones](../specs/CONVERSACIONES.md) y [68 subcasos de aceptación](../quality/T3-aceptacion-detallada.md). DEC-021 confirma diez manuales por partida, además del autoguardado.

Se fijan DTO públicos sin payload interno, revisión HTTP separada del estado restaurable, ramas, orden de idempotencia, protección del primer resultado y contratos de memoria/ventanas. La suite de producto sigue siendo la última de 146 pruebas; no se ha ejecutado código nuevo ni se declaran aprobados estos 68 escenarios.

El paquete ai-adapters añade fábrica y transporte alternativos, pero no nuevas llamadas activas: el servidor sigue sin importarlo. Resolver duplicidad e invariantes antes de conectar; el build no acredita seguridad ni cobertura de ese paquete.

## Continuación verificada del 2026-10-29

Main 5c58a79 contiene todas las ramas locales y las remotas observadas tras fetch. GitHub mantiene main como rama principal. El desarrollo continúa en codex/t3-02-proyeccion-publica, sin integrar cambios nuevos automáticamente.

La inspección confirma fase 3 parcial y fase 4 pendiente; se rectifican las marcas de completado sin evidencia del backlog. Se sanea la proyección del motor antes de conectar HTTP: solicitudes sin payload/tipo interno, informe oculto en rama activa, copias independientes y contratos públicos sin depender de case-schema. Esto no implementa PlayerViewDto v1 completo ni las rutas/guardados.

Build y tipos correctos; 160 pruebas unitarias/sintéticas correctas en 13 archivos. Tres escenarios nuevos verifican secretos centinela, informe tras restauración y referencias mutables. No se ha ensayado PostgreSQL, proveedor real o navegador en esta continuación. [Evidencia y siguientes pasos](../quality/T3-02-proyeccion.md).

## Persistencia inicial de T3-02

Se añaden al esquema activo tablas runs/run_creations y servicio privado de creación/lectura por sesión. Hay revisión HTTP, rama, idempotencia por usuario, aislamiento de propiedad y rollback atómico. SQL histórico de src/db conservado sin ejecutar. El hash del expediente ahora incluye campos anidados.

Verificados build/tipos, 162 pruebas de suite general y 18 de integración real PostgreSQL en el puerto sintético 15434, separado de la base existente. Las cifras pertenecen a suites distintas, no a cobertura completa del producto. [Alcance, evidencia y límites](../quality/T3-02-persistencia.md). CreateApp todavía no expone estos servicios; faltan DTO completo, rutas, acciones y guardados. T3-02 no se cierra.

## Catálogo y partidas iniciales por HTTP

Se registran cuatro rutas autenticadas: catálogo, detalle de caso, creación y lectura inicial de partida. Origin/CSRF para crear, entrada estricta, 201/200 según primera petición/replay, DTO por allowlist sin estado privado. InitialPlayerViewDto muestra capacidades de guardado deshabilitadas y rechaza estados no iniciales hasta entregar su proyección general; no simula progreso ni expone resultados ocultos.

Verificación de esta entrega: 26 pruebas de integración PostgreSQL/HTTP en tres archivos (18 previas y ocho nuevas), además de la suite general y controles del [registro HTTP](../quality/T3-02-http-inicial.md). No hay integración de UI ni acciones ejecutables todavía. T3-02 sigue en curso; no se avanza a generación.

## Auditoría de 7962014 y continuación de resiliencia

La revisión demuestra cumplimiento parcial. Se corrigen admisión HTTP/DB, readiness, cierre único, telemetría por allowlist, deadline de transporte hostil, límite ocho, preview sin sorteo visible y validación básica de versiones/null/enteros. PostgreSQL perdió realmente el acuse de COMMIT en un proxy sintético; el reintento recuperó la creación única. Un error de cliente adquirido detectado por ese ensayo se corrigió sin ocultar el fallo de query.

Persisten defectos de motor que obligan a reabrir tareas T2: coste de inspección ausente, ordinal global, orden sin suficiencia y rutas que inyectan conocimiento. T3 no se da por terminado y no se habilitan acciones HTTP mientras permanezcan. [Matriz de 90 escenarios, resultados y límites](../quality/AUDITORIA-7962014.md). T3-06 y T3-08 están en curso por sus partes independientes; UI/E2E/proveedor/backup/operación pública siguen pendientes.

## Continuación: motor de ejecución v2

Contador de eventos por partida y cierre coherente por hechos, sin global mutable ni llegada de viaje al vencer. Solicitudes ordenadas por minuto y empate del plazo respetado. La API persiste versión 2 del estado nuevo y conserva lectura estricta de inicios v1 sin modificarlos; progreso antiguo no se interpreta silenciosamente. [Verificación: 207 pruebas generales y 35 PostgreSQL/HTTP](../quality/T2-eventos-plazo-v2.md).

Costes, órdenes, evidencias y rutas completas siguen pendientes; acciones HTTP continúan deshabilitadas. El caso no se declara aceptado ni se avanza a generación.

## Continuación: evidencias y órdenes v3

Se implementan hallazgos físicos/contextuales, procedencia, laboratorio programado (+90), consultas paralelas (+30), órdenes basadas en selección explícita y admisibilidad, y requisitos de presencia/identidad. Ambas rutas del caso se simulan sin insertar pistas en el estado, incluidas variantes que eliminan las pruebas exclusivas de la otra ruta. El motor no consulta la solución para conceder órdenes y limita las solicitudes pendientes a 32. La API crea estados v3 y conserva lectura estricta de inicios v1/v2 sin reescritura.

Esto corrige parte de los hallazgos funcionales de órdenes/rutas, sin cerrar T2-03/04/05/06 ni recalificar toda la matriz BOR. Faltan costes materiales, confirmaciones y lotes completos; ACC-008/009 no se da por aceptado. Continúan pendientes calidad global, DTO de progreso, acciones HTTP, guardados y E2E. El siguiente trabajo es costes/preview/lotes antes de conectar acciones web. Los registros anteriores son instantáneas históricas; [la evidencia v3](../quality/T2-evidencias-ordenes-v3.md) recoge el alcance vigente y las comprobaciones de esta continuación.

## Continuación: costes y confirmaciones v4

Se corrigen costes materiales del caso fijo, confirmación de espera/inspección/detención/recuperación y de lotes costosos. El plazo interrumpe sin aplicar efecto terminal ni resto del lote; reanudar no repite el prefijo. Las rutas naturales acreditan tiempos base A=455/B=485 con semilla 1 y A=482/B=512 con semilla 42, sin cambiar el expediente original. Los inicios antiguos v1/v2/v3 siguen legibles sin reescritura, con nueva ejecución v4.

T2 permanece abierto: lotes de otras acciones/dependencias, extremos de retraso, validación y calidad global aún pendientes. Tampoco están habilitados acciones HTTP, guardados o E2E. La siguiente prioridad es resolver estas fronteras y la calidad antes de conectar progreso web. [Verificación y límites v4](../quality/T2-costes-confirmaciones-v4.md); las notas v2/v3 anteriores son evidencia histórica, no el estado vigente.

## Continuación: validación estructural y puerta de creación

Validador 1.1: tipos anidados, referencias, ciclos de procedencia, posición inicial y límites. La creación inicial usa una copia estable y rechaza expedientes inválidos sin escribir partida/intención; replay autorizado se conserva. Catálogo no confía únicamente en el reporte. Motor sigue v4 y no se modifica el expediente original.

T2-01 permanece en curso por vocabulario NPC/solución, operadores/payloads y solvencia general; calidad global, acciones HTTP, guardados y E2E siguen pendientes. [Verificación actual](../quality/T2-validacion-expedientes.md).

## Continuación: calidad de adaptadores alternativos

Fábrica sin any, mock determinista y limitado a acciones ofrecidas, rechazo de generación ficticia y validación estructural real. Ollama entrega payload decodificado, uso desconocido sin convertirlo en cero y errores normalizados. Tipos públicos de interpretación sin payload privado de solicitudes. Las pruebas del paquete se incluyen ahora en suite general.

No se conecta el paquete a API/UI. T3-04 sigue en curso por codec factual, transporte/políticas comunes y evaluación real. [Verificación vigente](../quality/T3-adaptadores-calidad.md).

## Continuación: motor puro e integridad de servidor

El motor ya no calcula SHA-256 ni importa Node. La API usa @meridiano/case-schema/server y pasa una huella obligatoria sobre la copia estable; mismo hash original y estado v4. Se retira el componente muerto packages/web/RetroScreen sin modificar apps/web ni su prototipo.

Los nuevos controles prohíben importar la entrada de servidor desde motor/raíz pura. No se relajan reglas ni se añade criptografía propia. [Resultados vigentes y pendientes](../quality/T2-motor-puro-integridad.md).

## Continuación: dependencias de lotes v5

Motor v5 incorpora cadena conservadora, dependencias previas verificadas, omisiones transitivas sin coste y confirmación de toda continuación. Conserva prefijo e historial al pausar/reanudar desde estado serializado; metadata incoherente o sobredimensionada falla cerrado. Inicios antiguos v1–v4 legibles sin escritura, progreso preservado/rechazado. No cambian caso/hash originales ni sus tiempos base.

Lotes siguen limitados a inspect/collect/talk; matriz privada no se acepta en la API pública. Pendientes adaptación HTTP, tokens/revisión/rama, guardados y UI. [Verificación actual](../quality/T2-dependencias-lotes-v5.md).

## Continuación: lotes de solicitudes v6

Motor v6 añade análisis, consultas, esperas y órdenes en lote sin duplicar reglas ni esperar implícitamente. Conserva dependencias, pausas y protección del plazo, con validación compartida de selección y contadores seguros. Ambas rutas agrupadas mantienen minutos/hechos/desenlace; inicios v1–v5 permanecen legibles sin escritura, progreso antiguo no se migra.

Viajes/detención/recuperación/cierre/comunicaciones siguen fuera del lote; API/UI/guardados y aceptación completa continúan pendientes. [Verificación vigente](../quality/T2-lotes-solicitudes-v6.md).

## Continuación después del commit c4a86cd: viajes v7

Se registró el checkpoint v6 en el commit autorizado c4a86cd. Después se corrige una secuencia estancada de viajes repetidos: tripCount persistido, preview sin reserva, reanudación determinista y guardas de capacidad. Motor v7, inicios antiguos v1–v6 legibles sin rellenar el contador ni reescribirlos. Cambios nuevos posteriores al commit, sin merge/push.

No se cambia el algoritmo seeded ni hash/seed original; las rutas del caso mantienen costes conocidos. El resto de puertas T2/T3 sigue abierto. [Verificación actual](../quality/T2-secuencia-viajes-v7.md).

## Continuación: máximos y presupuesto temporal v8

El motor v8 produce retrasos de hasta 45 con un mezclador reproducible y muestra ambas rutas con máximos consecutivos en ejecución real de motor: A=545/B=575. Base con semillas 1 y original 42: 455/485. Mismos hechos y resultados individuales/agrupados; plazo exacto impide recuperación terminal y cooperación cero de Lucía no cierra rutas materiales.

Se conservan definición/hash/seed; el cambio temporal queda versionado y no se aplica a progreso antiguo. Inicios v1–v7 legibles sin escritura. [Evidencia vigente](../quality/T2-retrasos-maximos-v8.md). El checkpoint Git sigue siendo c4a86cd (v6); este avance es posterior, sin nuevos commits ni integración.

## Fase A: juego jugable en local (2026-11-05)

Rama `fase-a-jugable-2026-11-05`, mergeada a main local por autorización del usuario (sin push). El juego se puede jugar de principio a fin en local con el proveedor mock, sin modelo real.

- **Persistencia de acciones**: `POST /runs/:runId/action` con `confirm=true` escribe el nuevo estado en `runs` (revisión +1) y un `operation_records` kind `action` en la misma transacción, con replay por idempotencia antes del conflicto de versión; preview no persiste ni registra.
- **Persistencia de cargas**: `POST /runs/:runId/saves/:saveId/load` restaura el snapshot como nueva revisión y nueva rama, sin reescribir la versión interna del motor; partida cerrada rechaza acciones y cargas con 409.
- **Migración 0004**: crea `manual_saves`, `operation_records`, `ai_usage`, `ai_quotas`, `ai_global_cutoff`, `ai_connections` (faltaban en SQL aunque existían en el esquema drizzle) y concede el UPDATE mínimo sobre `runs` a `meridiano_app`.
- **Pantalla de juego** (`/runs/:runId`): vista del jugador (`PlayerViewDto` con `caseId` y `offers` calculadas por el motor en orden de escena), orden en texto libre (interpret → preview → confirmación → commit, con recuperación de commit perdido por replay y retorno de foco), guardados manuales (límite 10, reemplazar, cargar con aviso), mapa/dossier/laboratorio y comunicaciones, ajustes (selector de proveedor deshabilitado: la configuración por usuario es Fase C) e informe final.
- **Ofertas del motor** (`packages/engine/src/offers.ts`): el cliente no inventa acciones; el servidor calcula las disponibles desde definición y estado. Las rutas A y B completas se recorren solo con ofertas.
- **Verificación**: build y typecheck en verde (8 paquetes); unitarios 790/790 (62 archivos, 13 nuevos del cliente de juego); integración PostgreSQL 69/69 (7 archivos, 9 nuevos de persistencia); lint 166 (base de main 169, cero errores nuevos); E2E Playwright (Chromium) 3/3: ruta A 455 min, ruta B 485 min con guardar/reanudar a mitad, y teclado (Enter en ofertas, Escape cierra diálogo/ventanas, Ctrl+Enter envía la orden). La suite E2E completa queda en 13/14: el test del panel de confirmación del prototipo falla también en main (preexistente, fuera de la Fase A).
- **Deuda y decisiones abiertas**: diseño de tokens de `API-juego.md` no implementado (se mantiene el flujo `/action` con `confirm`); dossier/conversación en `string[]` (formas ricas pendientes); reapertura de partida cerrada al cargar (hoy 409); preferencias de servidor `GET /me` + `PATCH /settings` no implementadas (las de presentación son locales); columna `runs.status` solo en drizzle; `scripts/dev/verify-persistence.mjs` sigue exigiendo docker compose (no disponible en esta VM). Visión del usuario: juego público para descargar y jugar en casa con Ollama o LM Studio; el VPS es solo la versión alojada y cada persona configura su LLM. **LM Studio**: hoy NO existe adaptador genérico OpenAI-compatible (proveedores: `ollama` nativo, `freellmapi` OpenAI-compatible, `mock`). El adaptador FreeLLMAPI usa el protocolo `/chat/completions` y podría apuntarse a `http://localhost:1234/v1` con cualquier clave no vacía y el id del modelo local como `context.model`, pero quedaría bajo el id `freellmapi` con `defaultModel: 'gpt-4o-mini'` y un `healthCheck` que exige clave; lo correcto en Fase C es un proveedor genérico `openai-compatible` que reutilice ese código, seleccionable por usuario.
