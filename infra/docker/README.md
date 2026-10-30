# Despliegue con Docker Compose

## Requisitos previos

- Docker Engine 24+ y Docker Compose v2+
- pnpm 9+ (para desarrollo local sin Docker)
- Node.js 22+ (para desarrollo local)
- PostgreSQL 16+ (si no usas Docker)

## Desarrollo local (recomendado)

```bash
# Instalar dependencias
pnpm install

# Levantar solo PostgreSQL
docker compose -f infra/docker/docker-compose.yml up -d postgres

# Ejecutar migraciones
pnpm --filter @meridiano/api db:migrate

# Iniciar API y Web en terminales separadas
pnpm --filter @meridiano/api dev
pnpm --filter @meridiano/web dev
```

## Desarrollo completo con Docker Compose

```bash
# Copiar variables de entorno
cp infra/docker/.env.example .env
# Editar .env si necesario (OLLAMA_URL, etc.)

# Levantar todo
docker compose -f infra/docker/docker-compose.yml up -d

# Ver logs
docker compose -f infra/docker/docker-compose.yml logs -f

# Parar
docker compose -f infra/docker/docker-compose.yml down
```

### Servicios

| Servicio | Puerto | Descripción |
|----------|--------|-------------|
| postgres | 5432 | Base de datos PostgreSQL |
| api | 3000 | API Fastify (backend) |
| web | 5173 | Frontend Vite (React) |

### Variables de entorno (.env)

| Variable | Descripción | Valor por defecto |
|----------|-------------|-------------------|
| `POSTGRES_PASSWORD` | Contraseña de PostgreSQL | `meridiano_dev` |
| `OLLAMA_URL` | URL de Ollama local | `http://host.docker.internal:11434` |
| `OLLAMA_MODEL` | Modelo Ollama a usar | `llama3.1:8b` |
| `SESSION_SECRET` | Secreto para sesiones | **Cambiar en producción** |
| `CSRF_SECRET` | Secreto CSRF | **Cambiar en producción** |

> **Nota**: En Linux nativo (no Docker Desktop), `host.docker.internal` no existe. Usa la IP del host Docker (`172.17.0.1` habitualmente) o configura `--add-host=host.docker.internal:host-gateway` en `docker run`.

## Producción (autoalojado)

```bash
# Generar secretos seguros
openssl rand -hex 32  # para SESSION_SECRET
openssl rand -hex 32  # para CSRF_SECRET

# Configurar .env.production con:
# - POSTGRES_PASSWORD seguro
# - SESSION_SECRET, CSRF_SECRET generados
# - OLLAMA_URL apuntando a tu proveedor IA
# - DATABASE_URL con conexión externa si usas DB gestionada
# - NODE_ENV=production

docker compose -f infra/docker/docker-compose.yml --env-file .env.production up -d
```

### Consideraciones de producción

1. **Proxy TLS**: Usa nginx/Traefik/Caddy delante para HTTPS, rate limiting y headers de seguridad.
2. **Base de datos**: PostgreSQL gestionado (RDS, Cloud SQL, Neon) o instancia dedicada con backups automáticos.
3. **IA**: Configura tu propio endpoint Ollama/LM Studio/OpenAI-compatible; la instancia pública usa FreeLLMAPI.
4. **Volúmenes**: `postgres_data` persiste datos; configura backups periódicos (`pg_dump`).
5. **Health checks**: Los contenedores incluyen health checks; configura alertas en tu monitorización.
6. **Secretos**: Nunca commits `.env.production`; usa gestor de secretos (Docker secrets, HashiCorp Vault, etc.).

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
|----------|----------|
| `MIGRATION_CONNECTION_FAILED` | Verifica que PostgreSQL está healthy (`docker compose ps`) y `DATABASE_URL` correcta |
| `OLLAMA_URL` no resuelve | En Linux: usa IP del host o `--add-host=host.docker.internal:host-gateway` |
| Puerto 5432/3000/5173 ocupado | Cambia `ports` en `docker-compose.yml` o para el servicio que lo usa |
| Permisos en volúmenes | `docker compose run --rm api chown -R node:node /app` |

## Arquitectura de contenedores

```
┌─────────────────────────────────────────────────────────────┐
│                        Docker Host                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐          │
│  │   Postgres  │  │    API      │  │    Web      │          │
│  │   :5432     │←─│   :3000     │←─│   :5173     │          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
│        ▲               ▲               ▲                      │
│        │               │               │                      │
│        └───────────────┴───────────────┘                      │
│                    Volumen: postgres_data                      │
└─────────────────────────────────────────────────────────────┘
```

El API y Web montan el código fuente como volumen en desarrollo para hot-reload. En producción usan imágenes preconstruidas (`builder` stage).