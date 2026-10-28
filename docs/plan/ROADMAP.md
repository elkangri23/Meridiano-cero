# Roadmap por hitos verificables

Sin fechas comprometidas. Estimar una fase cuando su spec esté cerrada y se conozca el entorno. Revisión humana al finalizar cada hito. Estados actuales: fase 0 entregada documentalmente; fase 1 en curso; fases 2–7 pendientes.

| Fase | Resultado demostrable | Dependencias | Puerta de salida |
|---|---|---|---|
| 0 | Requisitos, specs iniciales, ADR, amenazas y caso fijo | GDD/TAD y plan | Enlaces e IDs válidos, todas las secciones GDD trazadas, caso con dos rutas calculadas |
| 1 | Base web/API y PostgreSQL reproducible | 0; SPEC-004 y SPEC-009 cerradas para base | Arranque limpio, health/readiness, migración y reinicio con datos; CI |
| 2 | Motor ejecutable sin red, IA ni UI | 1; SPEC-001/002/003 | Rutas alternativas, pérdida, reloj, lotes y eventos comprobados |
| 3 | Un caso completo en navegador con IA local | 2; SPEC-004/005/006 cerradas para hito | Conversar, investigar, viajar, analizar, detener, cerrar y reanudar; teclado |
| 4 | Generación persistente e intercambio | 3; SPEC-007 | Generar → validar → simular → guardar; rechazo/cancelación/importación seguras |
| 5 | Funciones completas del GDD y acabado | 4; SPEC-006/008 ampliadas | Matriz funcional v1 cubierta, accesibilidad y evaluación de modelos |
| 6 | Distribución independiente | 5; SPEC-009 final | Instalación ajena, proveedor propio, actualización y restauración |
| 7 | Instancia pública gratuita | 6; SPEC-010 final | Registro, IA servidor, consumo acotado, recuperación, controles OWASP y operación |

## Entrega incremental

Fase 1 no crea worker vacío ni paquetes sin consumidor. Fase 2 utiliza un fixture local; fase 3 añade IA solo a interpretación y narración. Fase 4 utiliza el mismo contrato de expediente para la generación. La seguridad y accesibilidad se entregan por tarea, no al final.

Las tareas preparadas de fases 1–3 están en [BACKLOG](BACKLOG.md). Las fases posteriores ya tienen desglose T4–T7; sus specs detalladas son propuestas y deben cerrarse con pruebas de entorno y decisiones indicadas antes de implementar. Todas siguen pendientes.

## Demostración de cada hito

Entregar alcance realizado, requisitos/pruebas, comandos y resultados, limitaciones, riesgos abiertos y siguiente conjunto de tareas. No marcar un hito aceptado por superar únicamente CI. Mantener el registro en quality con la [plantilla de evidencia](../templates/evidencia.md).

## Bloqueos de lanzamiento

Ningún hallazgo crítico/alto aplicable abierto; restauración probada; autoría/licencias y privacidad resueltas; endpoint público de IA verificado; costes y corte global ensayados. No publicar repositorio ni desplegar VPS como efecto lateral de cerrar documentación.
