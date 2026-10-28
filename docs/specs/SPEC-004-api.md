# SPEC-004 API, identidad y persistencia de acciones

Estado: contrato de base para revisión de T1-01; contrato detallado de juego y guardados desarrollado en T3-01, pendiente de implementación y verificación. Fecha: 2026-10-28. Este contrato no acredita implementación de las rutas de juego ni aceptación del hito.
Fuentes: TAD §3,5,6,10,11,14; GDD §6,9,13. ADR-003/007/010.

## Objetivo y fronteras

Un único backend decide permisos y efectos del juego. Todas las rutas de producto se publican bajo /api/v1. El navegador usa el mismo origen; el proxy entrega web y API, evitando habilitar CORS global. Health/readiness no contienen secretos.

Identidad local inicial: crear perfil de desarrollo por configuración explícita en modo development, con binding loopback. No permitir ese modo en una configuración pública. En instalaciones autoalojadas de distribución habrá bootstrap de administrador; nunca credenciales admin/admin.

Autenticación pública: usuario y contraseña; contraseña mediante implementación mantenida de Argon2id y parámetros calibrados/documentados al cerrar la base. Sesión opaca generada criptográficamente, guardada en servidor; almacenar hash del token de sesión. Cookie HttpOnly, Secure en HTTPS y SameSite=Lax; proteger mutaciones con comprobación de origen y token CSRF. No usar localStorage para sesiones. No inventar protocolo criptográfico.

Roles iniciales: player y administrator. Un administrador gestiona instalación/proveedores/usuarios; no se expone lectura indiscriminada de conversaciones desde el juego. Operaciones administrativas auditadas y separadas. No hay roles por rango de detective.

## Contrato de base de T1-01

Fecha de concreción: 2026-10-28. Este apartado fija la base local; las acciones,
login con contraseña y recuperación siguen sus fases del backlog. No declara
endpoints implementados. Ante discrepancia, este apartado concreta únicamente
la fase 1 y no cambia las reglas de juego.

### Identidad local y sesión

- `LOCAL_DEV_AUTH_ENABLED` es obligatorio y booleano; no se deduce de NODE_ENV.
  Solo puede ser true con APP_MODE=development, API_HOST=127.0.0.1 y
  PUBLIC_ORIGIN con hostname 127.0.0.1. localhost, ::1 y comodines no son
  alias admitidos inicialmente: una única dirección evita ambigüedad de cookies.
- El usuario local tiene rol player y un ID persistente generado por servidor;
  no existe contraseña por defecto ni selección de usuario por cabecera/query.
  Una operación de migración/semilla explícita crea ese perfil una sola vez.
- `POST /api/v1/auth/local-session` crea una sesión exclusivamente bajo esa
  configuración y devuelve perfil mínimo y token CSRF. Verifica Origin igual a
  PUBLIC_ORIGIN y exige Content-Type application/json y cuerpo {} sin campos de identidad.
  Fuera de development el endpoint no se registra. La configuración inválida
  falla antes de escuchar, no se limita a esconder el endpoint.
- Sesión opaca: 32 bytes aleatorios con crypto.randomBytes, base64url; guardar
  solo su digest SHA-256 en PostgreSQL, usuario, creación, expiración y revocación.
  SHA-256 sirve para tokens aleatorios de alta entropía, nunca para contraseñas.
  No hace falta una clave de firma para este token opaco: la sesión se valida
  contra el digest persistido. No exigir SESSION_SECRET sin un consumidor real.
- Cookie `meridiano_session`, HttpOnly, Path=/api/v1, SameSite=Lax, sin Domain;
  Secure obligatorio en HTTPS. Solo el HTTP de development en 127.0.0.1 permite
  Secure=false. Expiración absoluta de 8 horas, sin renovación silenciosa.
  Crear otra sesión rota la cookie; revocar la anterior en la misma transacción.
- CSRF: token independiente de 32 bytes, ligado a sesión en servidor, retornado solo
  en respuesta autenticada y conservado en memoria del cliente. No autentica sin
  la cookie de sesión; queda excluido de logs. Mutaciones
  exigen Origin exacto y X-CSRF-Token; lectura GET /me permite recuperarlo sin
  rotar ni cambiar identidad. Comparación de longitud y tiempo constante;
  regenerarlo al rotar sesión. Nunca se envía por URL. Respuestas de sesión y
  perfil usan Cache-Control: no-store; no devolver el CSRF en un recurso público.
- `GET /api/v1/me` sin sesión válida devuelve 401; no crea identidad por efecto
  lateral. `POST /api/v1/auth/logout` revoca sesión y expira cookie; repetir la
  operación con sesión ya revocada devuelve 204 sin crear nueva sesión. En ese
  caso sigue exigiendo Origin válido, sin intentar validar un CSRF ya eliminado.
  Con sesión activa exige ambos controles antes de revocar.
- No confiar en X-Forwarded-For/Host/Proto: trustProxy=false en base local.
  El proxy de Vite conecta a API por loopback y conserva el Origin del navegador;
  no se habilita CORS para compensar una configuración incoherente.

