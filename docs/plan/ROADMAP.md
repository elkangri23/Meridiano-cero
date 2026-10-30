# Roadmap por hitos verificables

Sin fechas comprometidas. Estimar una fase cuando su spec esté cerrada y se conozca el entorno. Revisión humana al finalizar cada hito. Estado al 2026-10-30: fases 0-5 completadas en código (F1-F5); fase 3 T3-04 en curso (adaptador Ollama); fases 6-7 pendientes. [Detalle de implementación y evidencia](ESTADO.md). La tabla siguiente describe las puertas objetivo, no certifica su aceptación.

| Fase | Resultado demostrable | Dependencias | Puerta de salida |
|---|---|---|---|
| 0 | Requisitos, specs iniciales, ADR, amenazas y caso fijo | GDD/TAD y plan | Enlaces e IDs válidos, todas las secciones GDD trazadas, caso con dos rutas calculadas |
| 1 | Base web/API y PostgreSQL reproducible | 0; SPEC-004 y SPEC-009 cerradas para base | Arranque limpio, health/readiness, migración y reinicio con datos; CI |
| 2 | Motor ejecutable sin red, IA ni UI | 1; SPEC-001/002/003 | Rutas alternativas, pérdida, reloj, lotes y eventos comprobados |
| 3 | Un caso completo en navegador con IA configurable | 2; SPEC-004/005/006 cerradas para hito | Conversar, investigar, viajar, analizar, detener, cerrar y reanudar; teclado |
| 4 | Generación persistente e intercambio | 3; SPEC-007 | Generar → validar → simular → guardar; rechazo/cancelación/importación seguras |
| 5 | Funciones completas del GDD y acabado | 4; SPEC-006/008 ampliadas | Matriz funcional v1 cubierta, accesibilidad y evaluación de modelos |
| 6 | Distribución independiente | 5; SPEC-009 final | Instalación ajena, proveedor propio, actualización y restauración |
| 7 | Instancia pública gratuita | 6; SPEC-010 final | Registro, IA servidor, consumo acotado, recuperación, controles OWASP y operación |

## Entrega incremental

Fase 1 no crea worker vacío ni paquetes sin consumidor. Fase 2 utiliza un fixture local; fase 3 añade IA solo a interpretación y narración. Fase 4 utiliza el mismo contrato de expediente para la generación. La seguridad y accesibilidad se entregan por tarea, no al final.

Las tareas preparadas de fases 1–3 están en [BACKLOG](BACKLOG.md). Las fases posteriores ya tienen desglose T4–T7; sus specs detalladas son propuestas y deben cerrarse con pruebas de entorno y decisiones indicadas antes de implementar. Todas siguen pendientes.

## Demostración de cada hito

Entregar alcance realizado, requisitos/pruebas, comandos y resultados, limitaciones, riesgos abiertos y siguiente conjunto de tareas. No marcar un hito aceptado por superar únicamente CI. Mantener el registro en quality con la [plantilla de evidencia](../templates/evidencia.md).

## Bloqueos de lanzamiento

Puertas adicionales de la revisión de bordes: fase 3 exige T3-06/T3-07/T3-08 junto a T3-05; fase 4 exige T4-07 junto a T4-06; fase 5 exige T5-07 junto a T5-06; fase 6 exige T6-05 junto a T6-04; fase 7 exige T7-05/T7-06 junto a T7-04. No constituyen fases nuevas ni implementación entregada. El [catálogo de bordes](../quality/BORDES-EJECUCION.md) concreta sus pruebas; las dependencias del backlog impiden cerrar el hito solo con su prueba feliz.

Ningún hallazgo crítico/alto aplicable abierto; restauración probada; autoría/licencias y privacidad resueltas; endpoint público de IA verificado; costes y corte global ensayados. No publicar repositorio ni desplegar VPS como efecto lateral de cerrar documentación.

## Revisión tras auditoría normativa

La [auditoría de 7962014](../quality/AUDITORIA-7962014.md) reabre verificación funcional de fase 2 y calidad de base; no es solo lint pendiente. No avanzar a fase 4 ni habilitar acciones web antes de corregir costes/reglas/ordinales y probar rutas completas. Los avances de catálogo/partidas iniciales y resiliencia se conservan como entregas parciales de fase 3. Los estados actuales prevalecen sobre las marcas históricas de completado.

## Continuación: evidencias y órdenes v3

