# Decisiones y mediciones pendientes

No son requisitos olvidados ni autorizaciones pendientes para documentar. Son decisiones que los Word dejan abiertas o valores que necesitan pruebas reales. La tarea indicada debe cerrarlos antes de implementar la capacidad dependiente. Los valores de specs marcados propuestos son punto de partida, no afirmaciones de aprobación histórica.

**Fecha de actualización:** 2026-10-28. Se añadieron 8 ítems (señalados 🔴 para bloqueos de entorno, 🟡 para decisiones de calidad) tras la revisión del estado de T1-01 y la evidencia de entorno. Corregido 2026-10-28: el entorno de desarrollo es Windows 10 con Cezar; los bloqueos de Ubuntu 20.04 (Argon2, Docker Compose) quedan sin aplicar. Total: 31 filas.

| Tema | Base documentada | Cierre requerido | Responsable / gate |
|---|---|---|---|
| Versiones de herramientas | Versiones exactas y pruebas sintéticas en SPEC-009 | Revisar entrega T1-01; fijar manifiestos/lockfile y comprobar workspace real en T1-02 | T1-01; T1-02 |
| Auth de base | Contrato de sesión/CSRF y Argon2 0.45.1 calibrado en Windows/Node 24; SPEC-004 | Revisar base T1-01; calibrar en el entorno real (Windows 10 / Cezar); implementar y probar login/límites en su fase | T1-01; T3-01; E7-01 |
| ✅ Argon2 en Windows 10 | Entorno de desarrollo: Windows 10 con Cezar (2026-10-28). El bloqueo de Ubuntu 20.04 WSL (glibc 2.31, `ERR_DLOPEN_FAILED`) no aplica. Calibrar Argon2 0.45.1 en Windows/Node 24 según SPEC-004 | Verificar compilación y hash/verify en el entorno real; no asumir que la compatibilidad en Ubuntu era requisito | T1-01; T3-01 |
| ✅ Docker Compose | Disponible: Docker 29.9.2, Docker Compose v5.6.1 (2026-10-28). El bloqueo de Ubuntu 20.04 queda sin aplicar | Usar Compose para PostgreSQL en T1-03 según SPEC-009; verificar daemon y volúmenes antes de migraciones | T1-03; ops |
| UX inicial | Pantalla única retro y panel móvil | Wireframes, orden de foco y confirmaciones probados | T3-01 |
| Modelo local | Ollama primero, roles separables | Modelo/versión/contexto, hardware, latencia y corpus real | T3-01 |
| 🟡 Modelo Ollama en RTX 5080 | Casa: RTX 5080 con Ollama. Trabajo: solo FreeLLMAPI, sin GPU dedicada | Elegir modelo, context window y parámetros de generación para RTX 5080; verificar latencia y VRAM | T3-01; usuario |
| 🟡 FreeLLMAPI en desarrollo | Usado en casa/VPS/trabajo como proveedor alternativo | URL, modelo, quién lo opera, autenticación. No usar credenciales del equipo como configuración de producto | T1-01; T3-01 |
| Corpus y prosa factual | Motor decide y hechos autorizados | Fronteras de texto libre y criterio de fallback ensayados | T3-01; T3-04 |
| 🟡 Límites de texto libre IA | REQ-G07-03: sin hechos inventados, mentiras deliberadas o falsas acusaciones | Qué puede sugerir la IA sin violar el requisito; cómo detecta hechos inventados; fallback ante ambigüedad | T3-04 |
| 🟡 Criterios de calidad IA | ACC-038: modelo insuficiente puede jugar fixture validado | Error rate, latencia y cobertura de hechos autorizados aceptables antes de T3-05; quién mide y cómo | T3-05; T3-01 |
| Caso fijo | Trama/costes/dos rutas en SPEC-003 | Revisión de contenido y simulaciones de motor | T2-02; T2-06 |
| 🟡 Parámetros caso fijo | SPEC-003: costes 455/545 min (ruta A), 485/575 min (ruta B); ~30% detención coordinada / ~70% interactiva; retrasos ~5% de 15–45 min | ¿Especificación fija o hipótesis? ¿Se validan con simulación de motor en T2-06 o se aceptan como fijos? Los tiempos del caso fijo no se convierten automáticamente en equilibrio universal | T2-06; T5-04 |
| Generación | Tres intentos y límites propuestos | Presupuestos, tamaños, leases y capacidad reales | E4-01; T4-04 |
| Catálogo mundial | Ciudades admitidas, fuentes verificables | Cobertura inicial, fuentes/licencias y viajes realistas | T5-02 |
| Equilibrio | Resultados, herramientas libres y carrera recuperable | Fórmulas/rangos/etiquetas y pruebas de duración/dificultad | T5-04 |
| Dirección artística | Retro MS-DOS, originales | Resolución, paletas, retratos, música y fuentes con licencia | T5-05 |
| Distribución | Compose independiente | Imágenes, bootstrap, actualización y comandos probados | T6-01; T6-02 |
| Recuperación | Backup cifrado y restore | Retención, RPO/RTO medidos y responsables | T6-03 |
| Marca/atribución | A.C.M.E. provisional, AGPL objetivo | Nombre definitivo, autoría y avisos/publicación | T6-04; usuario |
| FreeLLMAPI | IA pública inicial a cargo del administrador | Protocolo, condiciones, cuotas, coste/modelo comprobados | T7-01 |
| VPS público | Registro, TLS y límites | Recursos/dominio, cuotas numéricas y destinos de alerta | T7-01; T7-03 |
| Privacidad | Minimización y exportación/borrado | Retención por dato, proveedor y políticas revisadas | T7-02 |
| 🟡 Retención sesiones y logs | Sesiones 24h (SPEC-004); logs protegidos (SPEC-011 TH-12) | ¿Cuánto tiempo se conservan? ¿Qué datos? ¿Borrado automático? ¿Cumplimiento con políticas de privacidad de fase 7? | T7-02; T1-01 |
| Cobertura ASVS final | Selección inicial versionada | Revisión de catálogo completo y exclusiones justificadas | T7-04 |

Si una medición obliga a cambiar requisito, registrar propuesta en BASELINE y revisarla con el usuario; si solo calibra un parámetro operativo dentro de la spec, registrar evidencia y actualizar la spec. No convertir una limitación del modelo en recorte silencioso de mecánicas.
