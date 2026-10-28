# T1-01: inicio y evidencia de contratos de base

Fecha: 2026-10-28. Estado actual: EN REVISIÓN; entrega documental realizada, pendiente de aceptación del usuario.
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

## Pendientes registrados al iniciar (véase resolución posterior)

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

## Resolución de la calibración y entrega para revisión

Continuación del 2026-10-28 sobre commit f151f7e. Se utilizó Windows x64 y
Node 24.22.1 portable oficial, sin alterar Node 20 global ni la instalación WSL.
El zip se verificó contra SHASUMS256.txt descargado por HTTPS del mismo sitio:
[archivo Node](https://nodejs.org/dist/v24.22.1/node-v24.22.1-win-x64.zip) y
[checksums oficiales](https://nodejs.org/dist/v24.22.1/SHASUMS256.txt).
SHA-256: d2046d28c2c3dcd211ac5145c0bf30e2047ef9dfb306693c8c6e2eccd8b95fa5.
Es una comprobación de integridad contra origen HTTPS, no verificación de firma.

Argon2 0.45.1 se instaló mediante el npm del runtime portable en una carpeta
bajo TEMP con --prefix, --save-exact, --ignore-scripts, --no-audit y --no-fund.
Se pasaron dos npmrc temporales vacíos distintos para usuario/global; no se
consultaron credenciales ni se modificaron sus archivos. El primer intento con
el mismo npmrc para ambos ámbitos falló; se corrigió antes de instalar.

Medidor reproducible: [scripts/dev/measure-argon2.cjs](../../scripts/dev/measure-argon2.cjs).
Acepta una carpeta temporal como argumento, comprueba Node 24 y argon2 0.45.1,
utiliza contraseñas aleatorias sintéticas y solo imprime medidas y comprobaciones.
El primer ensayo asumía un orden concreto de parámetros PHC; la librería
serializó otro orden. Se corrigió para comparar nombres/valores sin depender
del orden, conservando comprobación de Argon2id, v19, memoria, iteraciones y
paralelismo. No se cambió el algoritmo ni se omitió una comprobación de seguridad.

Reproducción desde PowerShell, con un Node 24 ya disponible y dependencias en
carpeta temporal independiente (marcadores de ruta, no comandos ya instalados):

```powershell
& '<ruta-node24>\node.exe' '<ruta-node24>\node_modules\npm\bin\npm-cli.js' install --prefix '<carpeta-temporal>' --userconfig '<npmrc-usuario-vacio>' --globalconfig '<npmrc-global-vacio>' --ignore-scripts --no-audit --no-fund --save-exact argon2@0.45.1
& '<ruta-node24>\node.exe' scripts/dev/measure-argon2.cjs '<carpeta-temporal>'
```

El comando de medición final terminó con código 0. Datos completos:
[resultado JSON](evidence/T1-01-argon2-windows.json).

| Memoria KiB / iteraciones / paralelismo | Mediana hash / verify ms | Máximo hash / verify ms | Dos hashes simultáneos ms | Máximo RSS de proceso KiB |
|---|---|---|---|---|
| 19456 / 2 / 1 | 68,3 / 66,1 | 91,2 / 74,7 | 89,7 | 80904 |
| 19456 / 3 / 1 | 112,9 / 110,0 | 175,1 / 144,2 | 132,1 | 81512 |
| 65536 / 3 / 1 | 551,0 / 456,2 | 944,0 / 653,5 | 449,0 | 172536 |

Nueve muestras por perfil después de calentamiento. RSS es máximo acumulado de
proceso, no memoria exclusiva de Argon2. La concurrencia tiene una sola muestra
por perfil y carga variable: no permite calcular capacidad de servicio ni afirmar
que dos operaciones escalen mejor que una. No son percentiles de producción.

Pasaron contraseña correcta, rechazo de incorrecta, sales distintas >=16 bytes,
PHC con parámetros esperados, hash de 32 bytes y rechazo de PHC malformado.
Perfil de referencia elegido: 65536 KiB / 3 / 1, límite propuesto de dos hashes
activos por proceso, con revalidación de memoria y latencia antes de login real.
No hay contraseña reutilizada, servidor, cuenta, llamadas IA ni puertos abiertos.

### Coherencia final de contratos

- Sesión opaca y CSRF persistidos, caducidad, revocación, cookies y no-store.
- Sin SESSION_SECRET obligatorio sin consumidor: la sesión valida digest en DB,
  no una firma. Secretos reales necesarios: credencial DB; claves de capacidades
  futuras se definirán cuando exista consumidor, por separado.
- Origen/bypass/mode validados antes de efectos; prueba negativa prevista para
  public con bypass, sin afirmar que ya corrió contra una aplicación.
- Versiones exactas, pool/timeouts, migrador explícito y readiness acotado.
- Calibración Windows real; Ubuntu 20.04 sigue limitado para Argon2. La base F1
  usa sesión local sin contraseña; validar contraseñas Linux antes de habilitarlas
  es gate posterior, y público debe medirse en su propio entorno.

Los pendientes iniciales de seleccionar versiones, concretar arranque y obtener
una calibración de referencia están resueltos para esta entrega documental.
Permanecen pendientes de implementación ACC-020/024/039 y resto de fase 1.
T1-01 se entrega EN REVISIÓN, no se marca completada ni aceptada automáticamente.
T1-02 continúa pendiente; no se ha iniciado por producir este registro.

## Resolución de integración con main

Por encargo del usuario se integra la rama de trabajo con main. main contenía
24fe382, otra concreción documental de T1-01 sobre la misma base. Se conservan
ambos historiales; las specs quedan unificadas en un solo contrato, sin duplicar
apartados contradictorios ni presentar dos alternativas simultáneas como vigentes.

| Diferencia en 24fe382 | Resolución integrada y motivo |
|---|---|
| Registro/login y PATCH settings en fase 1 | Base local: sesión de desarrollo, me y logout; registro/login y preferencias esperan su fase. Evita anticipar identidad pública/UI sin consumidores. |
| Token de sesión en JSON y cookie 24 h / Path=/ | Token solo en cookie HttpOnly; respuesta con perfil y CSRF. Caducidad 8 h y Path=/api/v1 según contrato posterior revisado. Evita exponer el token de autenticación a JavaScript. |
| APP_MODE por defecto y production como modo público | APP_MODE obligatorio y valores development/self-hosted/public. Fase 1 rechaza modos aún no implementados y bypass fuera de loopback. |
| SESSION_SECRET sin consumidor y Argon2 para hash de sesión | Sesión opaca aleatoria: digest SHA-256 persistido; no exigir clave sin uso. Argon2id para contraseñas, con parámetros medidos y limitaciones de plataforma explícitas. |
| PostgreSQL 16 y valores app/app de ejemplo | Selección 18.6, imagen/digest por verificar en T1-03; credenciales privadas generadas, sin valores universales. |
| Ready dependiente del proveedor IA | Ready comprueba DB/esquema; fase 1 no incorpora proveedor sin consumidor. Health devuelve estado mínimo, sin versión. |
| Versiones sin fijar y Argon2 con defaults | Lista exacta en SPEC-009 y calibración Windows registrada; no sustituir medición por defaults de una dependencia. |
| Comandos de backup/restore y proveedor alternativo tratados como base | Se conservan como objetivos de sus fases en manuales/specs; no se anuncian disponibles ni se altera DEC-002. |

Se mantienen los objetivos comunes: origen explícito, monolito web/API, DB
privada persistente, lockfile, ACL/proyección por fase, errores redactados,
rotación/revocación, pruebas y mínimos privilegios. El inventario físico de
hardware de otros equipos no se convierte en un hecho verificado aquí.
La carpeta .ai/ sin seguimiento en el checkout principal no se añade ni modifica.