Se implementan hallazgos físicos/contextuales, procedencia, laboratorio programado (+90), consultas paralelas (+30), órdenes basadas en selección explícita y admisibilidad, y requisitos de presencia/identidad. Ambas rutas del caso se simulan sin insertar pistas en el estado, incluidas variantes que eliminan las pruebas exclusivas de la otra ruta. El motor no consulta la solución para conceder órdenes y limita las solicitudes pendientes a 32. La API crea estados v3 y conserva lectura estricta de inicios v1/v2 sin reescritura.

Esto corrige parte de los hallazgos funcionales de órdenes/rutas, sin cerrar T2-03/04/05/06 ni recalificar toda la matriz BOR. Faltan costes materiales, confirmaciones y lotes completos; ACC-008/009 no se da por aceptado. Continúan pendientes calidad global, DTO de progreso, acciones HTTP, guardados y E2E. El siguiente trabajo es costes/preview/lotes antes de conectar acciones web. Los registros anteriores son instantáneas históricas; [la evidencia v3](../quality/T2-evidencias-ordenes-v3.md) recoge el alcance vigente y las comprobaciones de esta continuación.

## Continuación: costes y confirmaciones v4

Se corrigen costes materiales del caso fijo, confirmación de espera/inspección/detención/recuperación y de lotes costosos. El plazo interrumpe sin aplicar efecto terminal ni resto del lote; reanudar no repite el prefijo. Las rutas naturales acreditan tiempos base A=455/B=485 con semilla 1 y A=482/B=512 con semilla 42, sin cambiar el expediente original. Los inicios antiguos v1/v2/v3 siguen legibles sin reescritura, con nueva ejecución v4.

T2 permanece abierto: lotes de otras acciones/dependencias, extremos de retraso, validación y calidad global aún pendientes. Tampoco están habilitados acciones HTTP, guardados o E2E. La siguiente prioridad es resolver estas fronteras y la calidad antes de conectar progreso web. [Verificación y límites v4](../quality/T2-costes-confirmaciones-v4.md); las notas v2/v3 anteriores son evidencia histórica, no el estado vigente.

## Continuación: validación estructural y puerta de creación

T2-01 amplía validación de campos anidados, referencias, ciclos de procedencia, posición inicial y límites. Se elimina la complejidad 71 del validador, manteniendo máximo diez mediante responsabilidades usadas. Creación nueva valida una copia estable del expediente; rechaza sin partida/intención, conservando replay autorizado antes de disponibilidad. No cambia motor v4, contenido/hash del fixture ni datos guardados.

La tarea sigue en curso: faltan vocabulario/referencias NPC y solución, operadores/payloads declarativos y solvencia general. No se cierra calidad global ni se habilitan acciones HTTP o importación. [Resultados y límites de esta continuación](../quality/T2-validacion-expedientes.md).

## Continuación de calidad transversal IA

Se sanea el paquete alternativo con fábrica validada, mock determinista y salida Ollama decodificada, sin activarlo en el juego. Permanecen las puertas de calidad global, integración factual y evaluación real; no se avanza de fase por superar tests sintéticos. [Evidencia](../quality/T3-adaptadores-calidad.md).

## Continuación: integridad fuera del motor y retirada de código muerto

Se mueve hashDefinition a la entrada exclusiva de servidor de case-schema; el motor recibe huella preparada, valida forma y deja de depender de Node crypto. Se conserva el hash previo del fixture y engineVersion=4, sin migrar registros. Se añaden reglas que impiden reintroducir la entrada de servidor en el motor/raíz pura. Tipos Node ya fijados se declaran como dependencia de desarrollo de case-schema, sin biblioteca de ejecución nueva.

Se retira RetroScreen obsoleto tras comprobar que no tiene manifest/consumidores y que importa tipos inexistentes/datos privados. Apps/web y /prototype no cambian; no se conecta el componente ni se excluye código para ocultar errores. [Verificación y límites](../quality/T2-motor-puro-integridad.md). No se cierran T1-04/T2/T3 por esta limpieza: formato histórico, funcionalidades y aceptación pendientes conservan sus puertas.

## Continuación: dependencias y reanudación de lotes v5

T2-03: matriz interna de dependencias previas, cadena conservadora por defecto, omisiones transitivas sin coste y preview obligatorio para continuar incluso con cero minutos. Se validan acciones/params, grafo y coherencia del snapshot, con lectura acotada de metadata. Historial aplicado/fallido/omitido no se reintenta; nuevas imposibilidades pausan y el plazo descarta el resto.

