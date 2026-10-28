# Decisiones y mediciones pendientes

No son requisitos olvidados ni autorizaciones pendientes para documentar. Son decisiones que los Word dejan abiertas o valores que necesitan pruebas reales. La tarea indicada debe cerrarlos antes de implementar la capacidad dependiente. Los valores de specs marcados propuestos son punto de partida, no afirmaciones de aprobación histórica.

**Actualizado:** 2026-10-28. El inventario previo de Windows/Docker es contexto histórico; disponibilidad instalada no demuestra migración/arranque probado. El estado actual se consulta en [ESTADO](ESTADO.md). La evaluación real espera URL y modelo, que el usuario confirma no tener todavía. No se modifica WSL ni se instala un proveedor al actualizar esta lista.

| Tema | Base documentada | Cierre requerido | Responsable / gate |
|---|---|---|---|
| Versiones de herramientas | Versiones exactas y pruebas sintéticas en SPEC-009 | Revisar entrega T1-01; fijar manifiestos/lockfile y comprobar workspace real en T1-02 | T1-01; T1-02 |
| Auth de base | Contrato de sesión/CSRF y Argon2 0.45.1 calibrado en Windows/Node 24; SPEC-004 | Revisar base T1-01; calibrar en el entorno real (Windows 10 / Cezar); implementar y probar login/límites en su fase | T1-01; T3-01; E7-01 |
| ✅ Argon2 en Windows 10 | Entorno de desarrollo: Windows 10 con Cezar (2026-10-28). El bloqueo de Ubuntu 20.04 WSL (glibc 2.31, `ERR_DLOPEN_FAILED`) no aplica. Calibrar Argon2 0.45.1 en Windows/Node 24 según SPEC-004 | Verificar compilación y hash/verify en el entorno real; no asumir que la compatibilidad en Ubuntu era requisito | T1-01; T3-01 |
| ✅ Docker Compose | Disponible: Docker 29.9.2, Docker Compose v5.6.1 (2026-10-28). El bloqueo de Ubuntu 20.04 queda sin aplicar | Usar Compose para PostgreSQL en T1-03 según SPEC-009; verificar daemon y volúmenes antes de migraciones | T1-03; ops |
| UX inicial | Prototipo MS-DOS/pixel art disponible; revisión visual parcial de escritorio | Conectar partidas; revisar foco/teclado/móvil, ventanas y persistencia de preferencias | T3-01 |
| Modelo local | Adaptador y corpus v2 con mock; sin URL/modelo disponibles | Seleccionar modelo instalado, comprobar contexto efectivo y evaluar el caso fijo | T3-01 |
| 🟡 Modelo Ollama en RTX 5080 | Contexto previo de hardware doméstico, no evaluación disponible en este worktree | Obtener URL/modelo concretos antes de elegir parámetros y medir latencia/VRAM; no asumir disponibilidad por el hardware | T3-01; usuario |
| 🟡 FreeLLMAPI en desarrollo | Usado en casa/VPS/trabajo como proveedor alternativo | URL, modelo, quién lo opera, autenticación. No usar credenciales del equipo como configuración de producto | T1-01; T3-01 |
| Corpus y prosa factual | Selección de IDs, fallback y corpus sintético de diecisiete escenarios implementados | Evaluar fidelidad con modelo real y conectar proyección/autorización de partidas | T3-01; T3-04 |
| 🟡 Límites de texto libre IA | Sin prosa probatoria libre; actos autorizados y hechos del servidor; memoria filtrada | Validar el contexto real y ensayar inyección/ambigüedad en el caso fijo; sin sugerir pistas | T3-04 |
| 🟡 Criterios de calidad IA | ACC-038: modelo insuficiente puede jugar fixture validado | Error rate, latencia y cobertura de hechos autorizados aceptables antes de T3-05; quién mide y cómo | T3-05; T3-01 |
| Caso fijo | Fixture y simulaciones de motor implementados; T2 registrado como completado | Cerrar calidad del motor y demostrar ambas rutas en navegador con IA real | T2-02; T2-06 |
| 🟡 Parámetros caso fijo | SPEC-003: costes 455/545 min (ruta A), 485/575 min (ruta B); ~30% detención coordinada / ~70% interactiva; retrasos ~5% de 15–45 min | ¿Especificación fija o hipótesis? ¿Se validan con simulación de motor en T2-06 o se aceptan como fijos? Los tiempos del caso fijo no se convierten automáticamente en equilibrio universal | T2-06; T5-04 |
| Generación | Tres intentos y límites propuestos | Presupuestos, tamaños, leases y capacidad reales | E4-01; T4-04 |
| Catálogo mundial | Ciudades admitidas, fuentes verificables | Cobertura inicial, fuentes/licencias y viajes realistas | T5-02 |
| Equilibrio | Resultados, herramientas libres y carrera recuperable | Fórmulas/rangos/etiquetas y pruebas de duración/dificultad | T5-04 |
| Dirección artística | MS-DOS/pixel art obligatorio; escena provisional 320 × 160, colores planos y fuente alternativa | Arte final, retratos, música y licencias; revisión accesible; paleta/resolución aún provisionales | T5-05 |
| Distribución | Compose independiente | Imágenes, bootstrap, actualización y comandos probados | T6-01; T6-02 |
| Recuperación | Backup cifrado y restore | Retención, RPO/RTO medidos y responsables | T6-03 |
| Marca/atribución | A.C.M.E. provisional, AGPL objetivo | Nombre definitivo, autoría y avisos/publicación | T6-04; usuario |
| FreeLLMAPI | IA pública inicial a cargo del administrador | Protocolo, condiciones, cuotas, coste/modelo comprobados | T7-01 |
| VPS público | Registro, TLS y límites | Recursos/dominio, cuotas numéricas y destinos de alerta | T7-01; T7-03 |
| Privacidad | Minimización y exportación/borrado | Retención por dato, proveedor y políticas revisadas | T7-02 |
| 🟡 Retención sesiones y logs | Sesión local de desarrollo: 8 horas absolutas (SPEC-004); duración pública y retención de logs por concretar | ¿Cuánto tiempo se conservan? ¿Qué datos? ¿Borrado automático? ¿Cumplimiento con políticas de privacidad de fase 7? | T7-02; T1-01 |
| Cobertura ASVS final | Selección inicial versionada | Revisión de catálogo completo y exclusiones justificadas | T7-04 |