### Base HTTP y errores

Fase 1 implementará únicamente health, ready y la sesión local aplicable;
el catálogo restante de esta spec espera sus tareas. GET /api/v1/health devuelve
200 con {status: "ok"} si el proceso atiende. GET /api/v1/ready devuelve 200
con {status: "ready"} solo con DB accesible y migración esperada aplicada;
en otro caso 503 con {status: "not_ready"}. No comprueba Ollama ni llama a IA.
Ambas rutas son sin sesión y no revelan versiones, hostnames ni conexión DB.

Error JSON único: {error: {code, message, requestId, fieldErrors?}}. requestId
lo genera el servidor y se repite en X-Request-Id; una cabecera entrante no se
considera autoridad ni se refleja sin validación. fieldErrors solo contiene
nombres de campos públicos y códigos, nunca valores recibidos.

| HTTP | code de base | Significado |
|---|---|---|
| 400 | INVALID_REQUEST | Entrada o JSON no válido |
| 401 | SESSION_REQUIRED | Sesión ausente, caducada o revocada |
| 403 | ORIGIN_REJECTED / CSRF_REJECTED | Mutación no autorizada |
| 404 | NOT_FOUND | Ruta o recurso inaccesible |
| 413 | PAYLOAD_TOO_LARGE | Cuerpo excede 64 KiB |
| 415 | UNSUPPORTED_MEDIA_TYPE | Tipo de cuerpo no admitido |
| 429 | RATE_LIMITED | Límite operativo; Retry-After sin datos privados |
| 500 | INTERNAL_ERROR | Fallo inesperado redactado |
| 503 | DEPENDENCY_UNAVAILABLE | Dependencia necesaria no disponible |

Los códigos de acciones y DTO de juego se cierran en T3-01; esta tabla no
convierte endpoints futuros en alcance de fase 1. La creación de sesión local
se limita inicialmente a 10 intentos por minuto por dirección de conexión,
sin confiar en cabeceras reenviadas; contador acotado en proceso suficiente para
la base de un solo proceso. No se presenta como defensa pública distribuida.

### Contraseñas: calibración de referencia

Librería seleccionada: argon2 0.45.1 (node-argon2, MIT). Evaluada con Node
24.22.1 portable en Windows x64, sin cambiar Node global ni WSL. La ejecución
real con datos sintéticos validó hash/verify, contraseña incorrecta, sales
aleatorias distintas de al menos 16 bytes, PHC Argon2id v19, salida de 32 bytes,
rechazo de PHC malformado y dos operaciones simultáneas.

| Memoria KiB | Iteraciones | Mediana hash / verify | Máximo hash / verify |
|---|---|---|---|
| 19456 | 2 | 68,3 / 66,1 ms | 91,2 / 74,7 ms |
| 19456 | 3 | 112,9 / 110,0 ms | 175,1 / 144,2 ms |
| 65536 | 3 | 551,0 / 456,2 ms | 944,0 / 653,5 ms |

Nueve muestras por perfil, tras calentamiento; parallelism=1 en todos. Selección
de referencia: **Argon2id, memoryCost=65536 KiB, timeCost=3, parallelism=1,
hashLength=32**, dejando que la librería genere la salt. Ofrece más memoria que
el mínimo ensayado y todas las muestras individuales quedaron bajo un segundo
en esta máquina. No usar una salt fija, añadir pepper casero ni implementar PHC
a mano. Guardar la cadena PHC completa y usar hash/verify/needsRehash de la librería.

Concurrencia de referencia: máximo dos operaciones Argon2 activas por proceso;
sin cola ilimitada. Presupuestar al menos 256 MiB de memoria del proceso y medir
bajo carga antes de habilitar login. El máximo RSS observado fue 172536 KiB
(~168,5 MiB), acumulado para el proceso de prueba, no memoria atribuible solo
al hash. Dos hashes simultáneos del perfil elegido tardaron 449,0 ms en una
sola muestra; la carga variable impide inferir escalado o capacidad pública.

El login sigue fuera de fase 1. Para su futura integración se propone limitar
antes del hash a 5 intentos/15 minutos por identificador normalizado y 20/15
minutos por dirección fiable; respuesta genérica sin enumeración y sin bloqueo
permanente de cuenta. Estos límites y la concurrencia se vuelven a evaluar en
T3-01 o E7-01 según el modo habilitado; no son controles ya implementados.

Ubuntu 20.04 no pudo cargar el precompilado (requiere GLIBC_2.34; hay 2.31) ni
compilarlo con su g++ actual (-std=gnu++20). Esa limitación no se declara resuelta:
antes de habilitar contraseñas en Linux debe validarse un entorno compatible y
repetirse la calibración allí. La base local de fase 1 usa sesión sin contraseña.
La distribución pública requiere medición propia, no hereda estas latencias.

Medidas completas y método: [evidencia de T1-01](../quality/T1-01-evidencia.md)
y [resultado JSON](../quality/evidence/T1-01-argon2-windows.json).

