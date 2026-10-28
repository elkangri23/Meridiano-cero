# Base de producto y decisiones de alcance

Fecha: 2026-10-27. Fuente de autoridad: instrucciones actuales del usuario; después decisiones expresas recuperadas; después GDD para mecánicas y TAD para arquitectura. Los originales se conservan sin cambios.

| ID | Diferencia | Resolución para implementar | Procedencia |
|---|---|---|---|
| DEC-001 | GDD exige PWA; TAD no | Web responsiva; PWA opcional futura | Plan aceptado y TAD §2 |
| DEC-002 | GDD propone FreeLLMAPI en desarrollo | Aclarada por DEC-018: Ollama en casa, FreeLLMAPI en trabajo/VPS; contrato independiente del proveedor | Usuario en Meridi y plan |
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
| DEC-013 | Identidad y modalidad de juego | El usuario se registra y elige un caso; una partida tiene un único usuario propietario y un detective jugador. Sin multijugador en local ni VPS. No implica limitar cuentas por instalación o casos por cuenta | Aclaración expresa del usuario, 2026-10-28 |
| DEC-014 | Guardado | Autoguardado y guardados manuales desde el primer caso; carga concretada en DEC-017/020 y límite en DEC-021 | Respuesta expresa del usuario, 2026-10-28 |
| DEC-015 | Ventanas del primer caso | Movibles y minimizables desde el primer caso jugable; no se difieren al acabado de fase 5 | Respuesta expresa del usuario, 2026-10-28 |
| DEC-016 | Órdenes ambiguas | Pedir aclaración antes de actuar; no elegir una interpretación ni ejecutar parcialmente una orden ambigua | Respuesta expresa del usuario, 2026-10-28 |
| DEC-017 | Carga de guardados manuales | Permite regresar a un punto anterior del mismo caso y probar otras decisiones; no permite duplicar recompensas por repetir | Confirmación expresa del usuario, 2026-10-28 |
| DEC-018 | IA por entorno | Casa: Ollama; trabajo/VPS: FreeLLMAPI. En instalaciones propias, proveedor/modelo/endpoint personalizables mediante adaptadores, sin acoplar motor o UI a un fabricante | Aclaración expresa del usuario, 2026-10-28 |
| DEC-019 | Proveedor en VPS | Proveedor del administrador disponible sin configurar claves; cada usuario puede aportar opcionalmente sus propias claves para otro proveedor desde la primera versión pública | Respuesta expresa del usuario, 2026-10-28 |
| DEC-020 | Resultado oficial del caso | Para carrera y reputación cuenta el primer resultado; cargas y repeticiones posteriores son práctica y no reemplazan el resultado ni duplican recompensas | Decisión expresa del usuario, 2026-10-28 |
| DEC-021 | Cantidad de guardados | Diez guardados manuales por partida de caso, además del autoguardado; no se borran manuales automáticamente al alcanzar el límite | Respuesta expresa del usuario, 2026-10-28 |

## Inicio de T3 en paralelo

El 2026-10-28 el usuario autoriza adelantar T3 antes del cierre de T2. Se permiten contratos y UI con muestras públicas; no se trasladan reglas al cliente ni se declara integración completa sin motor, seguridad y pruebas.

El estado de ejecución se recoge en [ESTADO](ESTADO.md) y [BACKLOG](BACKLOG.md). La continuación de T3-04 incluye servicios y pruebas independientes, sin declarar completada la integración ni instalar modelos. La estética MS-DOS y pixel art del GDD sigue siendo obligatoria; la paleta y resolución del prototipo son provisionales.

## Decisiones de producto aún abiertas

Estas decisiones bloquean su tarea, no la base ni el motor: marca y atribución final (fase 6); parámetros numéricos de carrera y variedad (fase 5); arte/sonido y licencias definitivas (fase 5); catálogo ampliado y tiempos realistas (fase 5); modelos de referencia (antes de evaluar fase 3); protocolo, condiciones y cuotas FreeLLMAPI y políticas de retención (fase 7).

El caso fijo usa tiempos de prueba declarados, no horarios de vuelo reales. Sus parámetros no se convierten automáticamente en equilibrio universal del generador.

Fuera de v1: comunidad pública de casos, multijugador, pagos, aplicaciones nativas, ejecución offline integral y federación. No se elimina ningún requisito del GDD sin registrar cambio aprobado.
