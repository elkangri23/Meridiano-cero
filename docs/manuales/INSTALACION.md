# Puesta en funcionamiento prevista

Actualización 2026-10-28: la base local de fase 1 ya está implementada. Procedimiento actual y límites: [BASE-LOCAL](BASE-LOCAL.md). Los apartados de distribución/juego completo de este documento siguen siendo objetivos de sus fases.

Estado: guía de diseño. El proyecto todavía NO se puede arrancar como juego. Se convertirá en runbook probado en fases 1 y 6. No se proporciona URL ficticia de repositorio ni se afirma que un compose inexistente funciona.

## Desarrollo local

Requisitos futuros: runtime Node/pnpm con versiones fijadas, Docker Compose, espacio para PostgreSQL y un proveedor local compatible. Primero comprobar entorno y puertos; después configurar variables privadas, levantar DB, aplicar migraciones y arrancar API/web. Probar fixture antes de integrar modelo.

Ollama se ejecutará preferentemente fuera de Docker. Desde contenedores habrá que comprobar la dirección del host: host.docker.internal puede servir en Docker Desktop y requerir configuración distinta en Linux. No abrir el proveedor local a Internet para resolver conectividad.

Validación de arranque: health/readiness correctos, DB migrada, usuario local de prueba seguro, fixture accesible y preferencias persistidas tras reinicio. Prueba de modelo separada de calidad de generación.

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

El futuro comando `docker compose up -d` no sustituye la configuración de secretos, HTTPS, proveedor y datos persistentes. No ejecutar aún: no existe archivo de distribución.

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

Son nombres contractuales propuestos; la fase 1 los materializa en esquema de configuración y ejemplo. No pegar claves en archivos públicos.

## VPS público

No desplegarlo antes de fase 7. Requiere cuenta/recuperación, TLS, DB privada, backups, alertas, límites, proveedor verificado, información de privacidad y revisión de seguridad. Jugadores no aportan API. Los endpoints arbitrarios de jugadores permanecen deshabilitados inicialmente.

## Comprobación de independencia

Probar instalación nueva sin acceso al VPS del creador. Configurar proveedor propio, iniciar/reanudar partida y exportar/importar un caso validado. Ausencia de cuenta central o telemetría obligatoria. Registrar versión, entorno y resultados; no darlo por hecho por usar Docker.

## Lo que debe acompañar la primera distribución

URL real del repositorio/release, versiones soportadas, ejemplo sin secretos, Compose probado, pasos de migración/bootstrap, health, actualización, backup/restore, licencias y diagnóstico. Esta guía se actualizará con comandos y salidas verificados al existir esos artefactos.
