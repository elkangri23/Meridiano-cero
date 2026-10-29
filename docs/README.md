# Documentación de implementación

Revisión de bordes de ejecución: [hallazgos y 90 escenarios](quality/BORDES-EJECUCION.md), [contrato de resiliencia](specs/RESILIENCIA.md), [observabilidad y residencia de datos](specs/OBSERVABILIDAD-Y-DATOS.md). Las nuevas tareas están en BACKLOG y TAREAS; son trabajo pendiente de implementación y verificación.

[Evidencia y límites de esta revisión documental](quality/REVISION-BORDES.md).

Actualizado: 2026-10-28. Base PostgreSQL con migrador/sesión, motor, prototipo y servicios IA combinados. [Estado integrado](plan/ESTADO.md), [registro de merge](quality/INTEGRACION-T3-04.md): 157 pruebas correctas y controles globales heredados pendientes. API de partidas, guardados y evaluación real siguen sin conectar.

## Orden de lectura

1. [Estado actual](plan/ESTADO.md), [Roadmap](plan/ROADMAP.md) y [decisiones de alcance](plan/BASELINE.md).
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

Las doce specs tienen contenido desarrollado. Las cifras propuestas que necesitan medición, equilibrio o datos del proveedor se identifican expresamente y se cierran en la tarea correspondiente. Los manuales distinguen comandos existentes, ejecuciones registradas y procedimientos futuros; consultar el estado antes de usar un runbook.

La autorización actual establece el plan de implementación y la entrega inicial documental. Los ADR de estructura aceptados derivan de ese plan; los parámetros del caso fijo son una propuesta concreta para el primer hito. Las fases 1 y 3 están en curso; la fase 2 tiene implementación funcional con calidad pendiente; las fases 4–7 no han comenzado.

Cada requisito tiene un ID estable, fuente, spec, tarea responsable y escenario de aceptación. Un escenario definido no constituye evidencia de que el producto funcione. Al ejecutar una tarea, registrar comando, entorno, revisión y resultado en el registro del hito; nunca sustituir esta evidencia por una casilla marcada.

## Flujo de trabajo

Tomar una tarea preparada del backlog, cerrar la spec aplicable, implementar el cambio mínimo, ejecutar sus comprobaciones y revisar el hito con el usuario. Actualizar la trazabilidad en el mismo cambio. Los cambios de reglas necesitan decisión explícita registrada en BASELINE y, si alteran arquitectura, un ADR que sustituya al anterior.

Plantillas: [spec](templates/spec.md), [ADR](templates/adr.md), [tarea](templates/tarea.md), [evidencia](templates/evidencia.md).

## Avance T3

[Interfaz inicial y verificaciones](quality/T3-inicio.md), [frontera de presentación](specs/T3-presentacion-inicial.md). Prototipo solo en desarrollo: http://127.0.0.1:5174/prototype. No es una investigación jugable ni una IA conectada.

[Integración IA T3-04 y evidencia parcial](quality/T3-04.md), con [manual de evaluación](manuales/IA-LOCAL.md). Modelo real y conexión a partidas pendientes.

[Contrato de proveedores y claves por entorno](specs/IA-proveedores.md): Ollama doméstico, FreeLLMAPI en trabajo/VPS, instalaciones propias configurables y proveedor común con claves personales opcionales en VPS.

## Contratos técnicos desarrollados para programar T3

[API](specs/API-juego.md), [guardados](specs/GUARDADOS.md), [conversaciones](specs/CONVERSACIONES.md) y [68 subcasos de aceptación](quality/T3-aceptacion-detallada.md). Incluyen campos, validaciones, errores, transacciones, reintentos y comportamiento entre ramas. El código actual aún debe adaptarse; no son pruebas ejecutadas ni cierre automático de tareas.

[Revisión de contradicciones y mejoras de coste bajo/medio](quality/REVISION-CONTRATOS-T3.md), con alcance de rama y pendientes previos a integración.

Revisión de implementación y cumplimiento parcial del commit normativo: [auditoría de 7962014](quality/AUDITORIA-7962014.md), con seguimiento de los 90 escenarios.
