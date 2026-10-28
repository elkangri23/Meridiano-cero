# Integración T3-04 en main

Fecha: 2026-10-28. Entradas: main 6f43ba2 y rama T3-04 3a28abd. Worktree: integracion-t3-04-main, rama de preparación codex/integracion-t3-04-main. Autorización explícita del usuario: unir T3-04 con main.

## Resolución

Nueve conflictos: README, seis documentos de manuales/planificación, SPEC-004 y package.json. Se conservan los comandos de base de main (setup, migración, integración, seguridad, formato), además de eval:ai y scan:secrets. Se incorporan los servicios IA y contratos sin sustituir sesiones/migrador ni fingir rutas de partidas inexistentes.

Se distinguen los Compose: compose.yaml es la base PostgreSQL vigente; docker-compose.yml es un stack legado distinto. Las afirmaciones del snapshot T3 anterior se actualizan al código combinado.

El lockfile de main tenía dos snapshots Vite idénticos con la misma clave. Se comprobó igualdad y se eliminó el duplicado; no se cambian versiones ni integridades. La instalación congelada requirió consultar metadatos oficiales ausentes de la caché; 251 paquetes reutilizados y cero paquetes descargados según pnpm.

Se conserva el workflow de base/seguridad con acciones fijadas por SHA y controles DB, se añade el corpus IA y se retira el workflow legado duplicado. Build precede a typecheck para preparar contratos desde checkout limpio. No se desactivan lint, imports ni controles de seguridad para obtener verde.

## Resultados locales

| Control | Resultado | Límite |
|---|---|---|
| pnpm install --frozen-lockfile | Correcto; política de cadena de suministro superada | Caché de paquetes existente, metadatos consultados |
| pnpm build | Correcto en todos los proyectos pnpm | No compila artefactos sin manifest/consumidor |
| pnpm typecheck | Correcto en todos los proyectos pnpm | No E2E ni evaluación real |
| pnpm test | 157 correctas, doce archivos | Integración DB excluida por configuración |
| ESLint del módulo IA | Correcto | No todo el repositorio |
| pnpm eval:ai --mock | 17 escenarios correctos | Oráculo determinista, no modelo real |
| pnpm smoke | HTTP web/proxy/API correcto | Sin DB, sesión o navegador real |
| pnpm scan:secrets | Sin hallazgos | Patrones; Gitleaks/Docker no ejecutado en este merge |
| ESLint global | Nueve errores | Heredados de main, sin ocultar |
| pnpm check:imports | Siete infracciones | Heredadas, no debilitadas |
| pnpm check:format | 22 archivos señalados | Heredados; no se reformatea código ajeno al merge |
| Verificación documental y diff | Ejecutados antes del commit | Integridad, no conformidad OWASP |

No se ejecutaron ni modificaron Docker, WSL, bases personales, secretos ni otros proyectos. La integración PostgreSQL/persistencia de F1 conserva su evidencia histórica; no se reetiqueta como una ejecución de esta integración.

## Calidad heredada y alcance

Lint: validateCaseDefinition y dos funciones de engine complejas; variable _vr no usada; dos callbacks de simulación complejos; non-null assertion y prefer-const en simulación; error de sintaxis del componente RetroScreen no consumido. Estos archivos son idénticos a main respecto a su lógica; no proceden de los servicios IA incorporados.

Imports: contracts reexporta tipos case-schema y la regla engine-pure alcanza crypto y cinco archivos de pruebas. Formato señala archivos T2/legados. Deben corregirse con una tarea de calidad, no interpretarse como CI aprobada.

packages/web/RetroScreen no está conectado, importa un módulo de tipos ausente y presupone CaseDefinition/cooperación privada en props. No se conecta durante el merge. El prototipo vigente sigue recibiendo muestra pública y se excluye de producción.

Se conserva la implementación de main y se corrigen las marcas de T3: sesión local no equivale a API de partidas, archivo de UI sin consumidor no cierra T3-03 y no hay prueba real que cierre T3-05.

## Publicación

Se crea commit de merge con ambos padres; después se avanza main y se publica sin force-push. Los cambios no versionados encontrados en el checkout principal, especialmente packages/ai-adapters, no forman parte de la integración y se conservan.
