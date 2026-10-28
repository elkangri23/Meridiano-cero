# Operación, recuperación y diagnóstico

Estado: runbook objetivo de distribución, pendiente de ensayo. Existen servicios de desarrollo y CLI de IA, pero no instalación de producto aceptada ni operación pública. Para sus límites actuales consultar [ESTADO](../plan/ESTADO.md). Los procedimientos siguientes no son evidencia de ejecución.
Contrato: SPEC-009/010/011. No incluir secretos ni conversaciones en evidencias públicas.

## Arranque y parada

Antes de arrancar: validar configuración, volumen correcto, secretos disponibles y versión de DB/motor. Readiness debe fallar si falta DB/migración o configuración crítica. Health no debe ejecutar generación ni consumir tokens.

Parada: dejar de aceptar nuevas acciones, terminar transacciones en curso, cancelar/reprogramar trabajos con checkpoint y cerrar conexiones. El reloj del juego no avanza al detener servicio. Reiniciar no vuelve a ejecutar acciones confirmadas ni entrega dos veces recompensas.

## Actualización

Registrar versión origen/destino y revisión de código. Revisar cambios de esquema y compatibilidad de partidas. Crear y verificar backup; ejecutar migración una sola vez; arrancar nueva versión; comprobar readiness y smoke del fixture. No ejecutar migraciones concurrentes desde cada réplica.

Si falla: detener nuevas escrituras, preservar diagnóstico sin secretos y decidir rollback según compatibilidad. Una migración irreversible exige restauración, no solo volver a una imagen vieja. Probar en copia antes de cambiar tráfico.

## Backups y restauración

Copia consistente de PostgreSQL, referencias a versiones y configuración no secreta. Claves por canal separado protegido. Cifrar copias y restringir acceso. Retención, RPO y RTO se fijan con recursos del despliegue y se miden en ensayo.

Ensayo mínimo: instancia limpia, restaurar backup, verificar migraciones/hash de definiciones, acceder a guardado, confirmar pendientes/reloj, ejecutar una acción y comprobar idempotencia. Registrar duración, pérdida máxima y resultado. La existencia de un archivo de backup no demuestra recuperabilidad.

Nunca borrar volúmenes o reemplazar DB de producción como paso de diagnóstico sin operación explícita y copia verificada.

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
