# T2: permisos factuales del testimonio v13

Fecha: 2026-10-29. Continuación autorizada en worktree; sin commit, merge, push o despliegue. Conserva cambios anteriores sin commit. Referencias: SPEC-001/002/005, CONVERSACIONES, SPEC-012 y estándares de 7962014ec7031c3694f2378d3983a5e488499239.

## Defecto y corrección

El motor revelaba EV-09 al hablar con Lucía sobre caja si su cooperación era positiva, incluso cuando su knowledge ya no incluía el conocimiento correspondiente. Esas variantes podían pasar el validador estructural: eliminar un conocimiento es una definición válida, pero no debe conservar su permiso de revelación.

La transición ahora comprueba que la NPC declarada conserva tomas-moved-box, además de ser Lucía, tema caja y relación vigente positiva. Presencia/NPC accesible siguen verificados por el resolutor de conversación. Un conocimiento distinto, aunque sea un hecho válido del expediente o token legado reconocido, no sustituye ese permiso. No se revela EV-09, su admisibilidad o procedencia; el evento talk contiene factIds vacío. La definición y la partida de entrada no se mutan.

El tema identidad conserva identificación verificable del propio NPC presente. No revela identidad ajena, culpabilidad o conocimiento privado; no depende del permiso de declarar sobre la caja. No se transforma silencio sobre el robo en anonimato físico. Temas de solución, aliases o instrucciones en el topic no añaden hechos.

No se crea un sistema de reglas paralelo ni se duplica el resolutor: la comprobación se añade al punto de revelación factual ya usado por conversación individual y lote. El validador 1.3 de referencias no cambia. Conversación completa, presión/cobertura, condiciones declarativas y memoria semántica siguen pendientes.

## Compatibilidad

ENGINE_VERSION=13 distingue la autorización factual corregida. Nueva creación persiste v13; lectura estricta de inicios v1–v12 sin reescritura; progreso previo conservado/rechazado, sin aplicación automática de reglas nuevas. Definición original, engineCompatibility=1, seed y hash no cambian.

La definición original mantiene su testimonio y rutas. Variantes que retiran conocimiento o cooperación de Lucía deben seguir resolubles por las rutas materiales A/B, sin insertar pistas en el estado. No se cierra el caso ni se penaliza por el fallo técnico corregido.

## Escenarios

npc-knowledge.test.ts verifica el original y procedencia, tres variantes válidas sin conocimiento específico, cooperación cero con token presente, identificación propia sin datos del robo, otro NPC/presencia en otra ciudad, cuatro temas no autorizados, lote que no puede solicitar orden con EV-09 ausente, reanudación sin inventar testimonio, repetición sin duplicar prueba/procedencia y rechazo de ejecución v12.

simulation.test.ts añade rutas A/B con knowledge vacío y cooperación cero en Lucía, seed=14194 (ambos retrasos máximos). Parten de createInitialRun y acciones reales del motor; tiempos 545/575, resultado complete y ausencia de EV-09. Son simulaciones puras, no E2E ni revisión humana del caso. Las rutas habituales individuales/agrupadas permanecen.

La integración PostgreSQL/HTTP amplía lectura inicial sin reescritura hasta v12 y creación v13; no habilita conversación HTTP ni proyecta progreso por anticipación.

## Verificación ejecutada

- pnpm lint e imports correctos: 151 módulos y 419 relaciones sin infracciones. Complejidad máxima diez y motor puro conservados. El ajuste posterior del test parametrizado también pasó ESLint.
- pnpm test: 508 pruebas correctas en 34 archivos, dieciséis escenarios nuevos (catorce de permisos y dos rutas sin conocimiento/cooperación).
- pnpm typecheck y pnpm build completos correctos. El primer intento detectó el uso incorrecto de una tabla it.each de arrays; se cambió a filas con propiedad knowledge, sin cambiar la regla de producto ni relajar tipos, y se repitió la suite completa.
- pnpm test:integration: 47 pruebas correctas en cinco archivos; PostgreSQL/HTTP sintético aislado meridiano-cero-t3-persistence-test, puerto 15434; lectura inicial hasta v12 sin reescritura.
- pnpm smoke correcto con página/TSX y proxy web/API por HTTP real en loopback; no acredita E2E de investigación.
- pnpm scan:secrets sin hallazgos por patrones, sin garantía exhaustiva.
- scripts/verify_docs.py: 92 Markdown, referencias/grafo válidos y hashes originales DOCX intactos; integridad documental, no aceptación de producto o controles OWASP.
- git diff --check correcto. pnpm check:format conserva ocho incidencias históricas; sin reescribir SQL ni debilitar su checker.

Base sintética detenida conservando volumen; base preexistente 15433 y WSL sin cambios.

## Límites

T2/T3 siguen abiertos: políticas completas de conocimientos/revelación, reglas/payloads declarativos, solvencia general y aceptación; API de acciones, guardados, resultado oficial, UI conectada y E2E pendientes. No proveedor real, CI remota, publicación o certificación OWASP/ASVS. Ocho incidencias históricas de formato siguen abiertas.
