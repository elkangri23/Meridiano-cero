# Motor puro, integridad de servidor y retirada de código muerto

Fecha: 2026-10-29. Referencia: commit 7962014ec7031c3694f2378d3983a5e488499239, SPEC-001/002/012, ADR-002/003 y T1-04/T2-01. Continuación en worktree existente, sin commits, merge, push o despliegue.

## Cambios y límites de responsabilidad

El SHA-256 y la canonicalización existentes se trasladan sin cambios a @meridiano/case-schema/server. El motor deja de importar Node y no reexporta hashing. Su creación exige una huella hexadecimal preparada por el servidor, valida forma y falla con DEFINITION_HASH_INVALID si falta o es inválida. No intenta acreditar la correspondencia criptográfica solo por recibir un string: servicio y proyección comparan la huella calculada sobre la misma definición estable. La API no acepta una huella del jugador como autoridad.

API prepara una sola huella fuera de la espera/bloqueo SQL y reutiliza valor para fila/estado. Si esa preparación falla, se conserva la posibilidad de replay autorizado: la recuperación de la intención anterior precede a exigir una huella actual disponible. Una intención nueva falla con DEPENDENCY_UNAVAILABLE, sin escribir partida/ledger. Este fallo es operativo, no una consecuencia del mundo. Se actualizan sus consumidores y pruebas. El esquema persistido, engineVersion=4 y los inicios legibles v1/v2/v3 permanecen iguales; no hay migración ni escritura sobre datos históricos.

Se añade entrada de servidor al paquete ya consumido, sin crear paquete/capa genérica ni implementar criptografía propia. @types/node 24.19.2 ya estaba fijado en el workspace; ahora se declara explícitamente como devDependency de case-schema. Lockfile actualizado offline/sin scripts, sin biblioteca runtime ni actualización de versiones. La raíz de case-schema no importa/reexporta esa entrada. Dos reglas adicionales bloquean su importación desde motor y raíz pura, manteniendo la regla engine-pure anterior.

Se retira packages/web/src/components/RetroScreen.tsx, único archivo de un directorio sin manifest, sin consumidores en apps/packages/scripts y con import de tipos inexistente. Además esperaba definición secreta/cooperación privada. Es retirada de código muerto, no una excepción de lint ni una sustitución de interfaz. Apps/web y su prototipo de desarrollo no cambian. La historia Git y los registros de auditoría previos conservan la evidencia; no se alteran docs/meridi ni originales Word.

## Comprobaciones

Hash original obtenido antes de mover código: 4dc888c2bf4e2e3b5bbecda1876353552cf5c79989f5cfd92571c146d9db505f. Una regresión fija ese valor para el mismo fixture, confirma estado v4 y conserva las comprobaciones de cambios anidados, orden de arrays y reporte volátil. Cinco entradas de huella mal formada se rechazan sin estado nuevo. Las rutas naturales y sus costes siguen en la suite general.

- Suite general: 327 pruebas correctas en 24 archivos, con seis regresiones nuevas de huella/compatibilidad y ambas rutas conservadas.
- Lint global e imports correctos, sin relajar reglas: cero infracciones de dependencia en 130 módulos y 327 relaciones analizadas. Se mantienen las guardas web/servidor/contratos y se añaden dos de integridad.
- Tipos y build completos correctos. Integración final PostgreSQL/HTTP: 38 pruebas correctas en cuatro archivos, incluida recuperación autorizada ante contenido actual no serializable y rechazo operativo de una intención nueva sin partida/ledger. Build focal de API repetido tras ese ajuste.
- Lockfile actualizado offline/sin scripts, tipos Node ya fijados reutilizados. No se incorporó otra biblioteca de ejecución.
- Smoke HTTP de página/TSX/proxy API correcto; escaneo por patrones sin hallazgos.
- El checker de formato detectó inicialmente ENOENT por intentar leer un archivo borrado aún presente en el índice Git. Se corrige consultando la lista de eliminados de Git, sin ignorar fuentes existentes ni reducir reglas; la repetición informa diez archivos heredados con problemas de formato, sin excepción. Se añade newline final al test del motor modificado. El formato global sigue fallando y no se da por aprobado.
- Documentación: verificación de enlaces/IDs/grafo y hashes DOCX originales correcta; integridad documental, no certificación funcional/OWASP.

Se detuvo únicamente el contenedor de ensayo meridiano-cero-t3-persistence-test-db-1, puerto 15434, conservando su volumen. La base preexistente de 15433 y WSL no se modificaron. Verificador documental: 80 Markdown con trazabilidad/links válidos y hashes DOCX originales intactos.

## Pendientes

No cierra T1-04 ni aceptación de T2/T3. Formato heredado se registra por separado; no se modifica SQL histórico/checksums para silenciarlo. Siguen pendientes lotes ampliados, máximos de retraso, vocabulario NPC/solución y reglas genéricas; acciones HTTP, guardados, primer resultado oficial, UI integrada, IA real y E2E. La separación del hash no certifica solvencia, procedencia del contenido o cumplimiento OWASP.
