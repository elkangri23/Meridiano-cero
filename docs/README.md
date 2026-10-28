# Documentación de implementación

Estado: fase 1 en desarrollo. T1-01, T1-02 y T1-03 completadas. T1-04 (CI) pendiente. Web/API con PostgreSQL, migración y readiness implementados. Sesión, caso jugable y generación pendientes. Evidencia en BACKLOG y docs/quality/.

## Orden de lectura

1. [Roadmap](plan/ROADMAP.md) y [decisiones de alcance](plan/BASELINE.md).
2. [Requisitos](plan/REQUISITOS.md), [backlog](plan/BACKLOG.md) y [registro de specs](specs/README.md).
3. [Arquitectura](architecture/ARQUITECTURA.md), [ADR](adr/README.md), [seguridad](specs/SPEC-011-seguridad.md) y [guía de programación](specs/SPEC-012-programacion.md).
4. [Pruebas previstas](quality/ACEPTACION.md) y [evidencia de fase 0](quality/FASE-0.md).
5. [Fuentes recuperadas](meridi/DOCUMENTOS.md).

## Guías y detalle completo

- [Funcionalidades que implementaremos](plan/FUNCIONALIDADES.md).
- [Tareas detalladas de todas las fases](plan/TAREAS.md).
- [Decisiones y mediciones pendientes](plan/DECISIONES-PENDIENTES.md).
- [Manuales de uso, desarrollo, instalación, operación y pruebas](manuales/README.md).
- [Glosario de dominio](architecture/GLOSARIO.md).

Las doce specs tienen contenido desarrollado. Las cifras propuestas que necesitan medición, equilibrio o datos del proveedor se identifican expresamente y se cierran en la tarea correspondiente. Los comandos de producto de los manuales son objetivos futuros, no procedimientos ejecutados.

La autorización actual establece el plan de implementación y la entrega inicial documental. Los ADR de estructura aceptados derivan de ese plan; los parámetros del caso fijo son una propuesta concreta para el primer hito. Las fases 1–7 permanecen pendientes.

Cada requisito tiene un ID estable, fuente, spec, tarea responsable y escenario de aceptación. Un escenario definido no constituye evidencia de que el producto funcione. Al ejecutar una tarea, registrar comando, entorno, revisión y resultado en el registro del hito; nunca sustituir esta evidencia por una casilla marcada.

## Flujo de trabajo

Tomar una tarea preparada del backlog, cerrar la spec aplicable, implementar el cambio mínimo, ejecutar sus comprobaciones y revisar el hito con el usuario. Actualizar la trazabilidad en el mismo cambio. Los cambios de reglas necesitan decisión explícita registrada en BASELINE y, si alteran arquitectura, un ADR que sustituya al anterior.

Plantillas: [spec](templates/spec.md), [ADR](templates/adr.md), [tarea](templates/tarea.md), [evidencia](templates/evidencia.md).

## Avance T3

[Interfaz inicial y verificaciones](quality/T3-inicio.md), [frontera de presentación](specs/T3-presentacion-inicial.md). Prototipo solo en desarrollo: http://127.0.0.1:5174/prototype. No es una investigación jugable ni una IA conectada.
