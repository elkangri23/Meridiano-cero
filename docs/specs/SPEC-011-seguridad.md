# SPEC-011 Seguridad y modelo de amenazas

Estado: diseño inicial, ningún control de producto verificado. 2026-10-27.
Responsable de implementación: quien entrega la tarea; revisión de seguridad independiente antes de fase 7.
REQ-Q01 a REQ-Q12; ADR-010. Matriz de controles: [OWASP](../security/OWASP.md).

## Activos, actores y fronteras

Activos: partidas privadas, credenciales, presupuesto de IA, verdad del caso, disponibilidad, código y datos persistidos. Actores: jugador legítimo, jugador abusivo, contenido importado, modelo/proveedor comprometido y operador que configura mal el servicio.

Fronteras: navegador → API; API → DB; API/worker → proveedor; importación → validador; pipeline CI → distribución; administrador → configuración. El modelo, archivos y navegador son no confiables. El motor recibe datos validados; tampoco confía en que un operador o un modelo haya declarado un caso válido.

| Amenaza | Ataque / impacto | Control | Prueba |
|---|---|---|---|
| TH-01 | Cambiar runId/ownerId, leer otra partida o solución | SEC-01/02: ACL por recurso y proyección explícita | ACC-015 |
| TH-02 | Endpoint malicioso, rebinding o redirección a red interna | SEC-03: política de egreso, destino efectivo y redes | ACC-022 |
| TH-03 | Prompt en NPC/archivo ordena revelar o ejecutar | SEC-04: contexto mínimo, contratos y autoridad del motor | ACC-016 |
| TH-04 | XSS/SQL/operadores ejecutables en órdenes o expedientes | SEC-05/06: parametrización, texto seguro y vocabulario cerrado | ACC-021/023 |
| TH-05 | Repetición, carrera entre pestañas o doble cargo | SEC-07: transacción e idempotencia | ACC-013 |
| TH-06 | Fuerza bruta, sesión fijada, robo de cuenta | SEC-08: sesiones mantenidas, límites y recuperación | ACC-020 |
| TH-07 | Extracción de claves en frontend, logs o backups | SEC-09/10: secretos y mínimos privilegios | ACC-024 |
| TH-08 | Agotar presupuesto, contexto o generación | SEC-11: cuotas y presupuestos antes de invocar | ACC-027 |
| TH-09 | Paquete/CI/imagen comprometida | SEC-12: lockfile, revisión, permisos mínimos y escaneo | ACC-025 |
| TH-10 | Alterar definición o ejecutar importación | SEC-06/13: versión, hash, revalidación y límites | ACC-023 |
| TH-11 | Fallo de proveedor/DB tratado como éxito | SEC-14: fallo cerrado, rollback y fallback factual | ACC-018 |
| TH-12 | Incidente sin alerta ni restauración | SEC-10/15: logs protegidos, alertas y recuperación | ACC-026/028 |

## Políticas de implementación

Público: HTTPS; cookies HttpOnly/Secure/SameSite; autorización y defensa CSRF en mutaciones autenticadas; sin proveedores arbitrarios de jugadores por defecto. CORS y origen explícitos. Login y recuperación sin enumerar cuentas. Fijar algoritmos y parámetros de contraseñas mediante librería mantenida al cerrar SPEC-004; no hacer hashes caseros.

Local: cuenta de desarrollo solo en modo local y binding loopback, nunca una contraseña universal; configuración pública debe rechazar el bypass local. Permitir Ollama en host únicamente por política explícita del administrador. Contenedores con usuario sin privilegios y DB sin puerto público.

Importaciones: tamaño, profundidad y recuentos acotados; JSON validado antes de persistir; sin fetch de URLs del archivo ni ejecución de expresiones. Texto de jugador/IA como texto, no HTML arbitrario.

Timeouts y reintentos acotados por función. Ningún reintento de IA ejecuta de nuevo la acción del motor. Fallo de autorización/validación nunca se transforma en permiso. Los errores públicos no incluyen stack, consultas, tokens ni hechos ocultos.

## Controles cerrados para T1-01 (2026-10-28)

Estos controles están precisados para la base de fase 1. No significa que estén
implementados; significa que el contrato está cerrado y T1-02/T1-03 deben
cumplirlos. Los controles no listados aquí son propuestos para fases posteriores.

| Amenaza | Control cerrado T1-01 | Estado |
|---|---|---|
| TH-01 | ACL por recurso: cada endpoint de lectura/escritura comprueba que el recurso pertenece a la sessión autenticada. PlayerView se construye por lista explícita de campos autorizados; nunca serialización genérica. | Contrato cerrado |
| TH-06 | Sesiones opacas con hash del token en DB. Rotación al login. Revocación al logout. Login/recuperación devuelven mensaje genérico sin enumerar cuentas. Límite de intentos: 5 en 15 min por IP+username, bloqueo 15 min. Cookie HttpOnly, SameSite=Lax, Secure solo en production. | Contrato cerrado |
| TH-07 | Secretos fuera de Git: `DATABASE_URL`, `SESSION_SECRET`, `AI_API_KEY` solo en variables de entorno o gestor de secretos. Frontend nunca recibe secretos. Logs sin tokens, contraseñas ni URLs de DB. | Contrato cerrado |
| TH-09 | Lockfile congelado (`pnpm-lock.yaml`). CI ejecuta desde checkout limpio y verifica lockfile intacto. Análisis de dependencias y secretos en CI. Permisos mínimos en contenedores: usuario no root, DB sin puerto público. | Contrato cerrado |
| TH-12 | Logs protegidos: solo en registro del servidor, sin datos personales ni hechos del caso. Alertas configurables para fallos de DB/proveedor. Health/readiness exponen solo estado técnico. | Contrato cerrado |
| TH-02 | Policy de egreso para `AI_BASE_URL`: solo loopback u host configurado explícitamente por administrador. No redirecciones, no resolución DNS dinámica, sin fetching de URLs del jugador. Aplicable parcialmente en fase 1 (configuración); verificación completa en fase 7. | Contrato cerrado, sin verificar |

### Controles no aplicables en fase 1

| Amenaza | Motivo |
|---|---|
| TH-03 | Requiere IA y contexto de narración (fase 3). |
| TH-04 | Requiere texto de órdenes/expedientes (fase 3+). |
| TH-05 | Requiere motor y transacciones de acciones (fase 3). |
| TH-08 | Requiere cuotas de IA y generación (fase 4). |
| TH-10 | Requiere importación y validación de casos (fase 4). |
| TH-11 | Requiere proveedor IA y narración (fase 3). |

## Puertas de seguridad

Fase 1: configuración y CI. Fase 3: permisos, sesiones, proyección y pruebas de IA. Fase 4: importaciones/cola. Fase 6: restauración. Fase 7: revisión manual y dinámica sobre entorno de pruebas, con límites que eviten afectar a terceros.

Críticos/altos aplicables bloquean lanzamiento. Otros hallazgos requieren severidad, responsable y fecha/condición de solución. Un falso positivo se excluye solo con evidencia y revisión. No declarar certificación OWASP ni conformidad ASVS completa: esta es selección aplicable y trazada.

La revisión previa a público ampliará la selección ASVS con autenticación, cookies, TLS y criptografía específicos una vez elegidas sus implementaciones. No marcar esos ámbitos como excluidos por faltar todavía el código.