Si una medición obliga a cambiar requisito, registrar propuesta en BASELINE y revisarla con el usuario; si solo calibra un parámetro operativo dentro de la spec, registrar evidencia y actualizar la spec. No convertir una limitación del modelo en recorte silencioso de mecánicas.

La implementación sintética de T3-04 no cierra las decisiones de modelo ni sustituye PostgreSQL, ownership y transacciones pendientes de T3-02. Los siete errores globales de lint y siete de imports siguen impidiendo aceptar la calidad de la fase.

## Aclaraciones cerradas y precisión de guardados

Confirmadas el 2026-10-28: cuentas registradas con casos individuales y un detective jugador por partida; ausencia de multijugador tanto local como en VPS; autoguardado y guardado manual; ventanas movibles/minimizables desde el primer caso; aclaración previa obligatoria de órdenes ambiguas. DEC-013/014/015/016 en BASELINE recogen estas respuestas.

No se vuelve a plantear el número de perfiles por instalación como sustituto de esta modalidad. DEC-017 confirma la carga de un guardado manual para retroceder y probar otras decisiones. DEC-020 confirma el primer resultado para carrera y reputación, sin sustitución posterior ni recompensas duplicadas. DEC-021 fija diez manuales por partida además del autoguardado actual, sin borrado automático de manuales; el contrato técnico se concreta en GUARDADOS. El contrato técnico se cerrará sobre esas decisiones, sin inventarlas durante la implementación.

## Selección de proveedor ya resuelta

DEC-018/019 cierran el comportamiento por entorno: Ollama en casa, FreeLLMAPI en trabajo/VPS, proveedor/endpoint configurable en instalaciones propias y claves personales opcionales en VPS además del predeterminado del administrador. No se vuelve a preguntar si es obligatorio Ollama en el trabajo.

Quedan tareas técnicas: transporte real FreeLLMAPI, capacidades de cada adaptador, configuración, protección de endpoints/credenciales y evaluación con algún proveedor disponible. No se inventan URL, protocolo, cuotas ni modelos. [Contrato de implementación](../specs/IA-proveedores.md).

## Contratos T3 concretados

Los contratos de [API](../specs/API-juego.md), [guardados](../specs/GUARDADOS.md) y [conversaciones](../specs/CONVERSACIONES.md) ya definen campos, estados, validaciones, errores y recuperación. La cantidad de manuales está confirmada en DEC-021. No se requieren más preguntas de producto para implementar esas fronteras.

Siguen pendientes la medición del proveedor real elegido, las reglas/datos concretos de cooperación y cobertura del fixture (sin improvisar umbrales universales), la compatibilidad de transportes externos y el equilibrio numérico de carrera. La generación y la operación pública mantienen sus propios parámetros por calibrar. Documentar los contratos no resuelve esos ensayos ni cierra T3-01 completo.
