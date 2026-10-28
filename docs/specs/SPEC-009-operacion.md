# SPEC-009 Desarrollo, instalación y recuperación

Estado: contrato operativo detallado propuesto; comandos en manuales aún no implementados.
Fuentes: TAD §4/9/13–15; GDD §16/17/19. ADR-004/008.

## Perfiles

Development: Vite y API en host o Compose, PostgreSQL en Compose y Ollama en host. Solo loopback para servicios de prueba. Perfil de prueba explícito sin credencial universal. Semillas/fixtures ficticios.

Self-hosted: web, API, DB y worker desde fase 4; proxy HTTPS recomendado. Primer administrador por bootstrap de un uso; registro deshabilitado por defecto y activable por administrador. El juego funciona con proveedor propio sin llamar a infraestructura del creador.

Public: proxy TLS, registro obligatorio, cookies seguras, IA de instalación, cuotas, backups y alertas. Rechazar arranque con claves ausentes, modo local o configuración de endpoints inseguros.

No hay worker vacío en fase 1. No hay Kubernetes, Redis ni telemetría obligatoria. No requerir pnpm a quien usa imágenes Docker de distribución.

## Configuración y secretos

Contrato de variables a implementar, no archivo existente: APP_MODE, PUBLIC_ORIGIN, DATABASE_URL, SESSION_SECRET, REGISTRATION_ENABLED, AI_PROVIDER, AI_BASE_URL, AI_MODEL y AI_API_KEY opcional según proveedor. Añadir clave separada de cifrado al guardar credenciales de usuario. Validación al arrancar y valores de ejemplo sin secretos.

AI_BASE_URL local puede apuntar a Ollama en host por política de administrador. En Docker Desktop host.docker.internal es candidato sujeto a comprobación; no imponerlo a Linux. No desactivar controles públicos para soportar localhost privado.

Versiones concretas de Node, pnpm, PostgreSQL, imágenes y dependencias se fijan en fase 1 contra documentación vigente y se conservan en lockfile/manifiestos. Las guías no deben publicar comandos que dependan de latest sin revisión.

## Concreción de la base: T1-01

Fecha: 2026-10-28. Contrato para implementación posterior; no instala herramientas
ni anuncia comandos disponibles. La configuración del producto será independiente de las herramientas de desarrollo.

### Versiones y entorno

| Componente | Base seleccionada / estado | Verificación exigida |
|---|---|---|
| Node | 24.22.1 LTS | Observado en Ubuntu; fijar versión del proyecto en T1-02 |
| pnpm | 12.15.0 | Observado; packageManager exacto y lockfile en T1-02 |
| Git | 2.50.1 observado | Reutilizar repo y remoto; no reinicializar Git |
| PostgreSQL | 18.6, rama 18 soportada | Comprobar imagen oficial y digest antes de Compose en T1-03 |
| Fastify | 5.12.7, MIT | API; prueba sintética separada del producto |
| React / react-dom | 19.3.1 / 19.3.1, MIT | Interfaz; mantener ambas versiones iguales |
| Vite | 8.3.5, MIT | Dev/build web; Node 24 satisface engines |
| TypeScript | 7.0.2, Apache-2.0 | Compilación estricta; verificar binario nativo en Ubuntu |
| drizzle-orm / drizzle-kit | 0.45.4 Apache-2.0 / 0.31.11 MIT | Consultas tipadas / migraciones explícitas |
| pg | 8.23.1, MIT | Cliente PostgreSQL sin pg-native; peer de Drizzle >=8 |
| Docker | CLI 26.1.3 observado | No demuestra daemon accesible ni versión admitida definitiva |
| Compose | Subcomando docker compose ausente en Ubuntu | Bloqueo de entorno para T1-03; no instalar como efecto de esta tarea |
| Ollama | Ejecutable no localizado en PATH de Ubuntu | No demuestra ausencia en Windows; necesario evaluar en T3-01 |

La selección no actualiza Ubuntu ni Docker. Docker Desktop figuraba detenido
en el inventario WSL; no se ha arrancado para esta tarea. La ausencia de Compose
no bloquea redactar contratos, pero impide afirmar un arranque reproducible real.
Las versiones son selección exacta para la base, no un lockfile ya implementado.
La prueba conjunta y sus límites se registran en la evidencia de T1-01.
El gestor elegido para el producto se fijará en sus manifiestos.

