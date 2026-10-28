# T1-01: inicio y evidencia de contratos de base

Fecha: 2026-10-28. Estado: EN CURSO; no completada ni aceptada.
Responsable: Codex, encargo documental explícito del usuario.
Base: commit 5241a22. Rama: codex/t1-01-contratos-base, worktree independiente.

## Alcance realizado

Se han concretado sesión local, errores HTTP, configuración, validación previa
al arranque, frontera de migraciones y escenarios negativos en SPEC-004/009/011.
No se ha implementado aplicación ni añadido dependencias al producto; no se
han creado otros agentes, cambiado WSL ni modificado originales.
Trazabilidad: REQ-T06, REQ-Q05/Q07/Q12; ADR-008/010; SEC-08/09/14;
ACC-020/024/039. Se diseñan pruebas, no se declaran superadas.

## Inventario ejecutado

Desde PowerShell se ejecutó en Ubuntu-20.04 mediante bash -lc:
node --version; npm --version; pnpm --version; git --version;
command -v docker; docker --version; docker compose version;
command -v ollama; ollama --version.

Resultados: Node v24.22.1, npm 12.2.1, pnpm 12.15.0, Git 2.50.1,
Docker CLI 26.1.3 en /usr/bin/docker. docker compose no es un subcomando
instalado; ollama no está en PATH. El comando conjunto terminó con código 127
por Ollama ausente; no se oculta como inventario totalmente satisfactorio.
wsl --list --verbose mostró Ubuntu-20.04 Running y docker-desktop Stopped.
No se interrogó el daemon ni inventariaron contenedores o datos ajenos.

## Pendientes antes del cierre

- Calibrar argon2 0.45.1 en entorno de evaluación aislado: hash/verify,
  contraseña incorrecta, tiempos y memoria; los mínimos de SPEC-004 no son
  parámetros medidos ni aprobación para público.
- Revisar el conjunto y entregar T1-01 para aceptación humana. T1-02 sigue
  pendiente; no se ha autorizado su inicio por cambiar este registro.

Compose ausente requiere preparación de entorno antes de T1-03, pero no una
instalación como efecto de este encargo documental. Ollama se evalúa en T3-01;
no se infiere que falte en Windows ni se cambia proveedor de producto.

## Verificación documental

Ejecutados: python scripts/verify_docs.py (62 Markdown, 107 requisitos, 39 tareas, 12 specs,
10 ADR, 40 ACC y 15 SEC; enlaces, grafo y originales OK), git diff --check
(sin errores). Su alcance es integridad documental: no prueba cookies, CSRF,
arranque, DB ni seguridad real.

## Continuación: selección y pruebas temporales

Versiones y licencias registradas en SPEC-009 desde metadatos públicos del
registro npm. Seleccionados React/react-dom 19.3.1, Vite 8.3.5, TypeScript 7.0.2,
Fastify 5.12.7, drizzle-orm 0.45.4, drizzle-kit 0.31.11 y pg 8.23.1.
Consulta ejecutada con urllib.request de Python en WSL a /<paquete>/latest;
solo se imprimieron name, version, engines, peerDependencies y license.

Se definieron pool máximo 5, conexión 2 s, consulta 2 s, readiness máximo 5 s,
y migrador con 3 intentos de conexión y pausas 1/2 s. Son contrato, no medidas
ni límites ya aplicados a un servidor existente.

Instalación npm --save-exact --no-audit --no-fund en mktemp bajo /tmp,
sin package.json/lockfile/node_modules del producto y sin dependencias globales.
Versiones: las anteriores y argon2 0.45.1. Avisos de instalación: dependencias
transitivas obsoletas de drizzle-kit y scripts bloqueados por la política npm.
No se modificó esa política ni se aprobó globalmente ejecución de scripts.

Primer intento: import de argon2 falla con ERR_DLOPEN_FAILED: GLIBC_2.34 no
está disponible (ldd --version confirma glibc 2.31). Segundo intento: node-gyp
11.5.0 temporal logra configuración pero g++ rechaza -std=gnu++20. No había
clang++ ni g++-10/11/12 en PATH. No se instalaron compiladores ni cambió WSL.
Un intento de reusar la primera carpeta temporal falló al no existir; su cd sin
set -e dejó un build/config.gypi auxiliar en el worktree. Se verificó y retiró
solo ese archivo; los scripts siguientes abortan ante cd fallido.

Prueba de stack sin Argon2, ejecutada en una única sesión temporal:
- Fastify inject GET /health: 200 y JSON exacto, sin escuchar en puerto.
- React renderToStaticMarkup: salida esperada.
- Vite build de página sintética con react-dom/client: correcto.
- Drizzle + pg: SQL generado correctamente, sin conectar ni crear DB.
- tsc --version: 7.0.2; drizzle-kit --version: 0.31.11 / ORM 0.45.4.

Máquina informada por Node: Linux x64, Intel i7-1195G7, 8 CPUs disponibles.
No se produjeron tiempos hash/verify: el benchmark no llegó a ejecutarse por
incompatibilidad nativa. No presentar mediciones vacías como resultado favorable.
Los ensayos fueron temporales y no forman parte de la aplicación. No hubo
llamadas al proveedor ni acceso a secretos.

## Desbloqueo propuesto

Preparar Ubuntu 24.04 de WSL en paralelo, previa autorización específica,
conservar Ubuntu 20.04 y repetir Argon2 antes de cerrar T1-01.
La consulta de preparación de entorno queda sin efecto tras el cambio de
prioridad del usuario. No se realizará esa instalación durante la limpieza del
proyecto. T1-01 queda pendiente de retomar; T1-02 no se ha iniciado.
