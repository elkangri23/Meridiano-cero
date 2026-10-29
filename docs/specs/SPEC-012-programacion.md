# SPEC-012 Programación y revisión

Estado: vigente para todos los cambios. 2026-10-27. REQ-Q01/Q02/Q03/Q04/Q12.

## KISS, DRY y modularidad

Crear archivos por responsabilidad real y paquetes cuando exista consumidor o límite comprobable. Nada de carpetas vacías para simular arquitectura, repositorios genéricos, clases base, service locators o frameworks internos. Preferir composición y funciones explícitas. No duplicar reglas en frontend/IA: la UI puede anticipar presentación, pero el servidor decide.

Una sola definición de contratos públicos y validación estructural; no exportar secretos de CaseDefinition al bundle web para reutilizar tipos. Compartir tipos puros de PlayerView, no el expediente completo. Evitar paquetes shared convertidos en cajón de sastre.

DRY aplica a conocimiento repetido, no exige unir dos comportamientos distintos por parecerse. Extraer cuando el cambio conjunto esté demostrado; dejar unas líneas parecidas puede ser más simple que una abstracción prematura.

## Límites de dependencias

- web → contratos públicos/UI; nunca engine, DB o configuración de secretos.
- api → contratos, engine, persistencia e integración IA.
- engine → case-schema/tipos puros; sin HTTP, framework, DB ni adaptador IA.
- case-generator → case-schema y adaptadores; usa engine para simular.
- ai-adapters no depende de web ni API; no muta partidas.
- worker (fase 4) reutiliza servicios de generación, sin importar controladores HTTP.
- Sin ciclos. No importar apps desde packages.

## Reglas de código

TypeScript strict con noUncheckedIndexedAccess; prohibido any o non-null assertions sin motivo excepcional documentado y validación en frontera. Manejar resultados como uniones discriminadas; never para exhaustividad. Funciones con nombres de dominio y parámetros tipados; comentarios explican decisiones, no traducen cada línea.

Configuración parseada y validada al arrancar; fallo claro ante secretos ausentes. Consultas parametrizadas. Dependencias inyectadas solo donde hay frontera real (repositorio, reloj real operativo, proveedor). Motor puro sin contenedor de inyección.

No ocultar excepciones con catch vacío ni capturar todo como éxito. Separar error de usuario, conflicto y fallo operativo; conservar causa solo en registro protegido. Liberar recursos, abortar peticiones y cerrar conexiones al terminar.

Revisión obligatoria al superar complejidad ciclomática 10 en una función de producción: dividir por responsabilidad o justificar excepción en revisión. Evitar límites arbitrarios de líneas; revisar componentes/controladores que mezclen coordinación, reglas y persistencia.

## Pruebas y herramientas

Vitest: reglas e integración. Playwright: flujos y accesibilidad básica, más revisión manual de teclado/lector. Dobles de IA deterministas para CI; modelos reales en evaluación separada con resultados registrados.

CI prevista en fase 1: formato comprobado sin reescritura, ESLint, tsc sin emitir, pruebas pertinentes, reglas de imports/ciclos, secretos y análisis de dependencias. Elegir versiones mantenidas al implementar y fijarlas en lockfile. No introducir dependencias para tareas cubiertas por plataforma o pocas funciones claras.

Cambios de motor requieren escenarios de comportamiento, no tests que repitan la implementación. Cambios documentales usan verificación de enlaces y trazabilidad; no se añaden tests de producto ficticios.

## Definición de terminado

Criterios aceptados; pruebas ejecutadas y registradas; revisión KISS/DRY/responsabilidades; seguridad asociada; cero código muerto o secretos; documentación coherente; limitaciones visibles. No llamar completa una fase parcial ni afirmar cumplimiento OWASP por tener un workflow.

Dependencia nueva: necesidad, alternativa simple, licencia, versión, mantenimiento y uso documentados en el cambio. Retirar la dependencia si desaparece su consumidor.

## Frontera de integridad del expediente

La entrada @meridiano/case-schema/server usa Node crypto para integridad y solo se consume desde servidor/pruebas. Motor recibe huella preparada y no importa esa entrada, ni directa ni por reexportación de la raíz de case-schema. Dependency-cruiser comprueba ambas fronteras además de las prohibiciones existentes; no se relaja engine-pure para aceptar Node.

Un artefacto sin manifest, módulo de tipos ni consumidores no se convierte en UI de producto para silenciar lint. Se retira el componente obsoleto packages/web/RetroScreen tras comprobar ausencia de imports; la aplicación vigente es apps/web y su prototipo usa datos públicos. No se elimina documentación histórica ni originales. [Evidencia y controles](../quality/T2-motor-puro-integridad.md).
