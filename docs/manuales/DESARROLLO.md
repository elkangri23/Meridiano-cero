# Desarrollo y contribución

Estado: instrucciones de producto previstas, pendientes de verificar desde fase 1. No ejecutar comandos de arranque esperando una aplicación existente.

## Qué existe ahora

Fuentes GDD/TAD, requisitos, roadmap, specs, ADR, tareas y escenarios de aceptación. No hay package.json, lockfile, Compose, base de datos ni frontend implementados. No se han instalado dependencias ni inicializado Git como parte de documentación.

Se puede comprobar la documentación con Python 3: `python scripts/verify_docs.py`. No requiere paquetes externos ni red.

## Entorno objetivo

Windows con PowerShell y Docker Compose; Node LTS y pnpm para desarrollar. Ollama o LM Studio en host para IA local. Versiones exactas y requisitos de memoria se fijarán con pruebas de entorno; no se inventa que cualquier modelo sirve por disponer de una GPU concreta.

PostgreSQL en Docker también durante desarrollo. Configuración local privada separada de ejemplos versionados. Las claves no entran en frontend, capturas, tests ni logs.

## Estructura prevista

apps/web: interfaz React/Vite. apps/api: Fastify y coordinación/persistencia. apps/worker aparece al introducir trabajos de generación. packages/engine: reglas puras. packages/case-schema: validación del expediente. Otros paquetes de IA, generador, contratos y UI se crean cuando hay uso real.

No crear el árbol completo por adelantado con archivos vacíos. Los límites están en SPEC-012; no importar apps desde paquetes ni usar contratos secretos en web.

## Flujo de una tarea

1. Escoger tarea preparada con dependencias satisfechas.
2. Leer requisitos, spec, ADR y controles asociados.
3. Cerrar decisiones pendientes de esa tarea antes de implementar.
4. Cambiar solo lo necesario y añadir comprobaciones de comportamiento.
5. Ejecutar tipos/lint/pruebas pertinentes y revisar diff.
6. Registrar resultados reales y actualizar trazabilidad/estado.
7. Demostrar el hito al usuario.

Si aparece una contradicción, registrar decisión en BASELINE; si es arquitectura, nuevo ADR. No modificar silenciosamente los Word ni las reglas del juego. Una refactorización debe conservar comportamiento y tener evidencia; no reescribir módulos completos por gusto.

## Comandos objetivo aún no existentes

| Comando | Función que deberá implementarse |
|---|---|
| pnpm install --frozen-lockfile | Instalar versiones fijadas una vez exista lockfile |
| pnpm dev | Desarrollo web/API contra configuración local |
| pnpm build | Construcción reproducible |
| pnpm typecheck | Tipos sin emitir |
| pnpm lint | Reglas y límites sin modificar archivos |
| pnpm test | Motor y comprobaciones automatizadas |
| pnpm test:e2e | Flujos de navegador |

El procedimiento definitivo incluirá variables necesarias, URL local y salidas esperadas después de probarlo. Los scripts de migración no se ejecutarán implícitamente contra una DB elegida por accidente.

## Código y dependencias

KISS, DRY y tipos estrictos según SPEC-012. Favorecer módulos cohesionados y funciones explícitas. No clases base, repositorios universales, service locator ni abstracciones sin necesidad. Contratos públicos únicos; engine no necesita IA para probarse.

Cada dependencia nueva debe aportar una capacidad usada, con licencia compatible y mantenimiento comprobado. No usar un paquete grande para reemplazar pocas líneas claras. No inventar mecanismos de auth o criptografía para ahorrar dependencia.

## Revisión y contribuciones

Una contribución describe problema, cambio, requisitos, pruebas y limitaciones. No confundir mock con evaluación real de IA. No enviar datos personales o claves en issues. Antes de publicar normas definitivas, cerrar autoría/licencias y el procedimiento de contribuciones. GitHub no se crea ni se publica automáticamente por existir estos documentos.
