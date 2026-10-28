# Documentación de implementación

Estado: fase 1 en desarrollo. La base web/API inicial se incorpora en T1-02; DB, sesión y caso jugable están pendientes. Evidencia y dependencias en BACKLOG.

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
