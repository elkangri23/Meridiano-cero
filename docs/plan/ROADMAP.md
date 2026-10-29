# Roadmap por hitos verificables

Sin fechas comprometidas. Estimar una fase cuando su spec esté cerrada y se conozca el entorno. Revisión humana al finalizar cada hito. Estado al 2026-10-29: fase 0 entregada; fase 1 con entrega técnica local incorporada, con controles globales pendientes según el registro de integración; motor de fase 2 parcial, reabierto por defectos funcionales y calidad global; fase 3 en curso por anticipación autorizada; fases 4–7 pendientes. [Detalle de implementación y evidencia](ESTADO.md). La tabla siguiente describe las puertas objetivo, no certifica su aceptación.

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
