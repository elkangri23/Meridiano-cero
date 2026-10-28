# SPEC-004 API, identidad y persistencia de acciones

Estado: cerrada para base en T1-01; se amplía en T3-01. Fecha: 2026-10-27.
Fuentes: TAD §3,5,6,10,11,14; GDD §6,9,13. ADR-003/007/010.

## Decisiones de cierre T1-01 (2026-10-28)

Estas decisiones cerraron los puntos propuestos de esta spec para la base de fase 1.
No son aprobación histórica; se registran como decisiones de implementación.

| Tema | Decisión tomada | Fundamento |
|---|---|---|
| Modo development | Variable `APP_MODE=development`, binding loopback. No habilitable en configuración pública. | SPEC-004 §L10; SPEC-009 §L8 |
| Autenticación | Argon2id con valores por defecto de la librería mantenida. No hashes caseros. | SPEC-004 §L12; SPEC-011 §L30 |
| Límites iniciales | Texto 4.000 caracteres; lote máximo 10 pasos; cuerpo normal 64 KiB; paginación 25 por defecto, 100 máximo. | SPEC-004 §L52 (propuestos → aprobados tal cual) |
| Proveedor IA | `AI_PROVIDER=ollama` por defecto; `AI_PROVIDER=freellmapi` como alternativa configurada. Intercambiable según capacidades (REQ-G16-01). | DEC-002; SPEC-005; entorno de desarrollo híbrido |
| Preview/confirmación | Token opaco en servidor, caduca a 5 minutos de reloj real. | SPEC-004 §L56 |

## Objetivo y fronteras

Un único backend decide permisos y efectos del juego. Todas las rutas de producto se publican bajo /api/v1. El navegador usa el mismo origen; el proxy entrega web y API, evitando habilitar CORS global. Health/readiness no contienen secretos.

Identidad local inicial: crear perfil de desarrollo por configuración explícita en modo development, con binding loopback. No permitir ese modo en una configuración pública. En instalaciones autoalojadas de distribución habrá bootstrap de administrador; nunca credenciales admin/admin.

Autenticación pública: usuario y contraseña; contraseña mediante implementación mantenida de Argon2id y parámetros calibrados/documentados al cerrar la base. Sesión opaca generada criptográficamente, guardada en servidor; almacenar hash del token de sesión. Cookie HttpOnly, Secure en HTTPS y SameSite=Lax; proteger mutaciones con comprobación de origen y token CSRF. No usar localStorage para sesiones. No inventar protocolo criptográfico.

Roles iniciales: player y administrator. Un administrador gestiona instalación/proveedores/usuarios; no se expone lectura indiscriminada de conversaciones desde el juego. Operaciones administrativas auditadas y separadas. No hay roles por rango de detective.

## Contratos de base T1-01 (cerrados 2026-10-28)

Los siguientes endpoints y DTOs están cerrados para la base de fase 1. No son
implementación; son el contrato que T1-02/T1-03 deben cumplir. Los endpoints
no incluidos aquí son propuestos para fases posteriores y no se implementan en
fase 1.

### Endpoints de base (fase 1)

| Ruta | Estado | Contrato |
|---|---|---|
| `GET /health` | Cerrado | `{"status":"ok","version":string}`. Sin auth, sin secretos. |
| `GET /ready` | Cerrado | `{"status":"ready"}` o 503 si DB/proveedor no disponibles. Sin secretos. |
| `POST /auth/register` | Cerrado para development | Solo cuando `APP_MODE=development` y `REGISTRATION_ENABLED=true`. Body: `{username:string, password:string}`. Respuesta: `{profile:{id,username,createdAt}, session:{token, expiresAt}}`. 400 si username duplicado o inválido. |
| `POST /auth/login` | Cerrado | Body: `{username:string, password:string}`. Sesión rotada al autenticar. 401 con mensaje genérico (sin enumerar cuenta). |
| `POST /auth/logout` | Cerrado | Requiere cookie de sessión + token CSRF. Revoca la sessión. 204. |
| `GET /me` | Cerrado | Requiere autenticación. Respuesta: perfil propio y preferencias. 401 sin sessión. |
| `PATCH /settings` | Cerrado | Body parcial de preferencias validadas. 401 sin sessión. |

### DTOs de base

**Sesión:**
```json
{
  "token": "string",
  "expiresAt": "ISO8601",
  "cookie": {
    "httpOnly": true,
    "secure": false,
    "sameSite": "Lax",
    "path": "/",
    "maxAge": 86400000
  }
}
```

**Error público (todos los endpoints):**
```json
{
  "error": {
    "code": "string",
    "message": "string",
    "requestId": "string",
    "fieldErrors": { "string": ["string"] }
  }
}
```
Códigos estables: `INVALID_INPUT`, `UNAUTHORIZED`, `NOT_FOUND`, `CONFLICT`,
`RATE_LIMITED`, `SERVICE_UNAVAILABLE`. Nunca stack, SQL, claves ni hechos ocultos.

### Límites de base (fase 1)

| Límite | Valor | Ajuste |
|---|---|---|
| Texto de orden | 4.000 caracteres | Solo con cambio documentado y pruebas |
| Lote máximo | 10 pasos | Solo con cambio documentado y pruebas |
| Cuerpo petición | 64 KiB | Solo con cambio documentado y pruebas |
| Paginación | 25 por defecto, 100 máximo | Solo con cambio documentado y pruebas |
| Token preview | Caduca 5 min reloj real | No negociable |
| Sesión | 24 h, rotación al login | No negociable |

### Configuración de base

| Variable | Requerido | Valor development | Valor public | Notas |
|---|---|---|---|---|
| `APP_MODE` | No | `development` | `production` | Public rechaza `development` |
| `PUBLIC_ORIGIN` | Sí | `http://localhost:3000` | HTTPS real | Origen del navegador |
| `DATABASE_URL` | Sí | `postgres://app:app@localhost:5432/app` | Postgres real | Privada, fuera de Git |
| `SESSION_SECRET` | Sí | Valor development | Valor seguro | Argon2id para hash de token |
| `REGISTRATION_ENABLED` | No | `true` | `false` | Public: activable por admin |
| `AI_PROVIDER` | No | `ollama` | `ollama` o `freellmapi` | Interchangeable |
| `AI_BASE_URL` | No | `http://localhost:11434` | Configurado por admin | Policy de egreso |
| `AI_MODEL` | No | Instalado en host | Configurado por admin | |
| `AI_API_KEY` | No | No se usa | Opcional | Solo para proveedores externos |

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

Los endpoints de **base** (fase 1) están cerrados en la sección anterior.
Los endpoints de **propuesta** (fases 2+) no se implementan en fase 1.
Auth administrativa y exportación de datos personales se concretan antes de fase 7.

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
