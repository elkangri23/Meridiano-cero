# Estado integrado del proyecto

Actualizado: 2026-10-28. Combinación de main 6f43ba2 y codex/t3-04-integracion-ia 3a28abd, preparada en worktree separado para integrar en main. [Evidencia de integración](../quality/INTEGRACION-T3-04.md). Las instantáneas previas de T1/T3 conservan su alcance histórico.

El [backlog](BACKLOG.md) conserva dependencias; este documento refleja código y verificaciones de la combinación, sin declarar el juego terminado.

## Implementación disponible

| Área | Disponible | Pendiente |
|---|---|---|
| Base | Cinco proyectos de producto más la raíz pnpm | No distribución del juego completa |
| API | Health, readiness DB/ledger, configuración y sesión local PostgreSQL | Sin rutas de partidas registradas en createApp |
| DB | compose.yaml, migrador/ledger, roles y semilla locales; evidencia histórica F1 | Guardados y transacciones del juego; resolver esquema paralelo db antes de conectar |
| Motor | Fixture, acciones, reloj, solicitudes y desenlaces | Calidad global y adaptación a los DTO detallados |
| UI | Prototipo de desarrollo en /prototype | Flujo conectado, ventanas, manuales, preferencias persistidas y revisión accesible |
| IA | Frontera AiProvider, adaptador Ollama y doble, memoria factual y evaluación CLI | Adaptadores externos, configuración y conexión al juego |
| CI | Workflow único con controles de base/seguridad y corpus IA | La ejecución local global no está verde |

packages/web/RetroScreen es un artefacto heredado sin manifest/consumidor en la aplicación. Tiene errores de sintaxis y solicita datos privados de CaseDefinition/cooperación; no debe conectarse a web como sustituto del DTO autorizado. La integración lo conserva sin ampliar exposición. No existe un paquete ai-adapters versionado en esta combinación; trabajo no versionado en otro checkout queda fuera del merge.

## Verificación de la combinación

- Instalación congelada correcta, con versiones fijadas; se eliminó una entrada Vite idéntica duplicada que impedía parsear el lockfile de main.
- Build completo y typecheck completo correctos.
- 157 pruebas correctas, doce archivos, sin integración PostgreSQL real en esta ejecución.
- Lint del módulo IA correcto; corpus determinista de 17 escenarios correcto.
- Smoke HTTP web/proxy/API y escaneo local por patrones correctos.
- Lint global: nueve errores heredados de main, incluidos complejidad y componente no consumido.
- Imports: siete infracciones heredadas (contratos/case-schema y engine con crypto/tests).
- Formato: 22 archivos heredados señalados; no se debilitan sus controles.
- Verificación documental y revisión de diff en el [registro](../quality/INTEGRACION-T3-04.md).

Las 146 pruebas del avance T3-04 y las 71 de main son referencias previas; la combinación tiene 157, no la suma de ambas porque comparten pruebas. Los 68 subcasos detallados siguen siendo escenarios previstos hasta ejecutarse y mapear evidencia.

## Fases y próximos pasos

T1 tiene entrega técnica local incorporada con evidencias históricas F1; no se infiere CI remota aprobada. T2 tiene implementación funcional y calidad pendiente. T3-01/02/03/04 están en curso; T3-05 espera E2E/modelo real. Fases 4–7 pendientes.

1. Resolver calidad heredada y consolidar esquemas/rutas sin aceptar código no consumido como producto.
2. Implementar los DTO públicos y API-juego: ownership, preview/commit, idempotencia, ramas y transacciones.
3. Conectar guardados/manuales, política NPC y UI, manteniendo el primer resultado oficial.
4. Evaluar el proveedor real disponible cuando haya acceso, sin exigir Ollama en trabajo/VPS.
5. Ejecutar ambas rutas en navegador, reanudación y teclado conforme al catálogo detallado.

## Arranque vigente

[BASE-LOCAL](../manuales/BASE-LOCAL.md) describe setup:local, compose.yaml para PostgreSQL y db:migrate; API y Vite van en host. Ese procedimiento sustituye las limitaciones antiguas que decían que no había migrador/readiness/sesión.

docker-compose.yml es otro stack heredado que no debe confundirse con compose.yaml ni mezclarse con sus volúmenes. No se modifican secretos, configuración privada, Docker o WSL para integrar esta rama.

## Aclaraciones de producto incorporadas

El usuario confirma cuentas registradas y casos en solitario, con un detective jugador por partida y sin multijugador local/VPS. El primer caso jugable debe incluir autoguardado y guardado manual, ventanas movibles/minimizables y aclaración previa de órdenes ambiguas. Referencias DEC-013/014/015/016 en BASELINE. Se han documentado; todavía no se declaran implementadas.

DEC-017 confirma retroceder cargando un guardado manual del mismo caso. Es una decisión documentada, no una capacidad ya conectada al prototipo; DEC-020 fija el primer resultado definitivo para carrera y reputación.

## Proveedores: alcance aclarado

DEC-018/019: Ollama doméstico; FreeLLMAPI en trabajo/VPS; instalaciones propias con proveedor/endpoint configurable. El VPS ofrecerá proveedor del administrador y claves personales opcionales. Solo están implementados adaptador Ollama, doble y contrato de servicio común; no se declara soporte externo ni almacenamiento de claves por cuenta. La ausencia de Ollama en el trabajo no bloquea programar; la evaluación real espera acceso al proveedor elegido. [Contrato detallado](../specs/IA-proveedores.md).

## Detalle técnico desarrollado, sin nueva implementación

La ampliación documental concreta [API](../specs/API-juego.md), [guardados](../specs/GUARDADOS.md), [conversaciones](../specs/CONVERSACIONES.md) y [68 subcasos de aceptación](../quality/T3-aceptacion-detallada.md). DEC-021 confirma diez manuales por partida, además del autoguardado.

Se fijan DTO públicos sin payload interno, revisión HTTP separada del estado restaurable, ramas, orden de idempotencia, protección del primer resultado y contratos de memoria/ventanas. La suite de producto sigue siendo la última de 146 pruebas; no se ha ejecutado código nuevo ni se declaran aprobados estos 68 escenarios.