Se registra motor v5; los inicios vírgenes v1–v4 se leen sin modificar, y el progreso antiguo se preserva/rechaza. Caso y hash originales, costes y rutas individuales se conservan. Siguen pendientes otros tipos de lote, adaptación API/UI, guardados y puertas de calidad/aceptación. [Resultados y límites](../quality/T2-dependencias-lotes-v5.md). No se marca completada T2 por esta entrega parcial.

## Continuación: lotes de solicitudes y esperas v6

T2-03/04/05: lotes admiten analyze/query/wait/request_warrant mediante los mismos resolutores individuales. No hay espera implícita; dependencias representan pasos enviados/aplicados, no resultados disponibles. Pausa, continuación confirmada, cuotas internas y plazo se conservan; selección de evidencias comparte validación y los contadores fallan cerrado ante invalidez/desbordamiento.

Motor v6; inicios v1–v5 legibles sin modificar y progreso antiguo preservado/rechazado. Las dos rutas en lotes conservan tiempos y hechos de las versiones individuales. T2 permanece abierto por otros tipos de lote, retrasos máximos, vocabulario/reglas y aceptación; API/UI/guardados aún pendientes. [Evidencia v6](../quality/T2-lotes-solicitudes-v6.md).

## Continuación: secuencia persistida de viajes v7

Tras el commit autorizado c4a86cd (checkpoint v6), T2-04 corrige el índice de retrasos: tripCount persistido sustituye el recuento de destinos distintos, que se estancaba al repetir ciudades. Preview/ruta imposible no consumen índice; serialización conserva secuencia. Se cuentan salidas confirmadas incluso si el plazo interrumpe, sin llegada indebida.

Motor v7; inicios v1–v6 legibles en su forma histórica sin reescritura, progreso anterior preservado/rechazado. No cambian función seeded, seed/hash del caso ni tiempos de las rutas A/B. El trabajo posterior al checkpoint queda separado del commit anterior. [Evidencia y límites](../quality/T2-secuencia-viajes-v7.md). Otros lotes, retrasos máximos, reglas/vocabularios, API/UI/guardados y aceptación siguen pendientes.

## Continuación: máximos de retraso y rutas v8

T2-04/06: se corrige la mezcla seeded para alcanzar 45 minutos y permitir máximos consecutivos. Variante sintética normal seed=14194 verifica rutas independientes A=545/B=575; semillas 1/42, base 455/485. Se prueban lotes equivalentes, plazo exacto y negativa de Lucía sin softlock, sin modificar duraciones ni inyectar conocimiento.

Motor v8 mantiene hash/seed originales, pero cambia resultados temporales por versión. Inicios v1–v7 legibles sin escritura; progreso previo se conserva/rechaza. ACC-008/009 tienen evidencia de motor, E2E pendiente. T2 sigue abierto por otros lotes, reglas/vocabularios y puertas globales; no se declara fase completada. [Verificación y límites](../quality/T2-retrasos-maximos-v8.md).

## Continuación T3-06: localizador de creación

Implementado POST /api/v1/run-creations/lookup: clave original en cuerpo cerrado, sesión revalidada en transacción, Origin/CSRF y propiedad actual. Devuelve solo metadatos de creación confirmada. Un 404 puede ser provisional y nunca autoriza una nueva clave. Siete pruebas de integración adicionales incluyen barreras reales de creación en vuelo y revocación; 45 PostgreSQL/HTTP en total. [Contrato, evidencia y límites](../quality/T3-06-localizador-creacion.md).

T3-06 permanece en curso: faltan operaciones de acciones, guardados/cierre, retención/purga y recuperación conectada de UI. No se habilitan acciones HTTP ni se declara la fase 3 completada.

## Continuación T2: intervenciones en lotes v9

Detain/recover se incorporan al vocabulario interno de secuencias con parámetros cerrados, usando los resolutores individuales y sus costes/permisos. Preview sin efectos, pausa/continuación sin duplicar prefijo y plazo exacto conservados. Las rutas A/B agrupan la intervención final, con semillas base y retrasos máximos. Inicios v1–v8 legibles sin escritura; progreso anterior conservado/rechazado. [Pruebas y límites](../quality/T2-intervenciones-lotes-v9.md).

No cierra T2/T3: quedan otros tipos de lote, reglas/vocabularios y aceptación; API de acciones, guardados y UI conectada siguen pendientes.

## Continuación T2: viajes en lotes v10

