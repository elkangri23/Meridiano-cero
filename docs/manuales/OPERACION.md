# Operación, recuperación y diagnóstico

Estado: runbook de desastre ejecutado el 2026-11-10 (lote 4, T6-05):
restore aislado con RPO/RTO medidos y bordes BOR-077/078/079/085/090
verificados; evidencia en [T6-05-desastre](../quality/T6-05-desastre.md).
Los procedimientos siguientes se apoyan en ese ensayo; lo que siga sin
ensayar se marca como tal.
Contrato: SPEC-009/010/011. No incluir secretos ni conversaciones en evidencias públicas.

## Arranque y parada

Antes de arrancar: validar configuración, volumen correcto, secretos disponibles y versión de DB/motor. Readiness debe fallar si falta DB/migración o configuración crítica. Health no debe ejecutar generación ni consumir tokens.

Parada: dejar de aceptar nuevas acciones, terminar transacciones en curso, cancelar/reprogramar trabajos con checkpoint y cerrar conexiones. El reloj del juego no avanza al detener servicio. Reiniciar no vuelve a ejecutar acciones confirmadas ni entrega dos veces recompensas.

## Actualización

Registrar versión origen/destino y revisión de código. Revisar cambios de esquema y compatibilidad de partidas. Crear y verificar backup; ejecutar migración una sola vez; arrancar nueva versión; comprobar readiness y smoke del fixture. No ejecutar migraciones concurrentes desde cada réplica.

Actualización compatible verificada 2026-11-10 (T6-05): el código de la
rama `distribucion-2026-11-10` aplicó `migrate-cli` sobre los datos
restaurados de producción sin tocarlos (ledger sigue en 13, la partida
de Antonio sigue en revisión 13 con el mismo hash de definición) y la
API+web arrancaron sanas con esos datos.

Si falla: detener nuevas escrituras, preservar diagnóstico sin secretos y decidir rollback según compatibilidad. Una migración irreversible exige restauración, no solo volver a una imagen vieja. Probar en copia antes de cambiar tráfico.

## Backups y restauración

Copia consistente de PostgreSQL, referencias a versiones y configuración no secreta. Claves por canal separado protegido. Cifrar copias y restringir acceso. Retención 7 (rotación automática, cron diario 03:00 UTC en el VPS).

Medido 2026-11-10 (T6-05, backup `meridiano-20261110-184844.sql.gz`,
222.370 bytes, 0,35 s): RPO 410 s (antigüedad del backup en el inicio
del restore; peor caso con el cron diario, ~24 h); restore en entorno
aislado 0,43 s; RTO a API+web sanas 31–34 s y a partida jugable 43 s
desde el inicio del restore. Ensayo mínimo ejecutado: instancia limpia,
restore, verificación de migraciones/hash de definiciones, acceso a
guardado, acción ejecutada y comprobación de idempotencia; duración,
pérdida máxima y resultado registrados en
[T6-05-desastre](../quality/T6-05-desastre.md). La existencia de un
archivo de backup no demuestra recuperabilidad; el ensayo sí.

Comandos del ensayo (en una copia del repo dedicada al drill, nunca en
el checkout de producción; el script se niega si existe `.env.prod`):

~~~text
sh scripts/backup-prod.sh    # copia de producción (rotación 7)
sh scripts/drill-setup.sh    # secretos propios, .env.drill (mock, sin correo), solo la BD del drill
sh scripts/drill-build.sh    # compila la rama en node:24.22.1 y verifica los dist
node scripts/drill-smoke.mjs # 18 comprobaciones: health/ready/web, /creditos, registro, catálogo, partida jugable
~~~

Secuencia completa paso a paso, con las cifras de las dos ejecuciones,
en [T6-05-desastre](../quality/T6-05-desastre.md).

Nunca borrar volúmenes o reemplazar DB de producción como paso de diagnóstico sin operación explícita y copia verificada.

Hallazgos del ensayo que condicionan la operación:

