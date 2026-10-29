# T2-01: formato cerrado del expediente, validador 1.5

Fecha: 2026-10-29. Continuación en el worktree existente. Referencias: SPEC-002/012, CONVERSACIONES, ADR-003 y estándares del commit 7962014ec7031c3694f2378d3983a5e488499239. Sin commits, merges, push ni despliegue.

## Problema y alcance

El validador verificaba campos conocidos, pero aceptaba campos adicionales en raíz, entidades y reporte. Un expediente podía declarar disclosureRules u otra política que el motor no consume y aun recibir aprobación estructural. Esto no implementaba la política y podía producir una falsa expectativa de condiciones o restricciones activas.

Se cierra el formato 1 a los campos de los tipos actuales. No se eliminan campos antes de validar ni se interpretan extensiones. Una nueva política de conversación, condición, efecto o metadato requiere contrato versionado, validación y consumidor real antes de admitirse. Este cambio no implementa la política general pendiente ni elimina esa funcionalidad del alcance.

## Implementación

validation-shape es una responsabilidad estructural dentro de case-schema, sin dependencias nuevas. validateCaseDefinition la ejecuta tras obtener las colecciones acotadas y antes de validar entidades/referencias. Se comparan conjuntos exactos de campos propios enumerables mediante ordenación; el orden de las propiedades JSON no determina validez.

Las listas de campos se comprueban para la raíz, ciudades, lugares, NPC, evidencias, objetivos, rutas, resultados programados y validationReport. Los validadores existentes mantienen tipos, límites, unicidad, referencias y semántica. Las claves obligatorias ausentes también fallan; una clave desconocida no se considera una alternativa a otra que falta. Los errores solo identifican un ámbito constante, sin copiar el nombre del campo suministrado ni su valor privado.

scheduledResults inicial no vacío sigue rechazado aunque su forma sea correcta: reconocer sus cuatro campos no habilita programación inicial. La propiedad JSON __proto__ se trata como clave desconocida; no se mezcla con objetos del runtime. La prueba cubre datos JSON sintéticos, no atribuye protección general frente a objetos JS con getters, proxies o código ejecutado fuera de la importación.

## Integración de creación y compatibilidad

La creación usa la puerta ya existente sobre una copia estable. Una intención nueva con campos no soportados devuelve CASE_NOT_READY y no crea runs ni run_creations. Un replay propio confirmado conserva prioridad: la definición actual inválida no oculta la partida que esa intención ya creó. No se cambia propiedad, autorización, sesión, transacción o permisos de DB.

La extensión sintética BigInt usada en una prueba anterior ahora falla antes del hash por campo desconocido y devuelve CASE_NOT_READY. Se actualiza esa expectativa en vez de seguir afirmando un fallo de hash inalcanzable para ese objeto. Conserva la comprobación de replay y ausencia de escrituras. La evidencia anterior describe el comportamiento histórico de 1.4; no se reescribe.

Validador 1.5.0 y escenario structural. Motor v13, schemaVersion=1, engineCompatibility=1 y contenido del fixture sin cambios. Se conserva el reporte histórico incluido en el fixture; no se sustituye su versión por la del validador en ejecución. Hash, seed y Word originales permanecen intactos. Partidas persistidas no se migran ni reescriben y el GET inicial no vuelve a aprobar datos cambiados.

## Pruebas y límites

Dieciocho escenarios generales nuevos: original sin mutación y con hash idéntico, propiedades reordenadas, cuatro extensiones raíz, seis colecciones de entidades, política NPC plausible sin soporte, tres ausencias obligatorias, reporte extendido propiedad JSON __proto__ y colisiones de nombres con coma. El reporte generado sigue atribuyendo únicamente validación structural.

Una prueba PostgreSQL adicional comprueba tres variantes desconocidas, rechazo sin intención persistida, recuento de partidas inalterado y replay de creación previa. Las pruebas anteriores de mapa, conocimientos, contenido, rutas A/B y permisos se conservan. No hay nuevas transiciones de motor ni cambios visuales que requieran prueba de navegador en esta entrega.

T2-01 sigue en curso: faltan políticas NPC completas, vocabulario declarativo con ejecución y solvencia general. T3 mantiene pendientes acciones HTTP, proyección de progreso, guardados y juego conectado. El formato cerrado no demuestra solvencia ni cumplimiento OWASP/ASVS. Continúan las ocho incidencias históricas de formato.


## Verificación ejecutada

- Suite general: 596 pruebas en 39 archivos; dieciocho escenarios nuevos del formato cerrado.
- Integración PostgreSQL/HTTP: 60 pruebas en seis archivos; una prueba adicional de rechazo sin filas y replay confirmado.
- Tipos, lint y límites de imports correctos; 171 módulos y 490 relaciones, sin cambiar umbrales de complejidad.
- Compilación, smoke de web/proxy/API por HTTP loopback y escaneo local de secretos correctos. Sin proveedor o modelo real.
- Integridad documental: 98 Markdown, enlaces y referencias válidos, grafo acíclico y hashes de Word intactos. No prueba comportamiento ni cumplimiento de controles de seguridad.
- git diff --check correcto. check:format sigue fallando en los ocho archivos históricos, sin nuevas incidencias de esta entrega ni relajación del comprobador.

Solo se inició y detuvo la base sintética de 15434, conservando volumen. No se modifican base de 15433, credenciales, originales o WSL. Las verificaciones automatizadas no sustituyen aceptación integral del juego ni revisión manual de navegador.
