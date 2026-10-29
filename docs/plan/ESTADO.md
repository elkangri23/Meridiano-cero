# Estado integrado del proyecto

Estado vigente de la continuación: motor v6 con lotes de análisis, consultas, esperas y órdenes; integridad de servidor y validador 1.1. Pasan lint/imports globales, 384 pruebas generales y 38 PostgreSQL/HTTP. Formato histórico y aceptación funcional completa siguen pendientes; no hay primer caso conectado en navegador. [Última evidencia y límites](../quality/T2-lotes-solicitudes-v6.md). Las cifras de integración inicial que siguen son históricas.

Actualizado: 2026-10-29. Combinación de main 6298be7 (incluye la base 6f43ba2) y codex/t3-04-integracion-ia 3a28abd, preparada en worktree separado para integrar en main. [Evidencia de integración](../quality/INTEGRACION-T3-04.md). Las instantáneas previas de T1/T3 conservan su alcance histórico.

El [backlog](BACKLOG.md) conserva dependencias; este documento refleja código y verificaciones de la combinación, sin declarar el juego terminado.

## Implementación disponible

| Área | Disponible | Pendiente |
|---|---|---|
| Base | Seis proyectos de producto más la raíz pnpm | No distribución del juego completa |
| API | Health/readiness, sesión local, catálogo y creación/lectura inicial de partidas | Preview/commit, lista de partidas, reportes y guardados |
| DB | Migrador activo, roles locales, partidas y ledger de creación transaccional | Operaciones de acciones, manuales y primer resultado; src/db conservado como histórico no activo |
| Motor | Ejecución v6: evidencias/órdenes, costes, rutas y lotes dependientes con solicitudes/esperas | Lotes de viaje/intervención/cierre/comunicaciones, dependencias en API, extremos de retraso y reglas genéricas |
| Expediente | Validador estructural 1.1 y referencias/ciclos; creación valida copia estable | Referencias NPC/solución, operadores/payloads y solvencia general |
| UI | Prototipo de desarrollo en /prototype | Flujo conectado, ventanas, manuales, preferencias persistidas y revisión accesible |
| IA | Frontera AiProvider, adaptador Ollama y doble, memoria factual y evaluación CLI | Adaptadores externos, configuración y conexión al juego |
| CI | Workflow único con controles de base/seguridad y corpus IA | La ejecución local global no está verde |

El artefacto heredado packages/web/RetroScreen fue conservado durante la integración inicial y se retira en esta continuación al verificar ausencia de manifest/consumidores y tipos inexistentes. Solicitaba CaseDefinition/cooperación privados; no se conecta como sustituto del DTO autorizado. La aplicación y el prototipo vigentes en apps/web se conservan. El commit de main 6298be7 añadió packages/ai-adapters durante la verificación y se incorporó sin perderlo. Coexiste con apps/api/src/ai; no está consumido por la API y requiere consolidación de transporte/configuración y revisión de seguridad antes de conectarse.

## Verificación de la combinación

- Instalación congelada correcta, con versiones fijadas; se eliminó una entrada Vite idéntica duplicada que impedía parsear el lockfile de main.
- Build completo y typecheck completo correctos.
- 157 pruebas correctas, doce archivos, sin integración PostgreSQL real en esta ejecución.
- Lint del módulo IA correcto; corpus determinista de 17 escenarios correcto.
- Smoke HTTP web/proxy/API y escaneo local por patrones correctos.
- Lint global: doce errores heredados de main, incluidos complejidad y componente no consumido.
- Imports: siete infracciones heredadas (contratos/case-schema y engine con crypto/tests).
- Formato: 22 archivos heredados señalados; no se debilitan sus controles.
- Verificación documental y revisión de diff en el [registro](../quality/INTEGRACION-T3-04.md).

Las 146 pruebas del avance T3-04 y las 71 de main son referencias previas; la combinación tiene 157, no la suma de ambas porque comparten pruebas. Los 68 subcasos detallados siguen siendo escenarios previstos hasta ejecutarse y mapear evidencia.

## Fases y próximos pasos

T1 tiene entrega técnica local incorporada con evidencias históricas F1; no se infiere CI remota aprobada. T2 tiene implementación parcial y tareas reabiertas por defectos de reglas/tiempos y calidad. T3-01/02/03/04 están en curso; T3-05 espera E2E/modelo real. Fases 4–7 pendientes.

1. Completar validación, lotes y extremos de retraso del motor; cerrar calidad global antes de habilitar acciones HTTP. Costes, ordinales y tiempos base de rutas ya están comprobados en v4.
2. Ampliar el DTO inicial y API-juego: preview/commit, operaciones, transiciones y proyección de resultados; la creación inicial ya tiene ownership, rama e idempotencia.
3. Conectar guardados/manuales, política NPC y UI, manteniendo el primer resultado oficial.
4. Evaluar el proveedor real disponible cuando haya acceso, sin exigir Ollama en trabajo/VPS.
5. Ejecutar ambas rutas en navegador, reanudación y teclado conforme al catálogo detallado.

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