- Disco lleno (BOR-077): con el disco al 100 %, las lecturas y las
  escrituras pequeñas siguen funcionando (espacio libre dentro de las
  páginas ya asignadas y reciclado de WAL); las escrituras grandes
  fallan limpio (`could not extend file`, 503 `DEPENDENCY_UNAVAILABLE`
  en la API, sin partida parcial). Si se agota el WAL, postgres hace
  PANIC y se detiene antes que confirmar una escritura. **`/ready`
  sigue en 200 con el disco lleno: la readiness no detecta falta de
  espacio; hay que alertar por espacio en disco, no solo por readiness.**
- Backup corrupto (BOR-079): el restore falla sin falso éxito y el
  entorno sigue sano; hay que borrar la base temporal del intento.
- Migración futura en el ledger (BOR-078): `migrate-cli` rechaza
  (`MIGRATION_FAILED`) y el ledger queda intacto; con esa fila, la API
  arranca con health 200 y ready 503.
- Restore con cliente antiguo (BOR-090): la sesión creada después del
  backup devuelve 401 y el reintento de una acción confirmada con la
  misma clave de idempotencia no se ejecuta (401, sin resurrección de
  partidas borradas por el restore).
- Memoria (BOR-085/090): la API sirve health con límites de 160/96/64 MB
  en reposo; no se alcanzó OOM en reposo. Los trabajos restaurados
  estaban todos terminales (22 done / 47 failed) y ninguno se reanudó;
  el consumo de IA no cambió y el proveedor efectivo del drill era mock,
  sin llamadas reales ni correo.

## Monitorización y alertas

Métricas: disponibilidad, errores HTTP, latencia, conexiones DB, cola/leases, consumo IA, cuotas, cancelaciones, fallos de auth y espacio. Logs estructurados con requestId; separar trazas operativas de ActionLog y conversaciones.

Alertas de corte global, consumo anómalo, proveedor caído, cola atascada, fallos repetidos de login y backup. Cada alerta necesita destino y responsable definidos, más simulación de recepción; escribir un log no equivale a alertar.

## Incidentes

| Síntoma | Comprobación segura | Recuperación prevista |
|---|---|---|
| API no preparada | Configuración, DB y migración; sin imprimir secretos | Corregir dependencia; no habilitar acceso sin auth |
| IA no responde | Endpoint/modelo, timeout y política de red | Mantener dossier; fallback factual; reintentos acotados |
| Acción parece duplicada | Clave y ActionLog/versiones | Devolver resultado persistido; no ajustar reloj a mano |
| Cola atascada | Lease, heartbeat y presupuesto | Recuperar checkpoint o cancelar job sin publicar borrador |
| Consumo elevado | Reservas/cuotas/usuario/modelo | Corte global de nuevas llamadas y revisión |
| Sospecha de clave expuesta | Alcance y registros protegidos | Revocar/rotar, revisar impacto y restaurar operación |
| Datos corruptos | Versión/hash y estado transaccional | Aislar partida y restaurar; no improvisar hechos |
| No se puede iniciar sesión | Estado cuenta/sesión/rate limit | Flujo de recuperación; no desactivar seguridad |

## Privacidad y borrado

Definir retención por dato antes de público. Exportar solo datos propios; borrar cuenta revoca sesiones y aplica política a partidas/conversaciones, con tratamiento explícito de copias. Comunicar qué proveedor recibe contenido de juego. No afirmar borrado inmediato de todos los backups si la política no puede cumplirlo.

## Checklist previo a abrir público

Pruebas funcionales completas; críticos/altos aplicables resueltos; permisos y CSRF revisados; endpoints/SSRF comprobados; secretos fuera de build/logs; cuota y corte global ensayados; restore probado; políticas/licencias y autoría cerradas; soporte/incidentes definidos. Registrar evidencia, no casillas sin resultado.

Base local heredada de main: [BASE-LOCAL](BASE-LOCAL.md), con migraciones, readiness y sesión PostgreSQL. La evidencia de esa fase es histórica; consultar el estado integrado para las verificaciones nuevas.