Travel se incorpora con parámetros cerrados y el mismo resolutor individual. Preview/continuación usan duración base sin leer seed; la confirmación aplica retrasos reales y revalida pasos. Pausa/serialización no repiten viajes ni índices; el plazo impide llegada y resto. Rutas A/B agrupan el desplazamiento inicial e intervención final. Inicios v1–v9 legibles sin escritura; progreso previo conservado/rechazado. [Evidencia y límites](../quality/T2-viajes-lotes-v10.md).

T2/T3 siguen abiertos: cierre/comunicaciones en lotes, reglas/vocabularios y aceptación; acciones HTTP, proyección de progreso, guardados y UI conectada siguen pendientes.

## Continuación T2: cierre confirmado en lotes v11

Finish interno admite solo params vacío; preview siempre exige confirmación si alcanzaría el cierre, incluso sin coste, sin informe prospectivo. Confirmar usa el cierre individual y termina la secuencia sin efectos posteriores; pausa/dependencias/cancelación y prioridad del plazo verificadas. Rutas A/B incluyen cierre agrupado. Inicios v1–v10 legibles sin escritura, progreso previo conservado/rechazado. [Evidencia y límites](../quality/T2-cierre-lotes-v11.md).

T2/T3 siguen abiertos por comunicaciones en lote, reglas/vocabularios y aceptación, API de acciones, proyección de progreso, guardados y UI. Primer resultado oficial y carrera no se implementan dentro del motor.

## Continuación T2: comunicaciones simuladas v12

Communicate individual/en lote usa parámetros cerrados y contacto interno conocido; envío gratuito, copia privada, cupo/duplicados y acuse neutral a +30 del reloj interno. No interpreta texto ni inventa resultados factuales. Snapshot acotado a 32768 unidades UTF-16 por paso para admitir texto de 4000 escapado; ocho pasos y demás validaciones se conservan. Inicios v1–v11 legibles sin escritura; progreso anterior conservado/rechazado. [Evidencia y límites](../quality/T2-comunicaciones-v12.md).

El vocabulario interno de lotes admite los tipos de acción iniciales, pero no implica cierre de T2/T3: comunicaciones factuales/equipo, reglas/expedientes y aceptación siguen pendientes, además de API de acciones, guardados y UI.

## Continuación T2-01: navegabilidad estructural 1.2

Se rechazan ciudades sin lugar accesible o inalcanzables desde el inicio por rutas dirigidas válidas; sin inferir inversas ni exigir retorno. Cola iterativa acotada y errores sin datos privados. Nueva creación usa la puerta existente, conserva replay previo autorizado y no crea filas para mapas inválidos. Validador 1.2.0, motor v12 y hash original sin cambios. [Pruebas y límites](../quality/T2-navegabilidad-mapa.md).

T2-01 sigue en curso por referencias de conocimientos/solución, vocabulario declarativo y solvencia. Conectividad no acredita rutas de investigación ni aceptación del caso. No se habilitan acciones HTTP, guardados o generador.

## Continuación T2-01: referencias estructurales 1.3

Facts exige IDs únicos y knowledge apunta a ellos sin duplicados. Solución general referencia NPC existente. El original conserva excepción explícita de tokens/aliases históricos, compartiendo perfil de sospechosos entre validador y motor, sin reinterpretar nombres o reescribir hash. Nuevas intenciones inválidas no crean filas; replay previo autorizado conservado. Validador 1.3.0, motor v12 sin cambio semántico. [Pruebas y límites](../quality/T2-referencias-conocimiento.md).

T2-01 sigue abierto por condiciones de conocimiento/conversación, reglas/payloads declarativos y solvencia. La compatibilidad legada no equivale a validar todo ese modelo ni habilita API/UI/guardados o generador.

## Continuación T2: permiso de testimonio v13

Se corrige la revelación EV-09 de Lucía: exige conocimiento declarado tomas-moved-box además de tema/cooperación/presencia. Retirar conocimiento no conserva prueba, admisibilidad o procedencia. Identificación propia presencial permanece separada. Rutas A/B sin conocimiento/cooperación de Lucía mantienen máximos 545/575 sin pistas inyectadas. Motor v13, inicios v1–v12 legibles sin escritura y progreso antiguo conservado/rechazado. [Evidencia y límites](../quality/T2-permisos-testimonio-v13.md).

T2/T3 siguen abiertos por política completa de conversación, reglas/payloads y solvencia/aceptación, además de API de acciones, guardados y UI conectada.

## Continuación T2-01: contenido ejecutable reconocido 1.4

