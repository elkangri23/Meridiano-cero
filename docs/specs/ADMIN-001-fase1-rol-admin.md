# ADMIN-001 — Fase 1: Rol de Administración (Base de Seguridad)

**Fecha:** 2026-11-12  
**Autor:** Antonio Moles  
**Estado:** Listo para implementar  
**Dependencias:** Ninguna (base del proyecto)  
**Hito objetivo:** Admin Dashboard funcional con control de acceso por rol

---

## Objetivo

Crear la infraestructura mínima para que un usuario con rol `admin` o `superadmin` pueda acceder a `/admin/*` y ver un dashboard funcional (aunque con datos vacíos o simulados) que respete el diseño visual de la web.

---

## Alcance

### Dentro del alcance
- Migración de base de datos para añadir ENUM `role` a `profiles`
- Middleware `requireAdmin` robusto usando `createAuthorizer` existente
- Registro de rutas de administración en `app.ts`
- Endpoint `GET /api/v1/admin/health` funcional
- Frontend: guard de ruta, layout y dashboard mínimo con tarjetas
- Tipos TypeScript compartidos para el panel de admin

### Fuera del alcance (fases posteriores)
- Métricas reales de uso/retención
- Gestión de usuarios/partidas
- Auditoría (`admin_audit_log`)
- Reinicios, backups, cuotas, sandbox IA, anonimización

---

## Especificación Técnica

### 1. Esquema de Base de Datos (`apps/api/src/database/schema.ts`)

```typescript
// Añadir al enum de roles existente o crear nuevo enum
export const roleEnum = pgEnum('role', ['player', 'admin', 'superadmin']);

// En la tabla profiles, añadir columna role:
profiles = pgTable('profiles', {
  // ... campos existentes
  role: roleEnum('role').notNull().default('player'),
  // ... resto de campos
});
```

**Migración SQL** (`apps/api/src/database/migrations/XXXX_add_role_enum.sql`):
```sql
-- Crear enum si no existe
DO $$ BEGIN
  CREATE TYPE role AS ENUM ('player', 'admin', 'superadmin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Añadir columna a profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role role NOT NULL DEFAULT 'player';
```

### 2. Middleware de Autorización (`apps/api/src/admin/middleware.ts`)

Reemplazar el stub actual por una implementación que use `createAuthorizer` (patrón existente en `ai-connections-routes.ts`, `game/routes.ts`):

```typescript
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AppConfig } from '../config.ts';
import type { Database } from '../database/connection.ts';
import { and, eq } from 'drizzle-orm';
import { profiles } from '../database/schema.ts';

export function createAdminAuthorizer(config: AppConfig, database: Database) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Verificar origen (coherente con auth existente)
    if (request.headers.origin !== config.origin) {
      return reply.code(403).send({ 
        error: { code: 'ORIGIN_REJECTED', message: 'Origen no permitido', requestId: request.id } 
      });
    }

    // Extraer token de sesión (cookie/header) - reutilizar lógica de session-security
    const { cookieToken } = await import('../session-security.ts');
    const token = cookieToken(request.headers.cookie);
    if (!token) {
      return reply.code(401).send({ 
        error: { code: 'SESSION_REQUIRED', message: 'Sesión requerida', requestId: request.id } 
      });
    }

    // Buscar perfil por tokenDigest y verificar rol
    const tokenHash = tokenDigest(token); // importar de session-security
    const profile = await database.orm.query.profiles.findFirst({
      where: and(
        eq(profiles.id, tokenHash),
        // Permitir admin y superadmin
        (profiles, { inArray }) => inArray(profiles.role, ['admin', 'superadmin'])
      ),
    });

    if (!profile) {
      return reply.code(403).send({ 
        error: { code: 'FORBIDDEN', message: 'Acceso denegado: se requiere rol admin', requestId: request.id } 
      });
    }

    // Adjuntar perfil a request para uso en handlers
    (request as any).adminProfile = profile;
    (request as any).isSuperadmin = profile.role === 'superadmin';
  };
}

// Helper para verificar superadmin en handlers que lo necesiten
export function requireSuperadmin(request: FastifyRequest, reply: FastifyReply) {
  if (!(request as any).isSuperadmin) {
    return reply.code(403).send({ 
      error: { code: 'SUPERADMIN_REQUIRED', message: 'Se requiere superadmin', requestId: request.id } 
    });
  }
  return null; // ok
}
```

