# Puesta en funcionamiento prevista

Actualizado: 2026-10-28. Hay base ejecutable y Compose de desarrollo; todavía no hay distribución del juego completa ni instalación independiente aceptada. [Estado y bloqueos](../plan/ESTADO.md). Esta guía separa lo disponible de los procedimientos futuros.

## Desarrollo local disponible

El [manual de desarrollo](DESARROLLO.md) recoge versiones, copia segura de .env y arranque web/API. El prototipo /prototype y la evaluación mock funcionan sin modelo real; no son el juego completo.

Existe docker-compose.yml con servicios db/api/web y volumen pgdata. Para iniciar solo PostgreSQL durante desarrollo, el comando definido es:

~~~text
docker compose up -d db
~~~

Esta actualización documental no ejecuta Docker, migra ni altera volúmenes. Antes de usarlo, revisar almacenamiento y puertos del entorno propio. Los usuarios/passwords del ejemplo son sintéticos de desarrollo.

No anunciar aún un arranque completo reproducible: el servicio api usa API_HOST=0.0.0.0 y el código actual exige 127.0.0.1. Hay esquema Drizzle y SQL inicial, pero no script db:migrate ni ensayo de migración/reinicio acreditado en este avance. Readiness comprueba conectividad con SELECT 1, sin verificar migraciones.

Sesiones, usuario local de juego, fixture accesible por HTTP y preferencias persistidas no están conectados. [Evaluación IA](IA-LOCAL.md) distingue sondeo y calidad real. El adaptador actual solo admite origen literal 127.0.0.1; la futura conectividad desde contenedores se diseñará sin abrir el proveedor a Internet.

## Autoalojamiento con Docker

Objetivo: distribución con imágenes/versiones fijadas y compose de web/API/DB/worker cuando corresponda. El usuario de distribución no necesita pnpm.

Secuencia prevista:
1. Obtener una versión publicada con procedencia e integridad verificables.
2. Leer requisitos/notas y preparar almacenamiento persistente.
3. Copiar el ejemplo de configuración cuando exista y definir secretos únicos, origen y proveedor.
4. Configurar HTTPS si se accede por red.
5. Aplicar migraciones de forma controlada.
6. Ejecutar arranque Compose y comprobar health/readiness.
7. Crear primer administrador mediante bootstrap de un uso.
8. Mantener registro cerrado o activarlo conscientemente.
9. Ejecutar test de proveedor y caso fijo.
10. Crear backup y probar restauración antes de uso importante.

El Compose de desarrollo presente no sustituye al futuro paquete de distribución. El arranque autoalojado completo exige resolver configuración, secretos, HTTPS, migraciones y persistencia; no se presenta como un procedimiento probado.

## Variables previstas

| Variable | Uso | Requisito |
|---|---|---|
| APP_MODE | development, self-hosted o public | Explícita; público rechaza bypass local |
| PUBLIC_ORIGIN | Origen de navegador/API | Verificado; HTTPS en público |
| DATABASE_URL | Conexión PostgreSQL | Privada; mínimos privilegios |
| SESSION_SECRET | Material secreto de sesiones | Único; no ejemplo fijo |
| REGISTRATION_ENABLED | Registro permitido | Desactivado por defecto en privado |
| AI_PROVIDER / AI_MODEL | Proveedor y modelo | Configurados y probados |
| AI_BASE_URL | Endpoint | Política de destinos según modo |
| AI_API_KEY | Credencial si se necesita | Solo servidor |
| Clave de cifrado separada | Cifrado de credenciales guardadas | Requerida solo al habilitar esa capacidad |

La tabla describe configuración objetivo. APP_MODE, API_HOST/API_PORT, PUBLIC_ORIGIN, DATABASE_URL y las banderas de sesión/registro tienen validación inicial; las demás capacidades siguen propuestas. La CLI IA actual usa OLLAMA_ORIGIN y --model, no AI_PROVIDER/AI_MODEL. No pegar claves en archivos públicos.

## VPS público

No desplegarlo antes de fase 7. Requiere cuenta/recuperación, TLS, DB privada, backups, alertas, límites, proveedor verificado, información de privacidad y revisión de seguridad. Jugadores no aportan API. Los endpoints arbitrarios de jugadores permanecen deshabilitados inicialmente.

## Comprobación de independencia

Probar instalación nueva sin acceso al VPS del creador. Configurar proveedor propio, iniciar/reanudar partida y exportar/importar un caso validado. Ausencia de cuenta central o telemetría obligatoria. Registrar versión, entorno y resultados; no darlo por hecho por usar Docker.

## Lo que debe acompañar la primera distribución

URL real del repositorio/release, versiones soportadas, ejemplo sin secretos, Compose probado, pasos de migración/bootstrap, health, actualización, backup/restore, licencias y diagnóstico. Esta guía se actualizará con comandos y salidas verificados al existir esos artefactos.
