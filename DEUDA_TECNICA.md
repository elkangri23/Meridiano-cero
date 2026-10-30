# Deuda Técnica de Meridiano-cero

Este documento consolida la deuda técnica identificada en el proyecto, pendiente de resolución para alcanzar los hitos de las fases 4–7.

## Arquitectura y Estructura
- **[T1-04] CI/CD:** El flujo de CI actual es un prototipo local (equivalente ejecutable manualmente); no existe una integración continua plena en GitHub ni registros F1 validados de forma automatizada y persistente.
- **[T3-02/T3-03] Integración Monorepo:** `packages/web/RetroScreen` es un prototipo enlazado pero no consumido como aplicación final. Falta la aplicación de rutas para partidas (`createApp`) y la integración completa entre el engine y la UI.
- **[T3-05/T4-01] Generador de Casos:** Ausencia de un pipeline de generación por etapas (checkpointing) definido en la estructura del código. Todo lo relacionado con la generación está actualmente en fase de diseño documental (SPEC-007).
- **[T3-04] Adaptador IA:** Aunque existe `packages/ai-adapters`, es un mock con interpretación limitada. La lógica de memoria NPC y el fallback factual dependen de la integración plena del proveedor genérico.

## Calidad y Pruebas
- **[Lint/Imports]** Persisten siete fallos de lint y siete de imports en el workspace que bloquean la puerta de calidad global, a pesar de que las pruebas unitarias pasan.
- **[E2E]** Ausencia total de pruebas E2E (End-to-End) para el flujo completo: guardar, reanudar, interacción de teclado y revisión humana.
- **[Documentación]** La documentación en `docs/specs` y `docs/plan` marca hitos técnicos que aún requieren la ejecución de los comandos de validación asociados (`scripts/verify_docs.py`) y evidencia de ejecución real.

## Seguridad y Privacidad (Revisión OWASP)
- **[T7-02/T7-03] Protección de Credenciales:** La gestión de claves personales (FreeLLMAPI) y la cuotificación del servicio está especificada (DEC-018/019) pero no implementada.
- **[T7-04] Revisión OWASP:** Pendiente la revisión manual y dinámica de seguridad OWASP para la puerta de lanzamiento público.

## Estado de Dependencias de Fase
- **[Fase 3 bloqueante]** T3-02 (API/Guardados) y T3-03 (UI) son dependencias críticas no cerradas que impiden el progreso limpio de la T3-05 y, por tanto, la transición segura a la fase 4.
- **[Fase 4]** La T4-01 (pipeline por etapas) no está iniciada, lo que convierte a la T4-02 (validadores) en una tarea de desarrollo de lógica "en el aire" hasta que se defina el esquema de entrada/salida.

---
**Nota:** Este registro se actualizará conforme se resuelvan las tareas del Backlog. La prioridad es resolver los bloqueos técnicos de la Fase 3 antes de proceder a la automatización de la Fase 4.