### 3. Rutas de Administración (`apps/api/src/admin/routes.ts`)

Archivo limpio, solo endpoints de admin:

```typescript
import type { FastifyInstance } from 'fastify';
import type { AppConfig } from '../config.ts';
import type { Database } from '../database/connection.ts';
import { createAdminAuthorizer, requireSuperadmin } from './middleware.ts';

export function registerAdminRoutes(app: FastifyInstance, config: AppConfig, database: Database) {
  // Middleware global para todas las rutas /api/v1/admin/*
  app.addHook('onRequest', createAdminAuthorizer(config, database));

  // Health check - accesible para admin y superadmin
  app.get('/api/v1/admin/health', async () => ({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? 'unknown'
  }));

  // Placeholder para futuros endpoints - devuelven 501 con mensaje claro
  const notImplemented = (reply: any) => reply.code(501).send({ 
    error: { code: 'NOT_IMPLEMENTED', message: 'Endpoint no implementado en Fase 1' } 
  });

  app.get('/api/v1/admin/users', notImplemented);
  app.get('/api/v1/admin/runs', notImplemented);
  app.get('/api/v1/admin/metrics', notImplemented);
  app.get('/api/v1/admin/ai/metrics', notImplemented);
  app.get('/api/v1/admin/audit', notImplemented);
}
```

### 4. Registro en App Principal (`apps/api/src/app.ts`)

```typescript
// En createApp(), después de registrar rutas de juego/auth:
import { registerAdminRoutes } from './admin/routes.ts';

// Solo registrar si hay config.adminEnabled o siempre en desarrollo
if (config.adminEnabled ?? config.mode === 'development') {
  registerAdminRoutes(app, config, database);
}
```

### 5. Configuración (`apps/api/src/config.ts`)

Añadir `adminEnabled: boolean` al tipo `AppConfig` y leer de variable de entorno `ADMIN_ENABLED` (default: `true` en desarrollo, `false` en producción hasta validar).

### 6. Frontend - Tipos Compartidos (`apps/web/src/types/admin.ts`)

```typescript
export interface AdminProfile {
  id: string;
  alias: string | null;
  avatar: string | null;
  role: 'admin' | 'superadmin';
  emailVerified: boolean;
  createdAt: string;
}

export interface AdminDashboardMetrics {
  usersTotal: number;
  usersActive24h: number;
  runsTotal: number;
  runsActive: number;
  aiTokensUsed24h: number;
  aiErrorRate24h: number;
  // ... campos que se poblarán en Fase 2
}

export interface AdminRouteGuardResult {
  allowed: boolean;
  redirectTo?: string;
}
```

### 7. Frontend - Guard de Ruta (`apps/web/src/routes/AdminGuard.tsx`)

```tsx
import { useAuth } from '../hooks/useAuth.ts'; // o el hook de sesión existente
import { Navigate, Outlet } from 'react-router-dom';

export function AdminGuard() {
  const { profile, loading } = useAuth(); // Asume que useAuth expone profile con role

  if (loading) {
    return <div className="admin-loading">Cargando…</div>; // Estilo MS-DOS
  }

  if (!profile || !['admin', 'superadmin'].includes(profile.role)) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
```

### 8. Frontend - Layout de Admin (`apps/web/src/admin/AdminLayout.tsx`)

