# SPEC-004 API, identidad y persistencia de acciones

Estado: especificación detallada propuesta; cerrar en T1-01 y ampliar en T3-01. Fecha: 2026-10-27.
Fuentes: TAD §3,5,6,10,11,14; GDD §6,9,13. ADR-003/007/010.

## Objetivo y fronteras

Un único backend decide permisos y efectos del juego. Todas las rutas de producto se publican bajo /api/v1. El navegador usa el mismo origen; el proxy entrega web y API, evitando habilitar CORS global. Health/readiness no contienen secretos.

Identidad local inicial: crear perfil de desarrollo por configuración explícita en modo development, con binding loopback. No permitir ese modo en una configuración pública. En instalaciones autoalojadas de distribución habrá bootstrap de administrador; nunca credenciales admin/admin.

Autenticación pública: usuario y contraseña; contraseña mediante implementación mantenida de Argon2id y parámetros calibrados/documentados al cerrar la base. Sesión opaca generada criptográficamente, guardada en servidor; almacenar hash del token de sesión. Cookie HttpOnly, Secure en HTTPS y SameSite=Lax; proteger mutaciones con comprobación de origen y token CSRF. No usar localStorage para sesiones. No inventar protocolo criptográfico.

Roles iniciales: player y administrator. Un administrador gestiona instalación/proveedores/usuarios; no se expone lectura indiscriminada de conversaciones desde el juego. Operaciones administrativas auditadas y separadas. No hay roles por rango de detective.

## Superficie API propuesta

| Método y ruta relativa | Entrada principal | Respuesta permitida |
|---|---|---|
| POST /auth/register | nombre de usuario, contraseña; solo registro habilitado | Perfil mínimo y sesión |
| POST /auth/login | identificador y contraseña | Perfil y sesión rotada |
| POST /auth/logout | sesión/CSRF | Sesión revocada |
| POST /auth/recovery/request | email si recuperación está habilitada | Respuesta genérica |
| POST /auth/recovery/confirm | token de un uso y contraseña nueva | Revocación de sesiones |
| GET /me | sesión | Perfil propio y preferencias |
| PATCH /settings | preferencias validadas | Preferencias actualizadas |
| GET /cases | filtros y paginación | Catálogo accesible sin solución |
| POST /cases | parámetros del caso | Job de generación, fase 4 |
| GET /cases/:id | ID autorizado | Metadatos jugables, nunca definición completa |
| POST /runs | definitionId validado | PlayerView inicial |
| GET /runs/:id | ID propio | PlayerView y versión |
| POST /runs/:id/actions/preview | texto interpretado o acciones estructuradas | Plan visible, costes y confirmationToken |
| POST /runs/:id/actions | token de preview, expectedVersion, idempotencyKey | Resultado y PlayerView |
| POST /runs/:id/batch-decision | cancel o continue_independent, versión y clave | Lote actualizado y nuevo preview si cambia |
| POST /runs/:id/finish | preview/confirmación, versión y clave | Informe y partida cerrada |
| GET /jobs/:id | ID propio | Estado y progreso público sin borradores secretos |
| GET/PUT /ai/config | acceso según ámbito | Configuración sin credenciales legibles |
| POST /ai/test | referencia a configuración | Capacidades y resultados, sin prometer calidad |
| POST /cases/import | JSON validado, fase 4 | Resultado de validación o job |
| POST /cases/:id/export | confirmación de spoilers y permiso de dueño | Expediente completo autorizado |
| GET /runs/:id/report | partida propia cerrada | Informe definitivo |
| GET /health; GET /ready | ninguna | Estado técnico mínimo |

Son contratos previstos, no endpoints existentes. Auth administrativa y exportación de datos personales se concretan antes de fase 7.

## DTO y errores

Request IDs generados por servidor y reflejados al cliente. Respuesta de acción: runId, version, outcome, events públicos, playerView y narrativeStatus. Nunca devolver logs internos o prompts.

Error público: code estable, message segura, requestId y fieldErrors opcionales sin eco de secretos. 400 estructura inválida; 401 sin sesión; 404 recurso ausente/no autorizado para no enumerar IDs; 409 versión/clave conflictiva; 422 acción imposible o aclaración; 429 cuota; 503 dependencia no disponible. Las imposibilidades del mundo del juego también pueden expresarse como outcome en una respuesta válida; distinguirlas de error HTTP de validación.

Límites iniciales propuestos: texto de orden 4.000 caracteres; lote máximo 10 pasos; cuerpo normal 64 KiB; paginación 25 por defecto y 100 máximo. Importación tiene límites separados en SPEC-007. Ajustar solo mediante cambio documentado y pruebas.

## Preview y confirmación

Preview no cambia hechos ni reloj. Token opaco en servidor vinculado a usuario, partida, versión y plan normalizado; caduca a los 5 minutos de reloj real. Un preview caducado o versión cambiada exige recalcular. El token no contiene solución. Una consulta gratuita puede ejecutarse sin confirmación si no tiene consecuencias irreversibles; toda acción con coste o consecuencias requiere confirmación.

La interpretación IA ocurre antes de ejecutar. Si es ambigua, preguntar sin ejecutar parcialmente. El lote confirma estimaciones; ante imposibilidad contextual se aplica SPEC-001. Mostrar consecuencias conocidas de irregularidades sin revelar qué resolverá el caso.

## Escritura y recuperación

Transacción: comprobar sesión/permisos, cargar versión, reclamar idempotencyKey, aplicar motor, guardar estado/eventos/resultado. Guardar clave y carga normalizada o digest; clave única por partida. Reintento idéntico devuelve resultado lógico persistido sin avanzar reloj; otra carga produce 409. Conservar claves y resultados durante la vida del guardado. Lectura previa del cliente no sustituye el control atómico.

Narración se solicita tras commit. Si falla, resultado factual; no rollback de acción ya ejecutada. En reinicio con acción en vuelo, el cliente consulta partida o reintenta misma clave. Finalización y actualización de carrera deberán ser idempotentes, con un evento de recompensa único.

## Aceptación

ACC-013/014/015/018/020/021/024. T1-01 debe comprobar disponibilidad de librerías y fijar parámetros de autenticación antes de código. Pruebas de dos usuarios, sesión revocada, token de preview viejo, CSRF, doble pestaña, fallo antes/después de commit y mismo ID con otra carga. No se utilizarán credenciales reales en fixtures.
