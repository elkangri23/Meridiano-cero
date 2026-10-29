# T3-02: catálogo e inicio de partida por HTTP

Fecha: 2026-10-29. Continuación de persistencia/proyección. SPEC-002/003/004/011/012, API-juego, ADR-003/007; ACC-013/014/015/020/021 parcialmente cubiertos. Tarea y fase siguen abiertas.

## Alcance implementado

CreateApp con configuración registra GET /api/v1/cases, GET /cases/:caseId, POST /runs y GET /runs/:runId. Sin configuración mantiene base HTTP aislada. Las rutas exigen sesión persistida, no generan cuentas ni aceptan owner del cliente. POST comprueba Origin exacto y CSRF en tiempo constante antes del parseo de negocio; la transacción vuelve a validar sesión y propietario. La extracción/comparación de tokens se comparte con autenticación local, sin duplicar reglas.

Catálogo fijo por lista explícita, sin solución, objetivos, seed o conocimientos NPC. Un caso actual y limit estricto 1..100; nextCursor=null y cursores no emitidos se rechazan. El fixture se copia para evitar mutación entre peticiones. Inicio devuelve 201; replay de la misma intención devuelve 200 y misma identidad con replayed=true. Los errores tienen formato público uniforme sin SQL ni valores privados.

InitialPlayerViewDto es una entrega acotada del contrato objetivo: posición y lugares iniciales con nombres, las tres ciudades guiadas, revisión y rama persistidas, listas narrativas vacías correspondientes al estado inicial, sin informe ni resultado oficial. Manuales y consulta de operaciones figuran deshabilitados. No serializa StoredRun ni PlayerView heredado.

Antes de proyectar se comprueban definición/hash, versión y estado inicial completo, sin coerción. Estados modificados/incompatibles fallan con 503 conservando los datos. Esta restricción debe sustituirse por el proyector general junto a preview/commit; no habilitar acciones que produzcan estados no representables. No equivale a ejecutar una investigación o a cumplir todos los subcasos del DTO final.

Los comandos dev/test/tipos/smoke construyen engine y sus dependencias cuando necesitan los exports compilados. No se requieren nuevos paquetes externos ni se cambia el diseño retro.

## Evidencia

Integración real: 26 pruebas correctas en tres archivos, ocho nuevas de HTTP. Comprobados: sesión obligatoria; catálogo sin secretos y límites; Origin/CSRF/esquema sin efectos; inicio seguro con capacidades explícitas; reintentos concurrentes; recuperación desde otra instancia/conexión y recurso ajeno; estado no proyectable sin filtración; revocación. Los centinelas y perfiles son sintéticos. El contenedor aislado de 15434 conserva su volumen y no modifica la base preexistente en 15433.

Build, tipos y ESLint de módulos modificados correctos; suite general de 162 pruebas en 14 archivos, además de las 26 de integración. Smoke con HTTP real web/proxy/API correcto, escaneo por patrones sin hallazgos y verificación documental correcta (73 Markdown). El arranque con Node detectó una parameter property no soportada en strip-only; se sustituyó por declaración y asignación explícitas, manteniendo el comportamiento. No se acredita navegador, accesibilidad, proveedor real, reinicio físico, carga de guardados ni carrera. El control global de imports conserva las aristas heredadas de engine hacia crypto ya registradas. verify:guards detecta correctamente contrato incompatible, imports web hacia API/Node y ciclos, pero falla su comprobación final de baseline por esas dos aristas; no se presenta como aprobado ni se desactiva la regla.

## Siguiente bloque

Preview/commit con token ligado a revisión/rama, proyección general de efectos públicos y operación idempotente junto al estado/ActionLog; después manuales, restauración y primer resultado oficial. Conectar la UI retro solo cuando estas capacidades sean reales. Mantener los escenarios de T3-06 y T3-05 pendientes de sus ensayos específicos.
