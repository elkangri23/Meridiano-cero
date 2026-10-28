# Inicio de T3: interfaz desacoplada

Fecha: 2026-10-28. Estado: INICIADO, no fase terminada. Autorización del usuario: adelantar T3 aunque T2 no estuviera terminado. Worktree t3-interfaz-inicial; rama codex/t3-interfaz-inicial.

## Base real encontrada

Al inspeccionar main ya existía el motor y T2-01 a T2-06 figuraban completadas (base 425c798). Se reutiliza el tipo público PlayerView mediante contracts; no se importa engine, su fixture ni CaseDefinition en el navegador. Sus 60 pruebas existentes pasan, pero el lint global no: no confundir estado del backlog con aceptación de calidad.

El cierre alternativo de T1 se conservó en 212241c, rama codex/t1-base-docker. main divergió por trabajo simultáneo; no se forzó integración ni se sustituyeron sus archivos de base. Este worktree T3 parte de main, no de esa rama alternativa.

## Entregado en esta primera parte

Ruta de desarrollo /prototype con interfaz retro responsive, escenario ambiental original CSS, reloj, dossier, atlas de tres ciudades, laboratorio, comunicaciones y ajustes de lectura/contraste. Entrada de órdenes y diálogo nativo de confirmación. Muestras públicas tipadas; sin solución, resultados futuros ni personajes secretos.

La vista no ejecuta acciones, no avanza tiempo ni modifica pruebas. Las acciones del mapa preparan un borrador. La duración no se inventa: aparece pendiente de estimación. No se simula un LLM ni se incluye un intérprete alternativo en web. El texto de entrada se representa con React sin HTML arbitrario.

Solo se carga mediante import dinámico bajo import.meta.env.DEV. El build de producción elimina esa rama y los datos de muestra. No se cambia la pantalla inicial ni se habilita registro o IA por introducir este prototipo.

## Comprobaciones ejecutadas

| Comprobación | Resultado y límite |
|---|---|
| pnpm --filter @meridiano/web... build | Tipos y build web/dependencias correctos |
| ESLint de apps/web/src | Correcto; no certifica el resto del proyecto |
| pnpm test | 60/60 existentes correctas; no son E2E del nuevo prototipo |
| HTTP a /prototype, Prototype.tsx, ToolPanel.tsx y CSS | 200; Vite transforma los módulos |
| Inspección del JS de producción | Ausentes T3_PUBLIC_PREVIEW_ONLY, astrolabioDefinition y node:crypto |
| Navegador integrado | No pudo adjuntar webview; revisión visual/teclado/móvil NO EJECUTADA |
| pnpm lint global | FALLA con siete errores heredados de T2; no se desactivaron reglas |

Errores heredados: complejidad 71 en validateCaseDefinition y resolveAction; 19 en processMaturedRequests; _vr no usado; dos tests de simulación con complejidad 15 y un prefer-const. Ninguno se introduce en los archivos de T3. Resolverlos antes de integrar y cerrar el hito.

El estado de Ollama se consulta en lectura; si no hay endpoint disponible no se elige modelo ni se inventa evaluación. El cierre de modelo real/corpus de T3-01 sigue pendiente.

## Siguiente parte y gates

Cerrar contrato de presentación/API con campos revelados y metadatos legibles. PlayerView actual contiene pendientes con payload desconocido: T3-02 debe construir proyección explícita y probar ausencia de secretos; no reenviar JSON interno automáticamente.

Integración real de acciones, confirmación con versión/idempotencia, persistencia y evaluación del modelo siguen pendientes. No se marca T3-01 ni T3-03 completada por crear esta vista. Las ventanas móviles/minimizables, audio completo y revisión WCAG pertenecen al alcance registrado y no están implícitamente entregadas.

Sin commit, merge, push ni despliegue de T3. Servidor local de muestra en 127.0.0.1:5174; parada mediante Ctrl+C en la sesión de desarrollo.

## Comprobación adicional de arquitectura

pnpm check:imports falla con siete infracciones heredadas: contracts reexporta tipos desde case-schema, engine usa crypto y la regla engine-pure también alcanza cinco archivos de pruebas que importan Vitest. Se deben separar incumplimientos de producción de alcance incorrecto de reglas de pruebas; no se desactivó ninguna regla para ocultarlos. El lint de web y su build sí pasan.

La consulta a 127.0.0.1:11434/api/tags no obtuvo respuesta desde este entorno. No demuestra que Ollama no esté instalado; no se ha seleccionado/evaluado modelo ni cambiado configuración.

Validación documental: 52 Markdown, 107 requisitos, 39 tareas, 12 specs, 10 ADR, 40 escenarios y 15 controles; enlaces/IDs/grafo y originales Word correctos. La salida HTTP y la compilación no sustituyen revisión visual ni pruebas interactivas.
