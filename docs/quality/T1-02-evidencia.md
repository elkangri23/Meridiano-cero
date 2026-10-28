# T1-02: workspace web/API y contratos públicos

Fecha: 2026-10-28. Estado: EN REVISIÓN; implementación y comprobaciones de T1-02 terminadas, pendiente de integración manual.
Base: main 37d48dd. Worktree t1-02-workspace; rama codex/t1-02-workspace.
Autorización: el usuario pidió continuar T1 tras integrar las ramas en main.
REQ-T01/T10; REQ-Q01/Q02/Q03/Q04/Q09/Q12; SPEC-009/012;
ADR-001/002; ACC-025/040 y subconjunto de ACC-024.

## Alcance

Tres paquetes reales: web React/Vite, API Fastify y contrato de health compartido.
El navegador valida la respuesta HTTP con el guard público; API usa el mismo DTO.
Health es solo proceso, no readiness. Sin sesión, DB, motor, UI de juego, worker,
generador ni paquetes vacíos. Se conserva Git y su remoto. No hay commit/push,
merge, publicación, cambio WSL ni uso de credenciales durante esta tarea.

El arranque de desarrollo requiere modo/host/origen/puerto explícitos; solo
loopback, con sesión y registro desactivados. Body máximo 64 KiB, requestId propio,
respuestas no-store, errores mínimos sin eco de entradas. Esta base no declara
cumplidas las validaciones de conexión DB o sesiones de T1-03.

## Versiones, necesidad y licencias

Versiones exactas de producto en SPEC-009 y manifiestos; lockfile raíz pnpm.
Node 24.22.1 y pnpm 12.15.0 de WSL existentes; no actualizados por esta tarea.
React/react-dom 19.3.1, Vite 8.3.5, Fastify 5.12.7: MIT; consumidor web/API.

| Herramienta | Versión / licencia | Necesidad y alternativa |
|---|---|---|
| TypeScript | 6.0.3 / Apache-2.0 | Tipos strict y noUncheckedIndexedAccess; JS no satisface el contrato |
| typescript-eslint | 8.72.1 / MIT | Lint TS; sin parser no se analizan tipos/sintaxis TS correctamente |
| ESLint / @eslint/js | 10.13.0 / 10.0.1, MIT | Reglas de código, any, non-null y complejidad <=10 |
| dependency-cruiser | 18.7.0 / MIT | Grafo/ciclos e imports relativos; un grep no resuelve módulos |
| Vitest | 5.0.5 / MIT | Comportamiento HTTP/configuración, ya elegido por SPEC-012 |
| @types/node | 24.19.2 / MIT | Tipos de la línea Node 24 usada, no tipos de Node 26 |
| @types/react / react-dom | 19.3.0 / MIT | Tipos del consumidor web |