Rules acepta solo manifiesto original completo para Astrolabio; otros casos solo rules vacío hasta disponer de formato ejecutable. ScheduledResults inicial no vacío se rechaza porque el motor lo ignoraba; solicitudes creadas por acciones se conservan. CASE_NOT_READY sin filas nuevas y replay propio previo preservado. Validador 1.4.0, motor v13 y hash original sin cambios. [Evidencia y límites](../quality/T2-contenido-ejecutable.md).

T2-01 sigue abierto: no DSL o programación inicial implementados ni solvencia acreditada por este manifiesto. Se mantienen en alcance reglas/políticas generales y aceptación, API/guardados/UI y generador posteriores.

## Continuación T3-02: lista de partidas propias

GET /api/v1/runs añade metadata propia paginada y filtro active/closed, con sesión revalidada, cursor ligado a cuenta/filtro y keyset sin perder microsegundos. Ancla/página en una consulta; sin estado privado ni escritura. Nueve pruebas PostgreSQL/HTTP cubren aislamiento, paginación y revocación real. [Evidencia y límites](../quality/T3-02-lista-partidas.md).

T3-02 sigue en curso; no habilita acciones, proyección de progreso, guardados o UI por adelantado. T2 mantiene sus pendientes. Motor v13 y validador 1.4 sin cambios.

## Continuación T3-03: archivo conectado

La raíz web consulta sesión y archivo reales, con entrada local explícita dev, filtros/páginas, estados vacíos/error y logout. DTO validado, cuenta vinculada a cada página, CSRF en memoria y descarte de respuestas tardías. Diseño MS-DOS y revisión de escritorio/móvil/teclado con datos sintéticos. [Evidencia y límites](../quality/T3-03-archivo-conectado.md).

T3-03 permanece en curso. T3-07 inicia trabajo parcial de estados/cancelación del archivo, sin cerrar dependencias o recuperación de acciones. No investigación completa, ventanas, guardados o registro público anticipados. T2 y motor v13/validador 1.4 conservan su alcance.

## Continuación T3: creación web recuperable

Catálogo público y selección explícita crean partida desde el archivo. Localizador mínimo validado en sessionStorage por cuenta/pestaña, sin credenciales; lookup confirma resultado, 404/error conserva referencia y reintento explícito usa mismo caso/clave. Precondición de cuenta verificada en SQL para impedir mutación bajo otra cuenta. [Evidencia y límites](../quality/T3-creacion-web-recuperable.md).

Ensayo de navegador con acuse/primer lookup perdidos, recarga y comprobación: un POST, dos lookups y una única partida real sintética. T3-03/06/07 siguen abiertos por progreso, acciones, guardados y reconciliación completa. Motor v13/validador 1.4 sin cambios.


## Continuación T3: ficha inicial conectada

El archivo permite consultar por GET una partida propia en su estado inicial: reloj/plazo, ubicación y ciudades visibles. Decoder público cerrado rechaza progreso, replay de creación, datos privados y otra referencia. Cerrar/cancelar, logout y cambio de filtro descartan respuestas tardías; las consultas no mutan ni avanzan el reloj. [Evidencia y límites](../quality/T3-ficha-inicial-conectada.md).

T3-03/T3-07 siguen en curso: la lectura inicial no equivale a reanudar progreso ni a investigar. Motor v13/validador 1.4 y fixture sin cambios. Revisión manual específica de esta ficha y juego completo pendientes.


## Continuación T2-01: formato cerrado 1.5

Se rechazan campos adicionales o ausentes en raíz, entidades y reporte, evitando aprobar políticas/efectos que el motor ignora. Errores sin claves/valores privados; creación nueva inválida sin filas y replay propio previo conservado. [Evidencia y límites](../quality/T2-formato-cerrado.md).

Validador 1.5.0, motor v13 y original/hash sin cambios. No implementa DSL, condiciones NPC o solvencia. T2-01 y tareas de integración T3 permanecen abiertas.


## Continuación T2-05: cierre individual v14

finish individual exige params vacío; resolve devuelve preview sin efectos y solo confirmAction cierra. confirmed/result u otros campos no sustituyen aprobación. Lotes usan el mismo cierre de dominio sin fabricar flags. Inicios v1–v13 legibles sin escritura; progreso previo preservado/rechazado. [Evidencia y límites](../quality/T2-cierre-individual-v14.md).

Motor v14, validador 1.5 y original/hash sin cambios. T2/T3 siguen abiertos por reglas y aceptación, acciones HTTP, proyección de progreso y guardados.
