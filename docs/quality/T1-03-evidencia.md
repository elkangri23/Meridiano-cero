# T1-03 PostgreSQL, migración y sesión local

Fecha: 2026-10-28. Estado: implementación con comprobaciones locales; cierre final en registro F1. Rama codex/t1-base-docker. El usuario autorizó commits e integración y continuar Docker/T1. Sin push, publicación ni cambios de instalación WSL.

## Recuperación de la base

El worktree original T1-02 fue archivado externamente durante la revisión. No llegó a crearse el commit inicial intentado. La instantánea Git 6408b07 conservaba exactamente 40 archivos de T1-02; se restauraron en un worktree nuevo limpio, se guardaron como 31ecba8 y se integraron por avance rápido en main. La instantánea original sigue conservada.

La primera repetición desde WSL perdió archivos al archivarse ese worktree; sus errores de módulos ausentes NO se presentan como una regresión del código ni como pruebas pasadas. Se hizo instalación limpia Windows con Node 24.22.1 empaquetado y pnpm 12.15.0 temporal, sin cambiar herramientas globales.

## Implementación

Compose de DB con imagen oficial postgres:18.6 fijada al digest sha256:979bccfde35445db618c65107d27d08c6c21339d8dc3ad4c830c6633947be0e4; volumen en /var/lib/postgresql según imagen 18. Puerto solo 127.0.0.1. Proyecto sintético meridiano-cero-t1-test, puerto 15433, distinto al desarrollo 15432.

Configuración privada aleatoria, ignorada por Git; no se imprimen claves. Directorio de secretos 0700 y .env 0600 en POSIX; archivos montados de secretos legibles por postgres dentro del contenedor y protegidos por el directorio en host. En Windows dependen también de las ACL del perfil, no se promete que chmod sustituya ACL.

Migración SQL generada por Drizzle y revisada, más migración explícita de constraints/grants/semilla. Ledger con hashes, transacción y advisory lock; sin migración automática al arrancar API. Dos roles: dueño/migrador y API sin DDL. Perfil local se crea solo mediante migración explícita.

Sesión opaca con digest SHA-256, CSRF independiente, cookie HttpOnly y ocho horas de vida. Solo desarrollo loopback; bandera/origen/configuración validados antes de DB/listener. Readiness comprueba esquema/hash y DB; health no requiere DB ni IA.

## Resultados ejecutados

- pnpm typecheck, lint y build: correctos durante implementación.
- pnpm test: 26 pruebas correctas (HTTP aislado/configuración; no juego).
- Primera suite PostgreSQL: 8/8 correctas, migración idempotente, identidad, rotación, CSRF, expiración y rol sin CREATE.
- verify-persistence: health=200 / ready=503 con DB detenida, respuesta <5 s; recreación del contenedor con mismo volumen conserva perfil, cookie y CSRF en nueva API.
- verify:guards: rechazo de contrato incompatible, imports web/API fuente/compilada/Node y ciclos; árbol limpio pasa.
- Smoke HTTP real: se corrigió import de ruta absoluta Windows mediante pathToFileURL; repetición correcta.

La suite ampliada incorpora migradores concurrentes, esquema futuro y rate limit. Un intento encontró Docker Desktop reiniciándose externamente (status starting y API Docker 500); falló el beforeAll y se omitieron los casos, no se cuentan como aprobados. El resultado final se registra en FASE-1 tras recuperar el servicio.

## Límites

No login con contraseña, API pública, IA, motor ni partida. Las pruebas son sintéticas y locales; no auditoría OWASP completa. No se inspeccionaron ni borraron contenedores de otros proyectos. No se eliminó el volumen de pruebas. Fuentes de despliegue: [imagen oficial](https://hub.docker.com/_/postgres) y [persistencia PostgreSQL de Docker](https://docs.docker.com/guides/postgresql).

La revisión de whitespace conserva los bytes del SQL ya aplicado y excluye archivos de migración SQL del check de espacios Git; los restantes archivos pasan. No se cambia una migración aplicada solo para retirar una línea vacía final, pues alteraría el hash.