Fuentes consultadas: [node-argon2](https://github.com/ranisalt/node-argon2),
[versiones de la librería](https://github.com/ranisalt/node-argon2/releases) y
[guía de almacenamiento de contraseñas](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

## Superficie API prevista por fases

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
| POST /runs | caseId validado y accesible | PlayerView inicial |
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

Error público: code estable, message segura, requestId y fieldErrors opcionales sin eco de secretos. 400 estructura inválida; 401 sin sesión; 404 recurso ausente/no autorizado; 409 versión/clave/estado conflictivo; 422 snapshot incompatible; 429 cuota; 503 dependencia necesaria no disponible. Un preview válido ambiguo o imposible responde 200 con kind clarification/impossible y sin efectos. El [contrato de juego](API-juego.md) fija códigos y recuperación sin alternativas de interpretación.

Límites iniciales propuestos: texto de orden 4.000 caracteres; lote máximo ocho pasos; cuerpo normal 64 KiB; paginación 25 por defecto y 100 máximo. Importación tiene límites separados en SPEC-007. Ajustar solo mediante cambio documentado y pruebas.

## Preview y confirmación

Preview no cambia hechos ni reloj. Token opaco en servidor vinculado a usuario, partida, versión y plan normalizado; caduca a los 5 minutos de reloj real. Un preview caducado o versión cambiada exige recalcular. El token no contiene solución. Una consulta gratuita puede ejecutarse sin confirmación si no tiene consecuencias irreversibles; toda acción con coste o consecuencias requiere confirmación.

La interpretación IA ocurre antes de ejecutar. Si es ambigua, preguntar sin ejecutar parcialmente. El lote confirma estimaciones; ante imposibilidad contextual se aplica SPEC-001. Mostrar consecuencias conocidas de irregularidades sin revelar qué resolverá el caso.

## Escritura y recuperación

Transacción: comprobar sesión/permisos, cargar versión, reclamar idempotencyKey, aplicar motor, guardar estado/eventos/resultado. Guardar clave y carga normalizada o digest; clave única por partida. Reintento idéntico devuelve resultado lógico persistido sin avanzar reloj; otra carga produce 409. Conservar claves y resultados durante la vida del guardado. Lectura previa del cliente no sustituye el control atómico.

Narración se solicita tras commit. Si falla, resultado factual; no rollback de acción ya ejecutada. En reinicio con acción en vuelo, el cliente consulta partida o reintenta misma clave. Finalización y actualización de carrera deberán ser idempotentes, con un evento de recompensa único.

## Aceptación

ACC-013/014/015/018/020/021/024. T1-01 debe comprobar disponibilidad de librerías y fijar parámetros de autenticación antes de código. Pruebas de dos usuarios, sesión revocada, token de preview viejo, CSRF, doble pestaña, fallo antes/después de commit y mismo ID con otra carga. No se utilizarán credenciales reales en fixtures.

## Registro, modalidad y guardados: decisiones de producto

DEC-013 confirma cuentas registradas y elección de caso para el producto local y VPS. Cada partida pertenece a un único usuario y tiene un detective jugador. Sin endpoints de participación multijugador. El perfil técnico de desarrollo descrito arriba es exclusivamente una herramienta de pruebas/desarrollo, no el sistema de cuentas del producto terminado.

DEC-014 requiere autoguardado y guardado manual desde el primer caso jugable. T3-02 debe concretar sus DTO, operaciones de creación/listado/carga y errores con autorización por recurso, versión e idempotencia. Un cliente no fija ownerId ni sustituye el estado autoritativo por un JSON arbitrario. DEC-017 permite volver a un punto anterior del mismo caso. La carga requiere autorización, control de concurrencia y protección frente a reintentos; no reinicia el registro de recompensas concedidas. DEC-020 fija el primer resultado definitivo para carrera y reputación; persistirlo con unicidad y conservarlo ante cargas, nuevas partidas idénticas y reintentos.

DEC-016 obliga a aclarar la orden ambigua antes de generar un plan ejecutable. No hay avance de reloj, cambios de estado ni ejecución parcial mientras falte esa decisión.

## Contrato de integración T3 desarrollado

[API de juego](API-juego.md) concreta DTO por campo, parámetros de acciones, rutas, tokens, errores y precedencia de idempotencia; [guardados](GUARDADOS.md) concreta snapshots y carga. Estos anexos son la referencia detallada para T3 y resuelven el catálogo preliminar de esta spec. No implican endpoints implementados.

La versión HTTP de concurrencia pertenece al agregado persistido y no se copia del snapshot interno del motor al restaurar. Narración, memoria y eventos se vinculan a rama/operación. Los esquemas ejecutables se implementarán una sola vez en contratos/validación; no mantener dos validadores divergentes por frontend y backend.

Las pruebas previstas se desglosan en [aceptación T3](../quality/T3-aceptacion-detallada.md), con distinción explícita entre contrato y ejecución.
