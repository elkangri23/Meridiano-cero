# Evidencia de ampliación documental de bordes

Fecha: 2026-10-28. Base inspeccionada: e73ab7040ff7e3643ca3af7885b912a7211e7bf9. Trabajo aislado en worktree bordes-resiliencia-observabilidad. Sin commits, integración, publicación o despliegue.

## Entrega

- [90 escenarios de ejecución y nueve hallazgos](BORDES-EJECUCION.md), con disparador, oráculo, prioridad, tipo de prueba y tarea responsable.
- [Resiliencia](../specs/RESILIENCIA.md): incertidumbre de commit, deduplicación, recuperación, capacidades degradadas, deadlines, admisión, fencing, parada, migración y desastre.
- [Observabilidad y datos](../specs/OBSERVABILIDAD-Y-DATOS.md): eventos, métricas, correlación, objetivos propuestos, alertas, residencia, retención, supresiones y rotación.
- Ocho tareas pendientes, detalladas en TAREAS y registradas en BACKLOG, con dependencias de cierre incorporadas a las fases afectadas. Índices, specs aplicables y decisiones pendientes enlazados.

Se revisaron BASELINE/ROADMAP/BACKLOG/ESTADO, specs y anexos de motor, expediente, API, guardados, conversaciones, proveedores, interfaz, carrera, generación, operación y seguridad; el verificador documental; createApp, server, readiness y ambos esquemas SQL/Drizzle. No se examinó exhaustivamente cada línea del repositorio. Los hallazgos distinguen observación estática de precisión de contrato.

## Comprobaciones realizadas

`python3 scripts/verify_docs.py` se intentó, pero el alias WindowsApps de python3 no pudo ejecutarse. Se utilizó el mismo script sin modificaciones con `python scripts/verify_docs.py`, mediante Python instalado en C:/Python310/python.exe. Resultado correcto: enlaces/IDs, grafo sin ciclos, trazabilidad GDD y hashes de originales intactos. La revisión final incluye este archivo.

Comprobación adicional ejecutada con Python: BOR-001 a BOR-090 aparecen exactamente una vez como filas, en orden consecutivo, y todas las filas tienen una tarea registrada en BACKLOG. Correcta. `git diff --check`: correcto. Los ocho IDs nuevos también están descritos en TAREAS; lo comprueba verify_docs.py.

El sandbox inicial no permitió escritura shell en el worktree gestionado ni inspección Git completa; la ejecución con permisos ampliados fue autorizada por el mecanismo de revisión y completó las verificaciones. No se modificaron permisos del sistema ni WSL.

## Límites de la evidencia

Esta entrega verifica integridad documental y coherencia de dependencias. No ejecuta pruebas unitarias nuevas, integración PostgreSQL, E2E, revisión manual de accesibilidad, carga, proveedor real, alertas externas o restauración. Las 90 filas son escenarios pendientes, no 90 pruebas superadas. Los valores de SLO, RPO/RTO, breaker y retención son propuestas identificadas que sus tareas deben medir/cerrar. No se certifica residencia, política externa o cumplimiento legal de proveedor alguno.

«Residencia» se ha interpretado también como posible «resiliencia» y se han desarrollado ambas materias. No se cambia una decisión de producto confirmada ni se declara completada una tarea de implementación por este trabajo documental.
