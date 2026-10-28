# Estado actual del proyecto

Actualizado: 2026-10-28. Esta instantánea describe el worktree t3-04-integracion-ia, rama codex/t3-04-integracion-ia, con base fd19321 y cambios locales de T3-04. No demuestra que esos cambios estén integrados en main, publicados ni desplegados.

El [backlog](BACKLOG.md) conserva estados y dependencias; este documento reúne implementación observada, evidencia y pendientes. Las [decisiones de alcance](BASELINE.md) y los Word originales siguen siendo la referencia de producto.

## Qué se puede utilizar

| Área | Implementación disponible | Límite actual |
|---|---|---|
| Base | Cinco proyectos de producto (web, API, contracts, case-schema y engine) más la raíz pnpm | No es una distribución del juego |
| API | Health, readiness mediante SELECT 1, configuración de desarrollo y pool PostgreSQL | Sin sesión, ownership ni API de partidas; readiness no verifica migraciones |
| Base de datos | Compose, esquema Drizzle y SQL inicial presentes | Sin script db:migrate ni ensayo reproducible de migración/reinicio en esta revisión |
| Motor | Fixture del astrolabio, reloj, acciones, lotes, solicitudes y desenlaces | T2 figura completada en el registro de origen; su calidad global sigue abierta |
| Interfaz | Prototipo de desarrollo en /prototype, MS-DOS/pixel art, paneles y confirmación de muestra | Datos sintéticos; no ejecuta acciones ni guarda partidas |
| IA | Adaptador Ollama, interpretación por IDs, selección factual, memoria NPC y cancelación | Uso por CLI/servicios; no conectado al navegador ni a partidas |
| CI | Workflow y paso de evaluación determinista definidos | Sin ejecución remota acreditada; lint/imports globales fallan |

La implementación IA reside en apps/api/src/ai; no existe todavía un paquete ai-adapters independiente. Worker, generador, biblioteca UI compartida y servicios públicos no se crean por adelantado.

## Fases y tareas

- Fase 0: documentación entregada y trazabilidad verificada.
- Fase 1: base parcial; T1-01 cerrada documentalmente, T1-02 en revisión, T1-03 en curso y T1-04 en revisión.
- Fase 2: implementación funcional registrada como completada en T2-01 a T2-06; no se declara aceptada la puerta de calidad de la fase.
- Fase 3: T3-01, T3-03 y T3-04 en curso; T3-02 y T3-05 pendientes. Se adelantó trabajo independiente por petición del usuario, conservando dependencias.
- Fases 4–7: pendientes; generación, producto completo, distribución y servicio público siguen siendo objetivos.

T1-03 se identifica como en curso porque existen artefactos de DB, pero falta demostrar su entrega completa. T1-04 pasa de completada a en revisión: tener un workflow no acredita checks satisfactorios. Se conservan los estados históricos de T2 con su bloqueo de calidad explícito, sin convertirlos en aceptación de fase.

## Verificación de producto más reciente

Evidencia: [T3-04](../quality/T3-04.md), [informe determinista](../quality/T3-04-mock.json) y [presentación inicial](../quality/T3-inicio.md).

| Comprobación | Resultado registrado | Alcance |
|---|---|---|
| Vitest completo | 146 pruebas correctas, once archivos | 60 heredadas y 86 de IA; sin E2E del juego |
| IA | 86 pruebas, de las cuales dos son HTTP local sintético | Sin Ollama real |
| Corpus v2 | 17 escenarios correctos con mock | El doble conoce respuestas; no mide comprensión real |
| API | Build, tipos y lint del módulo IA correctos | No prueba autenticación ni persistencia de partidas |
| Web | Build y lint correctos en el avance del prototipo | No equivale a auditoría de accesibilidad |
| Global | Siete errores de lint y siete infracciones de imports heredados de T2 | Impiden declarar todos los controles correctos |
| Secretos | Detector local sin hallazgos | No auditoría exhaustiva |
| Documentación | Verificador de referencias, dependencias y originales disponible | No demuestra cumplimiento OWASP |

No se han probado en este avance Docker limpio, migraciones completas, backups/restauración, dos usuarios/pestañas, E2E, ambas rutas en navegador ni el caso fijo con un modelo real.

## Bloqueos y orden siguiente

