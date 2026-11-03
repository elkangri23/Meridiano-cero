# Instalación de Meridiano-cero

Fecha de actualización: 2026-10-31. Documento para instalación local y Docker.

## Requisitos

- Node.js 22+
- pnpm 9+
- Docker Engine 24+ y Docker Compose v2+
- PostgreSQL 16+ (si no usas Docker)

## Desarrollo local recomendado

1. Instalar dependencias:

```bash
pnpm install
```

2. Levantar solo PostgreSQL:

```bash
docker compose -f infra/docker/docker-compose.yml up -d postgres
```

3. Aplicar migraciones:

```bash
pnpm --filter @meridiano/api db:migrate
```

4. Iniciar API y Web en terminales separadas:

```bash
pnpm --filter @meridiano/api dev
pnpm --filter @meridiano/web dev
```

La web queda en http://localhost:5173 y la API en http://localhost:3000.

## Desarrollo completo con Docker Compose

1. Copiar variables de entorno:

```bash
cp infra/docker/.env.example .env
```

2. Editar `.env` si es necesario (OLLAMA_URL, etc.).
3. Levantar todo:

```bash
docker compose -f infra/docker/docker-compose.yml up -d
```

4. Ver logs:

```bash
docker compose -f infra/docker/docker-compose.yml logs -f
```

### Servicios

| Servicio | Puerto | Descripción |
|---|---|---|
| postgres | 5432 | Base de datos PostgreSQL |
| api | 3000 | API Fastify (backend) |
| web | 5173 | Frontend Vite (React) |

### Variables de entorno (.env)

| Variable | Descripción | Valor por defecto |
|---|---|---|
| POSTGRES_PASSWORD | Contraseña de PostgreSQL | meridiano_dev |
| OLLAMA_URL | URL de Ollama local | http://host.docker.internal:11434 |
| OLLAMA_MODEL | Modelo Ollama a usar | llama3.1:8b |
| SESSION_SECRET | Secreto para sesiones | Cambiar en producción |
| CSRF_SECRET | Secreto CSRF | Cambiar en producción |

## Producción (autoalojado)

1. Generar secretos seguros:

```bash
openssl rand -hex 32  # SESSION_SECRET
openssl rand -hex 32  # CSRF_SECRET
```

2. Configurar `.env.production` con POSTGRES_PASSWORD seguro, SESSION_SECRET, CSRF_SECRET, OLLAMA_URL apuntando a tu proveedor IA, DATABASE_URL con conexión externa si usas DB gestionada, y NODE_ENV=production.

3. Levantar:

```bash
docker compose -f infra/docker/docker-compose.yml --env-file .env.production up -d
```

### Consideraciones de producción

1. Proxy TLS: usa nginx/Traefik/Caddy delante para HTTPS, rate limiting y headers de seguridad.
2. Base de datos: PostgreSQL gestionado o instancia dedicada con backups automáticos.
3. IA: configura tu propio endpoint Ollama/LM Studio/OpenAI-compatible; la instancia pública usa FreeLLMAPI.
4. Volúmenes: `postgres_data` persiste datos; configura backups periódicos (`pg_dump`).
5. Health checks: los contenedores incluyen health checks; configura alertas en tu monitorización.
6. Secretos: nunca hagas commit de `.env.production`; usa gestor de secretos.

## Migraciones de base de datos

```bash
# Aplicar migraciones (idempotente)
pnpm --filter @meridiano/api db:migrate

# Ver migraciones aplicadas
docker exec -it meridiano-db psql -U meridiano -d meridiano -c "SELECT * FROM base_migrations;"
```

## Comandos útiles

```bash
# Reiniciar solo API tras cambios de código
docker compose -f infra/docker/docker-compose.yml restart api

# Shell en contenedor API
docker exec -it meridiano-api sh

# Shell en PostgreSQL
docker exec -it meridiano-db psql -U meridiano -d meridiano

# Limpiar todo (incluye volúmenes de datos)
docker compose -f infra/docker/docker-compose.yml down -v
```

## Solución de problemas

| Problema | Solución |
|---|---|
| MIGRATION_CONNECTION_FAILED | Verifica que PostgreSQL está healthy (`docker compose ps`) y `DATABASE_URL` correcta |
| OLLAMA_URL no resuelve | En Linux: usa IP del host o `--add-host=host.docker.internal:host-gateway` |
| Puerto 5432/3000/5173 ocupado | Cambia `ports` en `docker-compose.yml` o para el servicio que lo usa |
| Permisos en volúmenes | `docker compose run --rm api chown -R node:node /app` |
| docker compose up tarda mucho | El build inicial de imágenes puede tardar varios minutos; es normal |