```tsx
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.ts';

export function AdminLayout() {
  const { profile } = useAuth();
  const location = useLocation();
  
  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: '📊' },
    { path: '/admin/users', label: 'Usuarios', icon: '👥' },
    { path: '/admin/runs', label: 'Partidas', icon: '🎮' },
    { path: '/admin/ai', label: 'IA', icon: '🤖' },
    { path: '/admin/audit', label: 'Auditoría', icon: '📋' },
  ];

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <div className="admin-brand">
          <span className="admin-logo">M₀</span>
          <span className="admin-title">Panel de Administración</span>
        </div>
        <div className="admin-user">
          <span>{profile?.alias ?? profile?.email}</span>
          <span className={`admin-role-badge role-${profile?.role}`}>
            {profile?.role === 'superadmin' ? 'SUPERADMIN' : 'ADMIN'}
          </span>
        </div>
      </header>
      
      <nav className="admin-sidebar">
        <ul>
          {navItems.map(item => (
            <li key={item.path}>
              <Link 
                to={item.path} 
                className={location.pathname === item.path ? 'active' : ''}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <main className="admin-main">
        <Outlet />
      </main>
      
      <footer className="admin-footer">
        <span>Meridiano-cero Admin v{import.meta.env.VITE_APP_VERSION}</span>
      </footer>
    </div>
  );
}
```

### 9. Frontend - Dashboard Mínimo (`apps/web/src/admin/DashboardPage.tsx`)

```tsx
import { useEffect, useState } from 'react';
import { adminApi } from '../api/client.ts'; // Extender cliente API
import type { AdminDashboardMetrics } from '../types/admin.ts';

export function DashboardPage() {
  const [metrics, setMetrics] = useState<AdminDashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        // En Fase 1: datos mock; en Fase 2: llamada real
        const data = await adminApi.getDashboardMetrics(); // mock por ahora
        setMetrics(data);
      } catch (e) {
        setError('No se pudieron cargar las métricas');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="admin-loading">Cargando dashboard…</div>;
  if (error) return <div className="admin-error">{error}</div>;

  const cards = [
    { label: 'Usuarios totales', value: metrics?.usersTotal ?? '—', icon: '👥' },
    { label: 'Activos (24h)', value: metrics?.usersActive24h ?? '—', icon: '🟢' },
    { label: 'Partidas totales', value: metrics?.runsTotal ?? '—', icon: '🎮' },
    { label: 'Partidas activas', value: metrics?.runsActive ?? '—', icon: '▶️' },
    { label: 'Tokens IA (24h)', value: metrics?.aiTokensUsed24h?.toLocaleString() ?? '—', icon: '🔤' },
    { label: 'Errores IA (24h)', value: `${metrics?.aiErrorRate24h ?? '—'}%`, icon: '⚠️' },
  ];

  return (
    <div className="admin-dashboard">
      <h1>Dashboard</h1>
      <p className="admin-subtitle">Visión general del estado del sistema</p>
      
      <section className="metrics-grid" aria-label="Métricas principales">
        {cards.map((card, i) => (
          <article key={i} className="metric-card">
            <span className="metric-icon" aria-hidden="true">{card.icon}</span>
            <div className="metric-content">
              <span className="metric-label">{card.label}</span>
              <span className="metric-value">{card.value}</span>
            </div>
          </article>
        ))}
      </section>

      <section className="admin-quick-actions">
        <h2>Acciones rápidas</h2>
        <p className="microcopy">Funcionalidades completas en Fase 2. Actualmente solo visualización.</p>
        <div className="action-buttons">
          <button disabled className="btn-secondary">Ver usuarios →</button>
          <button disabled className="btn-secondary">Ver partidas →</button>
          <button disabled className="btn-secondary">Configurar IA →</button>
        </div>
      </section>
    </div>
  );
}
```

### 10. Cliente API Admin (`apps/web/src/api/client.ts` - extensión)

```typescript
// Añadir al objeto exportado
export const adminApi = {
  async getDashboardMetrics(): Promise<AdminDashboardMetrics> {
    // Fase 1: mock data
    return {
      usersTotal: 127,
      usersActive24h: 23,
      runsTotal: 89,
      runsActive: 5,
      aiTokensUsed24h: 45231,
      aiErrorRate24h: 2.1,
    };
  },
  // Stubs para Fase 2
  async getUsers() { throw new Error('NOT_IMPLEMENTED'); },
  async getRuns() { throw new Error('NOT_IMPLEMENTED'); },
};
```

### 11. Registro de Rutas Frontend (`apps/web/src/routes/index.tsx` o router principal)

