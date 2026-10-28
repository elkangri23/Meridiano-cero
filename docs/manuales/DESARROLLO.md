# Desarrollo y contribución

Actualización 2026-10-28: la base local de fase 1 ya está implementada. Procedimiento actual y límites: [BASE-LOCAL](BASE-LOCAL.md). Los apartados de distribución/juego completo de este documento siguen siendo objetivos de sus fases.

Estado: base de workspace implementada en T1-02; DB, sesión y juego siguen pendientes. Consultar su evidencia para resultados reales de cada comando.

## Qué existe ahora

Fuentes GDD/TAD, requisitos, roadmap, specs, ADR y aceptación, más un workspace
pnpm de tres paquetes: apps/web (React/Vite), apps/api (Fastify) y
packages/contracts (contrato público de health consumido por ambos). Hay
manifiestos, lockfile y configuración estricta/lint/imports. No hay Compose,
base de datos, identidad, motor ni caso jugable. Git ya existía y no se reinicializa.

Se puede comprobar la documentación con Python 3: `python scripts/verify_docs.py`. No requiere paquetes externos ni red.

## Entorno objetivo

Windows con PowerShell y Docker Compose; Node LTS y pnpm para desarrollar. Ollama o LM Studio en host para IA local. Versiones exactas de la base en SPEC-009 y package.json; no se inventa que cualquier modelo sirve por disponer de una GPU concreta.

PostgreSQL en Docker también durante desarrollo. Configuración local privada separada de ejemplos versionados. Las claves no entran en frontend, capturas, tests ni logs.

## Estructura prevista

apps/web: interfaz React/Vite. apps/api: Fastify y coordinación/persistencia. apps/worker aparece al introducir trabajos de generación. packages/engine: reglas puras. packages/case-schema: validación del expediente. Otros paquetes de IA, generador, contratos y UI se crean cuando hay uso real.

No crear el árbol completo por adelantado con archivos vacíos. Los límites están en SPEC-012; no importar apps desde paquetes ni usar contratos secretos en web.

## Flujo de una tarea

1. Escoger tarea preparada con dependencias satisfechas.
2. Leer requisitos, spec, ADR y controles asociados.
3. Cerrar decisiones pendientes de esa tarea antes de implementar.
4. Cambiar solo lo necesario y añadir comprobaciones de comportamiento.
5. Ejecutar tipos/lint/pruebas pertinentes y revisar diff.
6. Registrar resultados reales y actualizar trazabilidad/estado.
7. Demostrar el hito al usuario.

Si aparece una contradicción, registrar decisión en BASELINE; si es arquitectura, nuevo ADR. No modificar silenciosamente los Word ni las reglas del juego. Una refactorización debe conservar comportamiento y tener evidencia; no reescribir módulos completos por gusto.

## Comandos de la base T1-02

En una terminal WSL con Node 24.22.1 y pnpm 12.15.0, entrar en el worktree.
`node --version` y `pnpm --version` deben coincidir antes de instalar. No mezclar
node_modules entre sistemas; no usar Node 20 de Windows para esta base.

```bash
pnpm install --frozen-lockfile --ignore-scripts
test -e .env || cp .env.example .env
pnpm dev
```

Copiar el ejemplo solo si no existe .env propio; no sobreescribir secretos.
En PowerShell el equivalente de copia es Copy-Item con comprobación previa,
pero requiere Node 24/pnpm fijados y dependencias instaladas para Windows.
Web: http://127.0.0.1:5173. API: http://127.0.0.1:3000/api/v1/health.
El proxy lee API_PORT del entorno de la raíz; CORS no se habilita. La pantalla
no interpreta acciones ni crea sesión, usuario o datos. Ctrl+C detiene los watchers.

| Comando | Alcance real |
|---|---|
| pnpm dev | Compila contratos y arranca sus watchers, API y Vite en loopback |
| pnpm build | Compila contratos/API y produce bundle web |
| pnpm typecheck | Comprueba todos los proyectos sin emitir, tras compilar el contrato compartido |
| pnpm lint | ESLint y verificación de imports/ciclos |
| pnpm check:imports | Dependency-cruiser sobre el código de apps/paquetes |
| pnpm test | Vitest de HTTP/configuración; no pruebas del juego |
| pnpm verify:guards | Contrato incompatible, web/API fuente y compilada, Node nativo y ciclos; limpieza final |
| pnpm smoke | HTTP real de Vite y API con puertos efímeros de loopback y cierre final |

El control de imports descubre los src de cada paquete real y sigue sus exports
compilados; no excluye un destino privado por estar en dist. La detección de
paquetes y el ejecutable real se comparten entre check:imports y las pruebas negativas.

No ejecutar verify:guards al mismo tiempo que dev, typecheck o build: escribe
archivos temporales intencionadamente inválidos dentro del worktree y los retira.
No usa credenciales ni modifica archivos existentes. No hay comandos de migración,
backup, ready ni test:e2e implementados; llegan con DB/CI/primer caso según backlog.
Los artefactos dist, node_modules, .env y resultados de herramientas quedan fuera
de Git. .env.example contiene solo valores sintéticos sin secretos.

TypeScript se ajustó de la selección preliminar 7.0.2 a 6.0.3 porque la versión
mantenida de typescript-eslint declara soporte <6.1.0. No se oculta el aviso de
incompatibilidad ni se desactivan reglas para conservar una versión más nueva.
Fuente: [soporte oficial](https://typescript-eslint.io/users/dependency-versions/).

## Código y dependencias

KISS, DRY y tipos estrictos según SPEC-012. Favorecer módulos cohesionados y funciones explícitas. No clases base, repositorios universales, service locator ni abstracciones sin necesidad. Contratos públicos únicos; engine no necesita IA para probarse.

Cada dependencia nueva debe aportar una capacidad usada, con licencia compatible y mantenimiento comprobado. No usar un paquete grande para reemplazar pocas líneas claras. No inventar mecanismos de auth o criptografía para ahorrar dependencia.

## Revisión y contribuciones

Una contribución describe problema, cambio, requisitos, pruebas y limitaciones. No confundir mock con evaluación real de IA. No enviar datos personales o claves en issues. Antes de publicar normas definitivas, cerrar autoría/licencias y el procedimiento de contribuciones. GitHub no se crea ni se publica automáticamente por existir estos documentos.
