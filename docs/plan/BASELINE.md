# Base de producto y decisiones de alcance

Fecha: 2026-10-27. Fuente de autoridad: instrucciones actuales del usuario; después decisiones expresas recuperadas; después GDD para mecánicas y TAD para arquitectura. Los originales se conservan sin cambios.

| ID | Diferencia | Resolución para implementar | Procedencia |
|---|---|---|---|
| DEC-001 | GDD exige PWA; TAD no | Web responsiva; PWA opcional futura | Plan aceptado y TAD §2 |
| DEC-002 | GDD propone FreeLLMAPI en desarrollo | Ollama local inicialmente; proveedor externo configurable; FreeLLMAPI futuro en público | Usuario en Meridi y plan |
| DEC-003 | GDD técnico preliminar; TAD y chat difieren en carpetas | React/Vite, Fastify, motor puro, PostgreSQL/Drizzle; worker solo en fase 4 | Comparación y elección del usuario |
| DEC-004 | Portada GDD borrador; TAD lo llama aprobado | Requisitos GDD son objetivo v1 por confirmación actual; no inventar aprobación histórica | Plan aceptado |
| DEC-005 | TAD propuesta pendiente de aprobación | Arquitectura seleccionada por usuario; detalles aquí fijados se registran como decisiones de implementación | Plan aceptado |
| DEC-006 | Primer caso frente a generación inmediata | Caso fijo completo primero; generador después | Elección expresa del usuario |
| DEC-007 | Autoría y nombre | Meridiano-cero es carpeta/proyecto; A.C.M.E. provisional. Confirmar marca y atribución antes de publicación | GDD §19 y TAD §15 |
| DEC-008 | AGPL-3.0 frente a variante | Objetivo AGPL-3.0-only del TAD/plan; no añadir obligaciones legales no revisadas | Plan y TAD |
| DEC-009 | Todo el GDD frente a MVP reducido | V1 cubre todo el GDD; hitos intermedios parciales y etiquetados | Elección expresa del usuario |
| DEC-010 | Calidad y seguridad | KISS, DRY, módulos con límites, OWASP 2025 y ASVS 5.0.0 aplicable | Instrucción expresa del usuario |
| DEC-011 | Import/export contiene solución | Descarga explícita del expediente completo por dueño autorizado; nunca en proyección normal de juego | GDD §17 y ADR-009 |
| DEC-012 | Ayuda frente a fallo técnico | Mostrar errores operativos sin sugerir pistas ni valorar rumbo de investigación | GDD §1 y SPEC-005 |

## Inicio de T3 en paralelo

El 2026-10-28 el usuario autoriza adelantar T3 antes del cierre de T2. Se permiten contratos y UI con muestras públicas; no se trasladan reglas al cliente ni se declara integración completa sin motor, seguridad y pruebas.

## Decisiones de producto aún abiertas

Estas decisiones bloquean su tarea, no la base ni el motor: marca y atribución final (fase 6); parámetros numéricos de carrera y variedad (fase 5); arte/sonido y licencias definitivas (fase 5); catálogo ampliado y tiempos realistas (fase 5); modelos de referencia (antes de evaluar fase 3); protocolo, condiciones y cuotas FreeLLMAPI y políticas de retención (fase 7).

El caso fijo usa tiempos de prueba declarados, no horarios de vuelo reales. Sus parámetros no se convierten automáticamente en equilibrio universal del generador.

Fuera de v1: comunidad pública de casos, multijugador, pagos, aplicaciones nativas, ejecución offline integral y federación. No se elimina ningún requisito del GDD sin registrar cambio aprobado.