```tsx
import { AdminGuard } from './AdminGuard.tsx';
import { AdminLayout } from '../admin/AdminLayout.tsx';
import { DashboardPage } from '../admin/DashboardPage.tsx';

// Dentro del router principal:
<Route element={<AdminGuard />}>
  <Route path="/admin" element={<AdminLayout />}>
    <Route index element={<DashboardPage />} />
    <Route path="users" element={<div>Próximamente: Gestión de usuarios</div>} />
    <Route path="runs" element={<div>Próximamente: Gestión de partidas</div>} />
    <Route path="ai" element={<div>Próximamente: Configuración IA</div>} />
    <Route path="audit" element={<div>Próximamente: Auditoría</div>} />
  </Route>
</Route>
```

---

## Estilos CSS (Coherencia con Diseño Actual)

Los estilos deben seguir `apps/web/src/game/game.css` y `apps/web/src/prototype/prototype.css`:

- Fondo negro (`#000`)
- Panel azul (`#0000aa`)
- Texto dorado (`#ffff55`) para títulos/valores clave
- Gris (`#aaaaaa`) para texto secundario
- Teal (`#00aaaa`) para elementos interactivos/activos
- Bordes dobles en tarjetas y secciones
- Tipografía monospace (fuente del juego)
- Microcopy en gris más claro, tamaño reducido

---

## Pruebas de Aceptación (Definition of Done)

- [ ] Migración aplicada: `profiles` tiene columna `role` con ENUM y default `'player'`
- [ ] `GET /api/v1/admin/health` devuelve 200 con JSON válido
- [ ] Usuario con `role='player'` recibe 403 en `/api/v1/admin/*`
- [ ] Usuario con `role='admin'` accede a `/api/v1/admin/health` (200)
- [ ] Usuario con `role='superadmin'` accede a `/api/v1/admin/health` (200)
- [ ] Frontend: `/admin` redirige a `/login` si no autenticado
- [ ] Frontend: `/admin` redirige a `/login` si rol !== `admin`/`superadmin`
- [ ] Frontend: `/admin` muestra dashboard con 6 tarjetas de métricas (datos mock)
- [ ] Navegación lateral funciona entre secciones (aunque sean placeholders)
- [ ] `pnpm typecheck` pasa sin errores en api y web
- [ ] `pnpm lint` pasa sin errores nuevos
- [ ] Estilos visuales coherentes con el resto de la web (MS-DOS, pixel-art)

---

## Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| Conflicto con `createAuthorizer` existente | Alto | Usar el mismo patrón; probar que no rompe rutas de juego/auth |
| Token digest / sesión no coincide | Alto | Reutilizar exactamente `session-security.ts` y `tokenDigest` |
| Variable `ADMIN_ENABLED` mal configurada en prod | Medio | Default `false` en prod; documentar en `.env.example` y manuales |
| Frontend `useAuth` no expone `role` | Medio | Verificar hook actual; extender si necesario antes de implementar guard |
| Mock data en dashboard confunde al admin | Bajo | Microcopy claro: "Datos de ejemplo (Fase 1)" en cada tarjeta |

---

## Próximos Pasos (Post-Fase 1)

Una vez completada y verificada esta fase:
1. **ADMIN-002**: Métricas reales + queries de BD + dashboard con datos reales
2. **ADMIN-003**: Gestión de usuarios (listado, roles, revocación sesiones)
3. **ADMIN-004**: Auditoría (`admin_audit_log`) + endpoints de consulta
4. **ADMIN-005**: Configuración IA (cuotas, métricas por proveedor)
5. **ADMIN-006**: Operaciones sensibles (reinicios, backups, anonimización, sandbox IA)

---

## Notas de Implementación

- **No tocar** `apps/api/src/admin/middleware.ts` actual — será reemplazado completamente
- **No tocar** `apps/api/src/admin/routes.ts` actual — será reescrito limpio
- **No tocar** `apps/api/src/admin/queries.ts` actual — se usará en Fase 2+
- Mantener `design_draft.md` como referencia histórica; este spec es la fuente de verdad para Fase 1
- Commit único por cada componente (migración, middleware, routes, frontend) para revisión granular