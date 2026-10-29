# T2: evidencias y órdenes seleccionadas, ejecución v3

Fecha: 2026-10-29. Normativa: commit 7962014ec7031c3694f2378d3983a5e488499239, [resiliencia](../specs/RESILIENCIA.md), [bordes](BORDES-EJECUCION.md), SPEC-001/002/003 y ADR-005. Continuación en worktree existente; sin commit, merge, push ni despliegue.

## Entrega

El motor obtiene evidencias mediante acciones: inspección revela, recogida exige evidencia física visible y presencia, laboratorio entrega a +90, consultas a +30. Enviar no adelanta el reloj; esperar/viajar hace madurar resultados. Se conserva procedencia del primer hallazgo y minuto de recogida; una fuente inadmisible no se blanquea al derivar una prueba.

La orden exige seleccionar evidencias conocidas y únicas. Su selección se copia y se evalúa al madurar; una petición insuficiente se deniega sin cerrar. Concederla no lee la solución. Autoridad de acceso requiere EV-05/08 seleccionada y admisible, aunque otra prueba omitida ya figure en el dossier. Detención exige identidad, ubicación, presencia y orden correspondiente; recuperar exige el original y acceso. Un objeto arbitrario no cumple el objetivo. Las consultas verifican ubicación concreta además de ciudad.

Las solicitudes están acotadas a 32 y no se duplican mientras están pendientes. Payloads internos corruptos y admisibilidad con tipo inválido fallan como error operativo, sin transición ni consecuencias ficticias. El resultado conserva el estado recibido sin mutarlo. Esto cubre un conjunto concreto de bordes, no certifica todo BOR-051 ni los proveedores.

Se separan tipos, reglas fijas, evidencias, solicitudes, órdenes e informe. El dispatcher usa handlers concretos y guardas de propiedades propias, sin repositorios genéricos, capas vacías o dependencia nueva. Todo el motor pasa la regla de complejidad vigente; no se ha rebajado su umbral.

## Versionado

engineVersion=3 identifica el cambio de reglas. Se conservan definición, seed, contentVersion y hash; engineCompatibility=1 es formato del expediente, no versión ejecutable del estado. API persiste v3 en nuevas partidas. Lectura de inicios v1/v2 estrictamente vírgenes sin escribir sobre ellos; progreso antiguo/futuro se conserva y rechaza. No hay migración automática ni acciones HTTP habilitadas.

## Evidencia y método

simulation.test ejecuta las dos rutas encadenando resultados de acciones, sin añadir conocimiento directamente a CaseRun. Incluye semillas sintéticas 1 y 42 y variantes que eliminan evidencias exclusivas de la otra ruta. Las variantes son entradas sintéticas de prueba, no expedientes publicados ni certificados por el generador. Comprueba éxito, error al detener a Tomás con indicios veraces, orden denegada, pérdida por plazo, selección omitida e inadmisibilidad propagada.

Las pruebas de límites de órdenes/solicitudes también emplean estados controlados para corrupción, saturación y entrada irregular. Son pruebas unitarias; no se presentan como rutas de aceptación. El test con una solución que lanza al leerse acredita que solicitud/maduración no la consultan. El test de recuperación irregular prepara una marca: no acredita una acción jugable de entrada forzada.

Verificación de esta continuación:

- Suite general final: 228 pruebas correctas, 21 archivos. Lint de todo packages/engine/src y del adaptador API initial-view correcto, también después de añadir presencia exacta en consultas.
- Integración real PostgreSQL/HTTP: 35 pruebas correctas, cuatro archivos; incluye persistencia v3 y lectura v1/v2 sin reescritura. Proyecto aislado meridiano-cero-t3-persistence-test, puerto 15434, datos sintéticos. No se toca la base preexistente de 15433 ni WSL.
- Tipos completos y build correctos; smoke de web/proxy/API por HTTP real correcto. Escaneo por patrones sin hallazgos, sin equivaler a auditoría exhaustiva de secretos.
- La primera ejecución general bajo sandbox pasó 226 y falló una prueba de fetch HTTP local. Repetida con acceso al servidor loopback autorizado pasó completa (227 antes de añadir la regresión de ubicación). Sin proveedor/modelo real ni descarga.
- Control global separado: cinco errores de lint pendientes (tres en ai-adapters, complejidad del validador y sintaxis del componente RetroScreen no consumido); dos infracciones de dependencia engine→crypto en fuente/dist; formato pendiente en trece archivos heredados. No se ocultan, excluyen ni se declara calidad global aprobada.

Verificación documental: 76 Markdown, enlaces/IDs y grafo válidos, hashes de los DOCX originales intactos. Es integridad documental, no prueba de producto. Se detuvo únicamente el contenedor PostgreSQL sintético de esta entrega, conservando su volumen.

## Límites y continuación

T2-03/04/05/06 continúan abiertas. Faltan costes físicos de inspección (10/20), detención (15), recuperación (20), previews/confirmaciones coherentes y contrato completo de lotes. Los objetivos de 455/485 minutos de SPEC-003 no están acreditados: estas simulaciones demuestran obtención y desenlace, no aceptación temporal ACC-008/009. Falta también ensayar los máximos de retraso.

El API solo sirve la proyección inicial. Sin DTO general, transacciones de acciones, guardados/autoguardado, informe web, carrera oficial, navegación por teclado/E2E, evaluación de IA real ni backup/restore en esta entrega. Las reglas son del caso fijo, no un lenguaje genérico para casos generados. No se declara cumplimiento completo de 7962014, OWASP o del GDD. Siguiente paso: costes/preview/lotes y calidad antes de conectar acciones web.

## Continuación posterior

La [ejecución v4](T2-costes-confirmaciones-v4.md) corrige costes materiales y confirmaciones, y verifica los tiempos base de ambas rutas. Este registro conserva la evidencia y limitaciones históricas de v3.