1. Cerrar los problemas de base/calidad: migración reproducible, compatibilidad de configuración Compose/API y errores globales de lint/imports.
2. Cerrar los DTO públicos de T3-01: no reenviar pendientes internos con payload ni catálogos secretos.
3. Implementar T3-02: sesión local, autorización por recurso, preview/commit, concurrencia, idempotencia, transacciones, guardado y ActionLog.
4. Conectar T3-03/T3-04 y revisar teclado, foco, móvil y preferencias persistidas. Las ventanas movibles/minimizables siguen pendientes.
5. Cuando exista URL y modelo elegido, evaluar el proveedor real disponible, su contexto y el caso fijo; después ejecutar T3-05.

El usuario confirma que todavía no dispone de URL/modelo para evaluar. No se ha instalado Ollama ni descargado un modelo. El adaptador actual admite únicamente un origen HTTP literal de 127.0.0.1; un proveedor remoto necesita política y autenticación revisadas.

## Arranque y documentación

[Desarrollo](../manuales/DESARROLLO.md) contiene los comandos actuales; [IA local](../manuales/IA-LOCAL.md), la evaluación. [Instalación](../manuales/INSTALACION.md) separa la base local de la futura distribución.

El Compose de desarrollo existe, pero no se anuncia el stack completo como reproducible: el servicio api configura API_HOST=0.0.0.0 y el arranque actual solo admite 127.0.0.1. No se resuelve esa discrepancia cambiando configuración durante una tarea documental. Las credenciales de ejemplo son sintéticas de desarrollo.

Las evidencias T1-01/T1-02 y FASE-0 son instantáneas históricas. Sus limitaciones describen sus fechas/bases, no la inexistencia actual de módulos. Esta actualización solo modifica Markdown; no acepta hitos ni realiza commits, merges o despliegues.

## Aclaraciones de producto incorporadas

El usuario confirma cuentas registradas y casos en solitario, con un detective jugador por partida y sin multijugador local/VPS. El primer caso jugable debe incluir autoguardado y guardado manual, ventanas movibles/minimizables y aclaración previa de órdenes ambiguas. Referencias DEC-013/014/015/016 en BASELINE. Se han documentado; todavía no se declaran implementadas.

DEC-017 confirma retroceder cargando un guardado manual del mismo caso. Es una decisión documentada, no una capacidad ya conectada al prototipo; DEC-020 fija el primer resultado definitivo para carrera y reputación.

## Proveedores: alcance aclarado

DEC-018/019: Ollama doméstico; FreeLLMAPI en trabajo/VPS; instalaciones propias con proveedor/endpoint configurable. El VPS ofrecerá proveedor del administrador y claves personales opcionales. Solo están implementados adaptador Ollama, doble y contrato de servicio común; no se declara soporte externo ni almacenamiento de claves por cuenta. La ausencia de Ollama en el trabajo no bloquea programar; la evaluación real espera acceso al proveedor elegido. [Contrato detallado](../specs/IA-proveedores.md).

## Detalle técnico desarrollado, sin nueva implementación

La ampliación documental concreta [API](../specs/API-juego.md), [guardados](../specs/GUARDADOS.md), [conversaciones](../specs/CONVERSACIONES.md) y [68 subcasos de aceptación](../quality/T3-aceptacion-detallada.md). DEC-021 confirma diez manuales por partida, además del autoguardado.

Se fijan DTO públicos sin payload interno, revisión HTTP separada del estado restaurable, ramas, orden de idempotencia, protección del primer resultado y contratos de memoria/ventanas. La suite de producto sigue siendo la última de 146 pruebas; no se ha ejecutado código nuevo ni se declaran aprobados estos 68 escenarios.

## Diferencia con main al preparar publicación

Consulta remota del 2026-10-28: origin/main apunta a 6f43ba2 y contiene cambios posteriores a fd19321, entre ellos sesión/rutas, migrador y otra UI. No están incorporados en este worktree. Los límites de implementación y resultados de esta instantánea corresponden a la base y cambios de esta rama, no certifican el estado del código más reciente de main.

La integración manual debe reconciliar código, migraciones, rutas y estados del backlog; no copiar los estados de una rama sobre otra como si compartieran implementación. Los contratos y decisiones confirmadas siguen siendo el objetivo a contrastar. No se declara T3-05 completada por encontrar esa marca en otro backlog sin pruebas E2E/modelo real.
