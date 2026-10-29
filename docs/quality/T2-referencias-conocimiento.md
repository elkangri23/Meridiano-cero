# T2-01: referencias de conocimiento y solución

Fecha: 2026-10-29. Continuación autorizada en worktree; conserva cambios anteriores sin commit. Sin nuevo commit, merge, push o despliegue. Referencias: SPEC-002, SPEC-012, API-juego y estándares de 7962014ec7031c3694f2378d3983a5e488499239.

## Comportamiento

Facts se valida como lista de identificadores ASCII únicos. Knowledge de cada NPC no admite duplicados y debe apuntar a esos hechos. No se interpreta texto libre como hecho ni se infiere una identidad desde un nombre visible. Para casos generales solution debe ser el ID de un NPC existente.

El expediente original Astrolabio conserva su hash y sus tokens heredados: authorized-persons/tomas-moved-box en Lucía, tool-registry en Émile, deposit-record/locker-l7 en Marta, his-task en Tomás y truth en Inés. Esta excepción solo reconoce vocabulario histórico del NPC y caso correspondientes. No traduce tokens a hechos inventados, no concede permiso narrativo nuevo y no certifica conversación factual completa. Otro caso no hereda la excepción por compartir nombres o aliases.

La solución canónica original ines-valera referencia al NPC ines existente; tomas-rios al NPC tomas. El perfil explícito de sospechosos pasa a un módulo puro de compatibilidad en case-schema y lo reutiliza engine/fixed-case. Se elimina la definición duplicada del motor; no cambia comportamiento de identidad, ciudad o ubicación. Los objetos de sospechoso permanecen congelados y el nombre visible puede cambiar sin cambiar la identidad. Alias parcial, nombre visible o prefijo/sufijo no constituye referencia.

La raíz de case-schema exporta únicamente el ID del caso legado y la función de sospechosos necesarios al motor, además de sus exports previos. El vocabulario completo de conocimiento no se exporta por contratos públicos. Web sigue sin poder depender de case-schema/engine por el control de imports; no se incluyen tablas privadas en PlayerView ni contexto IA. La exportación usada añade newline correcto al index modificado, resolviendo esa incidencia de formato sin tocar SQL histórico.

## Validador y compatibilidad

Validador 1.3.0, etapa structural únicamente. Recorre colecciones acotadas, evita procesar listas excesivas otra vez y produce errores genéricos que no reproducen solución o conocimientos privados. No modifica definición, reporte del fixture, original Word, seed o hash. Referencia válida no acredita veracidad, posibilidad de revelación, dos rutas o solvencia.

Motor de ejecución sigue v12: solo se comparte el mismo perfil explícito que ya usaba, sin nuevas transiciones o reinterpretación de progreso. Nueva creación pasa por la puerta existente; referencias inválidas producen CASE_NOT_READY antes de runs/run_creations. Replay previo autorizado mantiene precedencia ante disponibilidad actual. No se reescriben partidas o intenciones.

## Pruebas de comportamiento

knowledge-validation.test.ts comprueba original intacto, alias compartido/congelado, independencia del nombre visible, solución general por NPC, hechos declarados, cuatro identidades fijas inválidas, NPC canónico ausente, ausencia de excepción en otros casos, token histórico en NPC incorrecto, conocimiento inexistente, hecho eliminado, duplicados de hechos/conocimientos, dos IDs de hecho inválidos, colecciones malformadas/excesivas, centinela privado ausente en errores y reporte estructural 1.3.

La prueba de mapa con una sola ciudad ahora usa un caso sintético con NPC/solución coherentes: no conserva una solución a un NPC eliminado. Continúa verificando que una ciudad no necesita viajes. Las pruebas de rutas completas/hash originales permanecen; no se altera el fixture para hacerlas pasar.

PostgreSQL añade un escenario que prueba solución y conocimiento inválidos: conserva replay de creación previa propia, rechaza nuevas intenciones y comprueba ausencia de nuevas partidas/filas de intención. Es integración sintética, distinta de pruebas de motor, E2E y aceptación manual.

## Verificación ejecutada

- pnpm lint e imports correctos: 148 módulos y 408 relaciones sin infracciones, con complejidad máxima diez y motor puro conservados.
- pnpm test: 492 pruebas correctas en 33 archivos, diecisiete escenarios adicionales; hash original y rutas completas siguen pasando.
- pnpm typecheck y pnpm build completos correctos.
- pnpm smoke correcto con página/TSX y proxy web/API por HTTP real en loopback; no equivale a E2E de investigación.
- pnpm scan:secrets sin hallazgos por patrones, sin garantía exhaustiva.
- pnpm test:integration: 47 pruebas correctas en cinco archivos; una adicional con dos variantes de referencias inválidas. PostgreSQL/HTTP sintético aislado en meridiano-cero-t3-persistence-test, puerto 15434.
- scripts/verify_docs.py: 91 Markdown, referencias/grafo válidos y hashes DOCX originales intactos; integridad documental, sin acreditar controles de producto/OWASP.
- git diff --check correcto. pnpm check:format señala ocho archivos históricos; la incidencia de case-schema/src/index.ts queda corregida al modificarlo, sin reescribir migraciones ni debilitar el control.

La base sintética se detuvo conservando volumen. Base preexistente 15433 y WSL sin cambios.

## Límites

T2-01 y T2/T3 siguen abiertos. Knowledge legado todavía no es el contrato completo de afirmaciones, condiciones de revelación, cooperación y memoria NPC de CONVERSACIONES. Rules sigue siendo vocabulario heredado sin DSL ejecutable genérico; payloads programados y solvencia general pendientes. No importador/generador, API de acciones, guardados, resultado oficial, UI conectada, proveedor real, CI remota o E2E. No certificación integral de OWASP/ASVS.
