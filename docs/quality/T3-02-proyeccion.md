# Continuación T3-02: frontera pública

Fecha: 2026-10-29. Alcance parcial de SPEC-002/004/012 y ADR-003; ACC-015. No cierre de fase.

## Inspección previa

Git branch --no-merged main sin resultados antes de crear la nueva rama; fetch de origin y branch -r --no-merged main sin pendientes. Main 5c58a79 ya contiene T3-04, T2 y la documentación de resiliencia. HEAD remoto apunta a main. No fue necesario otro merge. No se han publicado cambios de esta continuación.

CreateApp registra salud, readiness y autenticación local, sin rutas de partidas. No existe worker/generador consumido. Se corrigen marcas de completado T3-01/02/03 y E4/T4; no se descartan documentos ni pruebas históricas.

## Cambios

- PlayerView y FinalReport se definen una sola vez en contracts, sin imports del esquema privado. Case-schema los reutiliza mediante dependencia de tipos; lockfile conserva versiones externas.
- La proyección existente selecciona únicamente id y dueMinute de solicitudes. No expone payload ni tipo interno. Es la vista heredada del motor, no el DTO HTTP final con labels/estados.
- La posición y el informe se construyen explícitamente; sus referencias mutables no modifican el estado autoritativo. Una rama activa no expone un informe antiguo.
- El control engine-pure distingue archivos de prueba de producción: Vitest está permitido en archivos .test.ts; las restricciones del motor de producción permanecen activas. La dependencia crypto sigue señalada y pendiente de resolver.

## Verificación

Instalación congelada correcta con políticas de suministro activas. El intento offline carecía de metadatos; la instalación normal congelada pasó sin cambiar versiones.

Build y typecheck completos correctos. Suite: 160 pruebas correctas, 13 archivos. Tres pruebas nuevas con datos sintéticos prueban ausencia de secretos/futuros, informe oculto al restaurar rama activa y aislamiento de referencias. ESLint de contratos, tipos y pruebas nuevos correcto. Imports pasa de siete avisos a una infracción real pendiente: engine importa crypto. Verificación documental correcta: 71 Markdown, enlaces/grafo y hashes originales intactos. Revisión de whitespace del diff correcta tras normalizar el final del archivo de tipos.

No se han ejecutado integración PostgreSQL, E2E, evaluación de proveedor real ni accesibilidad manual; estas pruebas no acreditan autorización HTTP ni persistencia. Las reglas globales de lint heredadas siguen pendientes.

## Siguiente entrega

Consolidar el esquema activo de persistencia y construir API-juego: agregado con revisión/rama, ownership, ledger idempotente, preview/commit y autoguardado atómicos; después diez manuales y primer resultado oficial. Conectar UI retro solo al DTO autorizado y ejecutar ambas rutas completas antes de cerrar T3. Fase 4 espera esa puerta.