Fuentes oficiales consultadas el 2026-10-28:
[Node](https://github.com/nodejs/node/releases),
[pnpm](https://pnpm.io/installation),
[registro de pnpm](https://registry.npmjs.org/pnpm/latest),
[Fastify LTS](https://github.com/fastify/fastify/blob/main/docs/Reference/LTS.md) y
[soporte PostgreSQL](https://www.postgresql.org/support/versioning/).

### Variables de la base

Validar toda la configuración antes de conectar DB, crear identidad o escuchar.
No transformar valores inválidos en defaults. Los ejemplos futuros usan
placeholders reconocibles y nunca secretos universales. `.env` real queda fuera
de Git; T1-02 debe añadir reglas de exclusión antes de generar cualquier archivo.

| Variable | Contrato |
|---|---|
| APP_MODE | Obligatoria: development, self-hosted o public; sin valor implícito |
| API_HOST | Obligatoria; 127.0.0.1 en base local con bypass |
| API_PORT | Entero 1..65535; 3000 propuesto para ejemplo local, fallo si ocupado |
| PUBLIC_ORIGIN | Origen único sin credenciales, ruta, query ni fragmento; HTTP solo development loopback; HTTPS obligatorio en public |
| LOCAL_DEV_AUTH_ENABLED | Obligatoria, booleano explícito, sin default; true solo bajo las tres condiciones de SPEC-004 |
| DATABASE_URL | Obligatoria, PostgreSQL; nunca incluirla en respuestas ni errores |
| SESSION_SECRET | Obligatorio, al menos 32 bytes aleatorios codificados en base64; independiente de credenciales de desarrollo |
| REGISTRATION_ENABLED | Booleano, false por defecto; no habilitar registro en fase 1 aunque se configure true: rechazar capacidad no implementada |

AI_PROVIDER/AI_BASE_URL/AI_MODEL/AI_API_KEY no son requisitos de arranque de la
base sin consumidor IA. Se validarán al habilitar esa capacidad, sin reutilizar
tokens ni direcciones del equipo de desarrollo. Self-hosted/public son valores
del contrato global, pero el ejecutable de fase 1 debe rechazarlos como modo aún
no soportado; sus validaciones quedan previstas para futuras fases.

Orden del fallo: parseo y modo soportado → coherencia de origen/bypass → secretos
→ conexión y versión de esquema → readiness. Mensaje de consola con código y
nombre de variable, nunca valor/URL completa ni dump de process.env. Salida no
cero y ningún listener ante configuración inválida.

### Persistencia y migraciones de base

T1-03 creará tablas mínimas de perfiles/sesiones y registro de migraciones.
No crear tablas del juego o jobs por anticipado. Drizzle genera SQL revisable;
una orden explícita de migración, sin push de esquema al arrancar API, aplica
cambios en una sola ejecución protegida contra concurrencia. Credencial de
migración separable de la de API; ambas sintéticas y privadas en pruebas.

PostgreSQL en volumen persistente. Si API está en host, el puerto de DB solo se
publica en 127.0.0.1; si comparte red Compose, no publica puerto de host. No usar
0.0.0.0, borrar volúmenes ni cambiar un volumen de major como solución rápida.
Migración fallida deja ready=503; esquema futuro/incompatible no se modifica
automáticamente. Health de proceso no equivale a esquema listo.

### Prueba prevista de arranque

| Escenario | Resultado esperado | Evidencia pendiente |
|---|---|---|
| public con LOCAL_DEV_AUTH_ENABLED=true | Fallo antes de DB/listener; sin crear perfil | Prueba negativa T1-03, ACC-024 |
| development con bypass y host 0.0.0.0, localhost o ::1 | Fallo cerrado | Pruebas parametrizadas T1-03 |
| Origin externo o ausente al crear sesión local | 403 sin sesión/cookie | Integración ACC-020 |
| SESSION_SECRET ausente/mal codificado o DB URL inválida | Salida no cero sin revelar valor | ACC-024/039 |
| DB caída o migración pendiente | health=200, ready=503 si el proceso ya arrancó | ACC-039 |
| Migrar, crear perfil/sesión, reiniciar conservando volumen | Mismo perfil; sesión válida hasta expiración/revocación | ACC-039 |
| Perfil local y registro público solicitado | Rechazo de configuración | ACC-024 |

Las pruebas de esta tabla no se han ejecutado: aún no hay aplicación ni Compose
del producto. Un fallo inicial de DB puede mantener el proceso vivo sin ready;
un fallo de configuración siempre lo termina. Aplicar en T1-03 el contrato de
conexión y reintentos siguiente.

## Comandos previstos por fase

pnpm dev, pnpm build, pnpm typecheck, pnpm lint, pnpm test y pnpm test:e2e se implementarán como superficie coherente. Scripts de migración explícitos, backup/restore y health se documentarán con salidas reales. Docker Compose de distribución deberá arrancar tras configurar secretos/proveedor; no prometer cero configuración.

El setup valida entorno, conexión DB, migraciones, primer administrador y proveedor. Crear el administrador no autoriza automáticamente registro público ni exposición de puertos. README incluirá requisitos, actualización y diagnóstico.

## Datos y migraciones

Volumen persistente PostgreSQL; cambios de esquema versionados y revisados. Copia antes de migración de producción. Una única tarea controlada aplica migraciones; web/API no compiten al arrancar para cambiar esquema.

Actualizar: fijar versión, leer notas, backup, validar compatibilidad de schema/motor, aplicar migración, health y smoke test. Si migración irreversible falla, restaurar copia en instancia separada y comprobar antes de cambiar tráfico. No prometer downgrade binario sobre DB ya migrada.

Backups incluyen DB y referencias a versiones/configuración no secreta; secretos se conservan por canal separado protegido. Backup cifrado, acceso mínimo y prueba periódica de restauración. Retención y RPO/RTO se fijan con recursos reales en fase 6; la prueba debe medirlos, no inventarlos.

## Autoría, licencias y publicación

Antes de distribuir: LICENSE AGPL-3.0-only del código, NOTICE, AUTHORS, CONTRIBUTING, créditos y enlace a código correspondiente. Confirmar atribución exacta. Inventario de dependencias, arte, música y fuentes con licencias; assets originales sin copiar marcas/personajes protegidos. No afirmar que AGPL exige enviar mejoras al repositorio original ni que garantiza créditos idénticos en todos los forks.

## Aceptación

ACC-024/026/032/035/039. Probar instalación en entorno limpio distinto al desarrollo, proveedor propio, sin acceso al VPS creador, reinicio, migración, restauración y claves ausentes. Manuales: [desarrollo](../manuales/DESARROLLO.md), [instalación](../manuales/INSTALACION.md), [operación](../manuales/OPERACION.md).

## Plazos de conexión de la base

Pool pg: máximo 5 conexiones por proceso de desarrollo, connectionTimeoutMillis
2000 e idleTimeoutMillis 30000. No multiplicar el máximo sin presupuesto de DB.
Readiness ejecuta SELECT 1 y comprueba versión de migración con timeout de
consulta de 2000 ms; respuesta completa acotada a 5000 ms. Llamadas simultáneas
reutilizan una comprobación en curso; no crean pools ni conexiones ilimitadas.
Sin reintento interno dentro de una petición de readiness. Un sondeo posterior
puede recuperar ready al volver DB. No ejecutar migraciones desde ese sondeo.

Al arrancar, DB inaccesible no inventa una sesión ni ejecuta semillas; API puede
atender health con ready=503. Una operación de migración explícita intenta conectar
hasta 3 veces, cada una con límite de 2 s y pausas de 1 s y 2 s; después falla sin
borrar datos. Solo reintenta conexión anterior al SQL: no reejecuta ciegamente una
migración cuyo commit resulte ambiguo. T1-03 probará estos límites y la exclusión
mutua del migrador. No confundir timeouts de operación con minutos del juego.

## Inventario de dependencias seleccionado

No se añaden paquetes por este documento. Cada dependencia tiene consumidor:
React/react-dom y Vite en web; Fastify en API; pg y drizzle-orm en persistencia API;
drizzle-kit en migración; TypeScript en comprobación de tipos. Argon2 se incorpora
cuando exista login con contraseña, no como paquete vacío en fase 1. Lockfile y
manifiestos exactos se producirán y validarán en T1-02; el generador de migraciones
entra en T1-03. No se adoptan versiones rc de Drizzle desde ejemplos de la web.

Alternativas descartadas: Redis para sesiones (PostgreSQL ya resuelve persistencia),
pg-native (añade compilación sin necesidad demostrada), SQLite (diverge del stack),
ORM genérico propio (duplica Drizzle) y un framework de auth completo para un único
perfil local. Dependencias transitivas de build de drizzle-kit emiten avisos de
obsolescencia; deben revisarse en el análisis de dependencias de T1-04, sin afirmar
que ausencia de errores de instalación signifique ausencia de vulnerabilidades.

Metadatos de selección (2026-10-28):
[React](https://registry.npmjs.org/react/latest),
[react-dom](https://registry.npmjs.org/react-dom/latest),
[Vite](https://registry.npmjs.org/vite/latest),
[TypeScript](https://registry.npmjs.org/typescript/latest),
[Fastify](https://registry.npmjs.org/fastify/latest),
[Drizzle ORM](https://registry.npmjs.org/drizzle-orm/latest),
[Drizzle Kit](https://registry.npmjs.org/drizzle-kit/latest) y
[pg](https://registry.npmjs.org/pg/latest).
Los enlaces latest son fuentes de consulta, no comandos de instalación;
las versiones elegidas arriba permanecen fijas aunque cambien esas etiquetas.

## Compatibilidad observada del stack

En una carpeta temporal de Ubuntu 20.04 con Node 24.22.1 se instalaron las
versiones exactas de la tabla y se ejecutaron: respuesta Fastify con inject sin
listener, render estático React, build Vite de una página sintética y generación
de SQL con Drizzle/pg sin abrir conexión. Todos pasaron. tsc --version confirmó
7.0.2 y drizzle-kit --version confirmó Kit 0.31.11 / ORM 0.45.4. Esto no demuestra
tipado de la aplicación, migraciones reales, persistencia ni funcionamiento UI.

Argon2 no pudo cargarse ni compilarse en ese entorno. El proyecto no declara
Ubuntu 20.04 como entorno completo validado. La calibración queda pendiente de un
entorno compatible. No se realizará ninguna instalación o actualización de WSL
como parte de la limpieza del proyecto. No se bajan versiones ni parámetros
para esconder el fallo.
