# Registro de especificaciones

Actualizado: 2026-10-28. Las doce specs tienen contenido desarrollado. El [estado de ejecución](../plan/ESTADO.md) se mantiene separado del estado del contrato. Definida es contrato documental; propuesta indica valores que deben cerrarse en su tarea, no código aprobado.

| ID | Sistema y documento | Estado | Tarea de cierre |
|---|---|---|---|
| SPEC-001 | [Motor](SPEC-001-motor.md) | Definida para fixture | T2-01 |
| SPEC-002 | [Expediente](SPEC-002-expediente.md) | Fixture y contrato detallado de guardados; integración pendiente | T2-01 |
| SPEC-003 | [Caso fijo](SPEC-003-caso-fijo.md) | Propuesta completa | T2-02 |
| SPEC-004 | [API y sesiones](SPEC-004-api.md) | DTO/rutas/errores T3 detallados; sin implementación de partidas | T1-01; T3-01 |
| SPEC-005 | [IA](SPEC-005-ia.md) | Contrato de conversación detallado; servicios parciales y evaluación real pendiente | T3-01; T3-04 |
| SPEC-006 | [Interfaz](SPEC-006-interfaz.md) | Prototipo retro; integración/accesibilidad pendientes | T3-01; T5-05 |
| SPEC-007 | [Generación](SPEC-007-generacion.md) | Detallada propuesta | E4-01 |
| SPEC-008 | [Carrera](SPEC-008-carrera.md) | Cifras por calibrar | T5-04 |
| SPEC-009 | [Instalación y recuperación](SPEC-009-operacion.md) | Detallada propuesta | T1-01; E6-01 |
| SPEC-010 | [Servicio público](SPEC-010-publico.md) | Cuotas por medir | E7-01; T7-01 |
| SPEC-011 | [Seguridad](SPEC-011-seguridad.md) | Diseñada, sin verificación de producto | T1-01; T7-04 |
| SPEC-012 | [Programación](SPEC-012-programacion.md) | Vigente para todo cambio | T1-02 |

## Decisiones antes de implementar

Base: versiones y parámetros de auth. Primer caso: modelo probado y wireframes. Generación: calibración de límites. Carrera: fórmulas/rangos mediante playtest. Distribución: imágenes, bootstrap y RPO/RTO medidos. Público: protocolo/cuotas FreeLLMAPI, retención, dominio y operación.

Las tareas de cierre resuelven estas decisiones y registran evidencia antes del código dependiente. Ningún valor propuesto se convierte en definitivo por aparecer aquí. No reducir requisitos silenciosamente para cerrar una fase. Las specs describen comportamiento/contratos, ADR decisiones y manuales el uso previsto.

Detalle transversal de SPEC-005/009/010/011: [proveedores, endpoints y claves por entorno](IA-proveedores.md). Amplía las doce specs existentes; no constituye una spec adicional ni soporte ya implementado.

## Anexos técnicos del primer caso

- [API de juego](API-juego.md): DTO, unión de acciones, endpoints, errores, idempotencia y recuperación.
- [Guardados](GUARDADOS.md): autoguardado, diez manuales, snapshots, carga, ramas y resultado oficial.
- [Conversaciones](CONVERSACIONES.md): conocimiento, reglas, contexto, memoria, actos y fallos.
- [Aceptación detallada](../quality/T3-aceptacion-detallada.md): 68 subcasos previstos.

Amplían las specs registradas, no crean nuevas specs numeradas ni acreditan implementación. Las decisiones de producto confirmadas mandan sobre los apartados preliminares; los anexos concretan la integración T3.