Consulta de metadatos públicos del registro npm (version, engines, peers, license),
sin claves. TypeScript 7.0.2 de la selección preliminar no entra en el rango
soportado por typescript-eslint: se adopta 6.0.3; no se oculta el aviso ni se
suprimen reglas. Fuente: [soporte oficial](https://typescript-eslint.io/users/dependency-versions/).
No se instala plugin React mientras Vite pueda compilar el TSX del scaffold;
no se añade tsx porque Node 24 ejecuta el TS de desarrollo con strip-types.
Sin ORM/pg hasta T1-03 ni nuevas dependencias de autenticación sin consumidor.

## Instalación y comprobaciones

Instalación ejecutada desde WSL con PATH Linux, en el worktree:
`pnpm install --ignore-scripts`. Resultado: 220 paquetes, integridad de 3004
archivos comprobada, pnpm 12.15.0; scripts de instalación desactivados. Instalación
sobre unidad Windows: 4 min 48,7 s; no atribuir esa latencia a rendimiento del juego.

Primera ejecución de build detectó acceso no validado a error: unknown en
Fastify. Se corrigió con comprobación de objeto/campo, sin any ni assertion.
El build web concurrente fue cancelado por pnpm al fallar API; no se cuenta como
fallo independiente de Vite. Los comandos posteriores se repiten tras corregirlo.

Resultados obtenidos:

| Comando | Resultado / alcance |
|---|---|
| pnpm build | Correcto: contratos, API y web; Vite transforma 16 módulos y genera HTML/CSS/JS |
| pnpm typecheck | Correcto para los tres paquetes tras la corrección unknown |
| pnpm test | 15/15 correctos: HTTP mínimo, errores, requestId y configuración cerrada |
| pnpm smoke | Correcto: HTML y TSX servidos; GET health a través del proxy web/API con HTTP real |
| pnpm install --frozen-lockfile --ignore-scripts --offline | Correcto, lockfile vigente y sin resolver ni descargar; 1,4 s |
| pnpm lint | Correcto: ESLint y grafo reforzado, 15 módulos / 13 dependencias sin violaciones |
| pnpm verify:guards | Correcto: contrato incompatible, web/API fuente, web/API compilada, web/Node nativo, ciclo y árbol limpio final |
| python scripts/verify_docs.py | Correcto: 50 Markdown, 107 REQ, 39 tareas, 12 specs, 10 ADR, 40 ACC, 15 SEC; originales intactos |
| git diff --check | Correcto; solo aviso de conversión de finales de línea en .gitignore |

Incidencias de tooling resueltas, sin relajar contratos:
- El resolver de dependency-cruiser necesitó exportsFields/conditionNames y
  mainFields explícitos para reconocer exports ESM; se mantuvo no-unresolved.
- La primera prueba HTTP agotó 5 s al cargar el transporte perezoso de inject.
  Se preparó la fixture con app.ready y un warmup comprobado en beforeAll,
  cerrando app en afterAll. No se ampliaron timeouts ni redujeron assertions.
  La suite final pasó 15/15 y el arranque real se contrastó con smoke.
- El medidor negativo suponía un nombre de binario que no correspondía al
  paquete instalado. Ahora lee su campo bin y valida ruta; la comprobación sigue
  exigiendo el código/nombre de regla esperado y éxito del árbol limpio final.
- Se reforzó el grafo para seguir destinos dist: excluirlos habría dejado sin
  analizar imports a API compilada. Se descubren entradas src de paquetes reales,
  manteniendo los destinos resueltos y sin seguir recursivamente librerías npm.
  El check ampliado analizó 15 módulos / 13 dependencias sin violaciones.

Los controles negativos generan archivos sintéticos, comprueban que las
herramientas reales fallen con la regla/diagnóstico esperado, retiran los archivos
y exigen que el árbol limpio vuelva a pasar. No se crean archivos de producto
para las futuras parcelas. No ejecutar esos controles junto a watchers.


## Límites

No se han implementado Compose, DB, sesiones, ready, IA ni partidas. No se afirma
que HTTP de proceso demuestre arranque completo de fase 1. Las pruebas negativas
verifican herramientas reales; no son escenarios del videojuego ni auditoría OWASP.
No hay CI remota ni prueba E2E de navegador. Los checks que correspondan a T1-04
y al primer caso se mantienen pendientes en sus tareas.

## Entorno de la siguiente tarea

Se comprobó solo en lectura el Docker de Windows: CLI 29.9.2 y Compose 5.6.1
instalados; el motor dockerDesktopLinuxEngine no estaba disponible. La ausencia
del subcomando Compose de Ubuntu no implica que falte en Windows. No se arrancó
Docker Desktop ni se instalaron herramientas como parte de T1-02. T1-03 necesitará
validar un entorno DB accesible desde el runtime elegido antes de afirmar persistencia.

## Entrega y siguiente paso

T1-02 cumple su salida técnica: workspace con consumidores reales, versiones
fijadas, build, tipos, lint, grafo sin ciclos y prueba negativa de contrato
incompatible detectada por tsc. El usuario revisa e integra el cambio; no se
marca aceptado F1 ni se hacen commits/merge/push automáticamente.

T1-03 sigue pendiente: Compose/PostgreSQL, migración, configuración completa,
readiness, sesión local y prueba real de reinicio con datos. El smoke de esta
entrega usa puertos efímeros y cierra API/Vite en finally; no deja servicios de
producto activos. No es una prueba E2E de interacción del navegador.
