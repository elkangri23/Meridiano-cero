# Decisiones y mediciones pendientes

No son requisitos olvidados ni autorizaciones pendientes para documentar. Son decisiones que los Word dejan abiertas o valores que necesitan pruebas reales. La tarea indicada debe cerrarlos antes de implementar la capacidad dependiente. Los valores de specs marcados propuestos son punto de partida, no afirmaciones de aprobación histórica.

| Tema | Base documentada | Cierre requerido | Responsable / gate |
|---|---|---|---|
| Versiones de herramientas | Node LTS, pnpm, PostgreSQL y stack elegido | Versiones mantenidas exactas, compatibilidad y lockfile | T1-01 |
| Auth de base | Sesiones opacas y Argon2id mantenido | Librerías, calibración, cookie/CSRF y límites de login | T1-01; T3-01 |
| UX inicial | Pantalla única retro y panel móvil | Wireframes, orden de foco y confirmaciones probados | T3-01 |
| Modelo local | Ollama primero, roles separables | Modelo/versión/contexto, hardware, latencia y corpus real | T3-01 |
| Corpus y prosa factual | Motor decide y hechos autorizados | Fronteras de texto libre y criterio de fallback ensayados | T3-01; T3-04 |
| Caso fijo | Trama/costes/dos rutas en SPEC-003 | Revisión de contenido y simulaciones de motor | T2-02; T2-06 |
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
| Cobertura ASVS final | Selección inicial versionada | Revisión de catálogo completo y exclusiones justificadas | T7-04 |

Si una medición obliga a cambiar requisito, registrar propuesta en BASELINE y revisarla con el usuario; si solo calibra un parámetro operativo dentro de la spec, registrar evidencia y actualizar la spec. No convertir una limitación del modelo en recorte silencioso de mecánicas.
