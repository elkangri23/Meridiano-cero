# T3-02: persistencia inicial de partidas

Fecha: 2026-10-29. Entrega parcial de T3-02; SPEC-002/004/009/011/012, API-juego, GUARDADOS y ADR-003/007. ACC-013/014/020/021 parcialmente comprobados. No cierre de fase ni endpoints de juego entregados.

## Implementación

El esquema activo es apps/api/src/database/schema.ts y las migraciones que consume database/migrations.ts están en apps/api/migrations. El árbol src/db se conserva como histórico, sin registro en Drizzle ni ejecución; no aplicar sus SQL sobre esta base. La revisión automática rechazó borrar esos archivos, por lo que se utiliza una ampliación aditiva sin modificar migraciones históricas.

0002_run_creation añade runs y run_creations: propietario referenciado al perfil, revisión HTTP separada del estado del motor, rama UUID, definición/hash, estado privado JSONB y tiempos operativos. Hay restricciones de revisión/versión positivas, digest, objeto JSON, unicidad de intención por usuario y FK compuesta que impide asociar una creación a una partida ajena. 0003_run_permissions limita el rol de aplicación a SELECT/INSERT en estas tablas. Las futuras transiciones requerirán su concesión explícita de UPDATE; no habilitarla en esta entrega solo por anticipación.

El servicio game/runs crea y lee agregados privados. No devuelve DTO público y no debe serializarse en HTTP. Comprueba sesión persistida en la misma transacción, sin owner recibido del cliente; mantiene bloqueo compartido de sesión que ordena revocación/rotación respecto a la operación. Bloqueo transaccional por usuario/clave antes de crear la fila de partida. Misma intención devuelve la misma identidad; otra intención con la clave existente produce conflicto. El replay se comprueba antes de la disponibilidad actual del caso. Una sesión revocada no recupera resultados históricos.

Creación y registro de idempotencia confirman juntos. Fallo previo al commit revierte ambos; fallo ambiguo al confirmar requiere reintentar la clave original. El acceso usa parámetros SQL, y una partida ajena, inexistente o con ID mal formado produce NOT_FOUND. No hay llamadas de IA dentro de la transacción.

El hash heredado usaba una lista superficial de claves y omitía campos anidados. Se corrige la normalización recursiva: ordenar objetos, preservar arrays, excluir solo validationReport de raíz, SHA-256 mediante primitiva nativa. Los estados nuevos usan el hash corregido. No se reinterpretan ni migran guardados históricos; antes de admitirlos deberá verificarse expresamente su formato/compatibilidad. Esta entrega no importa estados de src/db ni actualiza datos reales.

## Verificaciones ejecutadas

- Instalación frozen-lockfile y políticas de suministro correctas; solo enlaces workspace nuevos API → engine/case-schema, sin bibliotecas externas nuevas.
- Build y tipos completos correctos. test:integration construye engine y sus dependencias antes de importar el servicio, para no depender de dist previo.
- Suite general: 162 pruebas correctas, 14 archivos; incluye dos regresiones nuevas de integridad anidada y orden/reporte volátil. Un intento bajo sandbox bloqueó el doble HTTP local; la ejecución con permiso de loopback pasó íntegra sin cambiar el test ni invocar un modelo.
- Integración PostgreSQL real: 18 pruebas correctas, dos archivos. Diez de base y ocho del servicio nuevo: lectura desde otra conexión; concurrencia con igual clave; replay y conflicto; aislamiento de recursos; rollback provocado después de insertar estado; claves iguales en dos usuarios; mínimos privilegios; revocación antes de lectura/replay.
- La prueba de rollback usa un trigger sintético temporal y lo elimina al finalizar. Limpieza de filas exclusivamente de los dos perfiles sintéticos generados por el test.
- ESLint de servicio, esquema y pruebas añadidas correcto; escaneo por patrones sin hallazgos y verificador documental correcto (72 Markdown). Imports global señala dos aristas de la misma dependencia engine → crypto (fuente y dist, este último ahora consumido por API); no se desactivan reglas de producción. Persisten otros fallos globales heredados ya registrados.

La concurrencia de creación usa dos conexiones reales simultáneas; no es todavía el ensayo completo con barreras de T3-06 para acción/carga/cierre/revocación en vuelo. La lectura desde otra conexión acredita durabilidad SQL, no un ensayo de reinicio físico o restauración de backups. No se han ejecutado E2E, proveedor real, accesibilidad manual ni rutas HTTP nuevas.

## Entorno aislado

Se genera configuración sintética propia de este worktree. Compose usa proyecto meridiano-cero-t3-persistence-test, puerto loopback 15434 y volumen independiente; la base preexistente en 15433 permanece intacta. El guard de integración admite únicamente puertos sintéticos 15433/15434, DB meridiano y rol meridiano_app. No se imprimen credenciales ni se versionan archivos .env/secrets. Las migraciones se aplican dos veces para verificar su idempotencia.

Comandos: pnpm build; pnpm typecheck; pnpm test; pnpm test:integration; pnpm exec eslint sobre los módulos añadidos; pnpm check:imports; pnpm scan:secrets; Python scripts/verify_docs.py. Docker debe estar disponible; usar siempre compose.yaml explícito y el proyecto aislado, sin eliminar volúmenes ajenos.

## Pendiente antes de conectar el navegador

Definir/validar PlayerViewDto v1 completo y registrar catálogo/creación/lectura HTTP con sesión, Origin y CSRF; no exponer StoredRun. Consolidar el catálogo inmutable y su compatibilidad antes de resolver definiciones almacenadas. Después preview/commit con revisión/rama, registro de operaciones y ActionLog, autoguardado transaccional, diez manuales, restauración con rama nueva y primer resultado oficial inmutable. Mantener T3-02 y T3-06 en curso/pendiente según backlog, sin avanzar a generación por tener estas tablas.
