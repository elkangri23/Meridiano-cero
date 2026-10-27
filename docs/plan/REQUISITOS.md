# Matriz de requisitos

Estado de todos los requisitos: ESPECIFICADO / NO VERIFICADO EN PRODUCTO. Fuente GDD = [texto completo](../meridi/ACME_GDD_v0.1_revision.txt); TAD = [texto completo](../meridi/ACME_TAD_v1.0_revision.txt). Cada fila conserva sección de origen. Agrupa cláusulas relacionadas sin eliminar obligaciones. SPEC indica ID del [registro](../specs/README.md), tarea enlaza al [backlog](BACKLOG.md) y ACC al [catálogo](../quality/ACEPTACION.md).

Las tareas E son épicas pendientes de desglose; su existencia no las convierte en preparadas. Los primeros hitos prueban subconjuntos; ninguna fila queda aceptada por existir este documento.

| ID | Fuente | Requisito | Spec | Tarea responsable | Prueba |
|---|---|---|---|---|---|
| REQ-G01-01 | GDD §1 | Investigación internacional educativa, rejugable y en lenguaje natural | SPEC-001 | T2-01 | ACC-002 |
| REQ-G01-02 | GDD §1 | Libertad de equivocarse y perder; sin indicadores de rumbo ni pistas automáticas | SPEC-001 | T2-01 | ACC-002 |
| REQ-G01-03 | GDD §1 | Narración breve y escenarios ambientales; accesibilidad desde inicio | SPEC-001 | T2-01 | ACC-002 |
| REQ-G02-01 | GDD §2 | Pantalla única con escena, herramientas, consola y entrada | SPEC-006 | T3-03 | ACC-019 |
| REQ-G02-02 | GDD §2 | Ventanas retro movibles/minimizables adaptadas a móvil | SPEC-006 | T3-03 | ACC-019 |
| REQ-G02-03 | GDD §2 | Pixel art MS-DOS, retratos/animaciones y fuente legible; sin pixel hunting | SPEC-006 | T3-03 | ACC-019 |
| REQ-G02-04 | GDD §2 | Web responsiva; PWA no obligatoria según DEC-001 | SPEC-006 | T3-03 | ACC-019 |
| REQ-G03-01 | GDD §3 | Delitos: robo, desaparición, fraude, espionaje, sabotaje, misterio histórico actual y aleatorio | SPEC-007 | E4-01 | ACC-029 |
| REQ-G03-02 | GDD §3 | Dificultad fácil/normal/difícil independiente de exploración guiada/libre | SPEC-007 | E4-01 | ACC-029 |
| REQ-G03-03 | GDD §3 | Duración corta 10–15, media 20–30, larga 40–60 min reales; reloj interno distinto | SPEC-007 | E4-01 | ACC-029 |
| REQ-G03-04 | GDD §3 | Región elegible/aleatoria, Familiar/General y SORPRÉNDEME | SPEC-007 | E4-01 | ACC-029 |
| REQ-G03-05 | GDD §3 | Casos actuales; introducción breve omisible y recuperable; inicio en escenario del delito | SPEC-007 | E4-01 | ACC-029 |
| REQ-G04-01 | GDD §4 | Expediente previo completo: solución, cronología, motivos, conocimientos, lugares, evidencias y condiciones | SPEC-007 | E4-01 | ACC-034 |
| REQ-G04-02 | GDD §4 | No crear escenarios investigables ni pruebas durante partida | SPEC-007 | E4-01 | ACC-034 |
| REQ-G04-03 | GDD §4 | Etapas de planificación, geografía, personajes, pistas, coherencia y narrativa | SPEC-007 | E4-01 | ACC-034 |
| REQ-G04-04 | GDD §4 | Validar geografía, solvencia, rutas alternativas, tiempos, contenido y bloqueos | SPEC-007 | E4-01 | ACC-034 |
| REQ-G04-05 | GDD §4 | Simular éxito/error; corregir o rechazar antes de jugar | SPEC-007 | E4-01 | ACC-034 |
| REQ-G04-06 | GDD §4 | Motor gobierna hechos y tiempo; modelo insuficiente puede jugar casos validados | SPEC-007 | E4-01 | ACC-034 |
| REQ-G05-01 | GDD §5 | Mapa mundial y buscador de ciudades reales admitidas; viajar erróneamente consume tiempo | SPEC-006 | E5-01 | ACC-003 |
| REQ-G05-02 | GDD §5 | Guiado muestra ciudades investigables; libre las descubre sin bloquear buscador | SPEC-006 | E5-01 | ACC-003 |
| REQ-G05-03 | GDD §5 | Separar escenarios finitos de destinos culturales sin pruebas nuevas | SPEC-006 | E5-01 | ACC-003 |
| REQ-G05-04 | GDD §5 | Atlas gratis; visitas con coste; catálogo verificable y mensaje honesto de ciudad no disponible | SPEC-006 | E5-01 | ACC-003 |
| REQ-G06-01 | GDD §6 | Órdenes generales/específicas y acciones plausibles dentro de reglas del expediente | SPEC-001 | T2-03 | ACC-004 |
| REQ-G06-02 | GDD §6 | Inspección general no revela lo oculto; específica evalúa elementos | SPEC-001 | T2-03 | ACC-004 |
| REQ-G06-03 | GDD §6 | Lotes secuenciales suman coste; hallazgos no interrumpen | SPEC-001 | T2-03 | ACC-004 |
| REQ-G06-04 | GDD §6 | Imposibilidad pausa; elegir cancelar/continuar independientes sin cobrar omitidas | SPEC-001 | T2-03 | ACC-004 |
| REQ-G06-05 | GDD §6 | Dossier/maletín sin capacidad artificial ni combinaciones absurdas | SPEC-001 | T2-03 | ACC-004 |
| REQ-G06-06 | GDD §6 | Recogida explícita o implicada; distinguir objetos, observaciones, testimonios, análisis y registros | SPEC-001 | T2-03 | ACC-004 |
| REQ-G06-07 | GDD §6 | Guardar procedencia y corroboración de relaciones sin revelar solución | SPEC-001 | T2-03 | ACC-004 |
| REQ-G07-01 | GDD §7 | NPC con personalidad, conocimiento limitado, memoria y trato recibido | SPEC-005 | T3-04 | ACC-005 |
| REQ-G07-02 | GDD §7 | Referencias contextuales, conversaciones retomables y coberturas improvisadas | SPEC-005 | T3-04 | ACC-005 |
| REQ-G07-03 | GDD §7 | Sin hechos inventados, mentiras deliberadas o falsas acusaciones; admite silencio/error honesto/ambigüedad | SPEC-005 | T3-04 | ACC-005 |
| REQ-G07-04 | GDD §7 | Nerviosismo no implica culpa; presión reduce cooperación con rutas alternativas | SPEC-005 | T3-04 | ACC-005 |
| REQ-G07-05 | GDD §7 | Sin movimiento autónomo mientras se piensa; conversaciones breves | SPEC-005 | T3-04 | ACC-005 |
| REQ-G08-01 | GDD §8 | Margaret presenta/evalúa; Richter laboratorio; Elena inteligencia; David coordinación; Clara documentación | SPEC-005 | E5-01 | ACC-005 |
| REQ-G08-02 | GDD §8 | Nombres provisionales, personalidades diferenciadas y memoria de carrera | SPEC-005 | E5-01 | ACC-005 |
| REQ-G08-03 | GDD §8 | Apoyo factual y gestiones sin señalar culpable ni siguiente pista | SPEC-005 | E5-01 | ACC-005 |
| REQ-G09-01 | GDD §9 | Reloj/plazo visibles; avanzan por viajes, búsquedas, análisis, verificaciones y esperas | SPEC-001 | T2-04 | ACC-007 |
| REQ-G09-02 | GDD §9 | Pensar, escribir, conversar, leer, atlas y expediente sin coste | SPEC-001 | T2-04 | ACC-007 |
| REQ-G09-03 | GDD §9 | Preview de duración y hora prevista antes de confirmar acciones relevantes | SPEC-001 | T2-04 | ACC-007 |
| REQ-G09-04 | GDD §9 | Tareas paralelas progresan al avanzar tiempo; plazo estricto incluso a mitad de secuencia | SPEC-001 | T2-04 | ACC-007 |
| REQ-G09-05 | GDD §9 | Viajes directos con origen/destino/duración/confirmación; retrasos ~5% de 15–45 min internos contemplados | SPEC-001 | T2-04 | ACC-007 |
| REQ-G10-01 | GDD §10 | Central con llamadas, WhatsApp, SMS, correo y fax según contactos | SPEC-001 | T2-04 | ACC-007 |
| REQ-G10-02 | GDD §10 | Mensajes/documentos/solicitudes; resultados al minuto programado incluso viajando | SPEC-001 | T2-04 | ACC-007 |
| REQ-G10-03 | GDD §10 | Conversar/leer gratis; búsquedas/trámites con tiempo; canales y respuestas definidos | SPEC-001 | T2-04 | ACC-007 |
| REQ-G11-01 | GDD §11 | Laboratorio para huellas, documentos, fotos, audio, muestras y materiales aplicables | SPEC-001 | T2-05 | ACC-010 |
| REQ-G11-02 | GDD §11 | Análisis predeterminados con estimación, paralelos y explicación sin revelar culpabilidad | SPEC-001 | T2-05 | ACC-010 |
| REQ-G11-03 | GDD §11 | Inteligencia natural sobre identidades, viajes, empresas, vehículos y propiedades definidas | SPEC-001 | T2-05 | ACC-010 |
| REQ-G11-04 | GDD §11 | Ausencia de registro no demuestra inocencia | SPEC-001 | T2-05 | ACC-010 |
| REQ-G11-05 | GDD §11 | Orden ficticia A.C.M.E.: sospechoso y pruebas; suficiencia no culpa; puede concederse contra inocente | SPEC-001 | T2-05 | ACC-010 |
| REQ-G11-06 | GDD §11 | Pruebas irregulares pueden ser inadmisibles; denegación no cierra | SPEC-001 | T2-05 | ACC-010 |
| REQ-G12-01 | GDD §12 | Tipo de detención fijado al generar: ~30% coordinada, ~70% interactiva sin combate/persecución violenta | SPEC-001 | T2-05 | ACC-012 |
| REQ-G12-02 | GDD §12 | Orden y ubicación conocidas fijan al sospechoso sin fugas sorpresivas | SPEC-001 | T2-05 | ACC-012 |
| REQ-G12-03 | GDD §12 | Detener no cierra; finalizar manual con confirmación o por plazo | SPEC-001 | T2-05 | ACC-012 |
| REQ-G12-04 | GDD §12 | Evaluación automática sin informe adicional del jugador | SPEC-001 | T2-05 | ACC-012 |
| REQ-G12-05 | GDD §12 | Informe con verdad, cronología, pruebas omitidas/halladas, detenciones, objetivos, puntuación y carrera | SPEC-001 | T2-05 | ACC-012 |
| REQ-G12-06 | GDD §12 | Resultados completo/parcial/no resuelto/incorrecto por objetivos | SPEC-001 | T2-05 | ACC-012 |
| REQ-G13-01 | GDD §13 | Perfil nombre/alias/avatar; rangos, puntos, medallas, casos, países y monumentos | SPEC-008 | E5-01 | ACC-030 |
| REQ-G13-02 | GDD §13 | Ascensos honoríficos y todas las herramientas desde inicio | SPEC-008 | E5-01 | ACC-030 |
| REQ-G13-03 | GDD §13 | Prestigio/integridad/confianza con etiquetas cualitativas; advertencias/suspensiones y recuperación | SPEC-008 | E5-01 | ACC-030 |
| REQ-G13-04 | GDD §13 | Autoguardado completo, varios casos independientes sin avance inactivo y resumen al retomar | SPEC-008 | E5-01 | ACC-030 |
| REQ-G13-05 | GDD §13 | Archivo, repetición exacta o variante validada; sin explotar puntos por repetición | SPEC-008 | E5-01 | ACC-030 |
| REQ-G14-01 | GDD §14 | Acciones irregulares con consecuencias proporcionales basadas en conocimiento plausible | SPEC-008 | E5-01 | ACC-036 |
| REQ-G14-02 | GDD §14 | Admisibilidad/cooperación/reputación/retirada; sin salud, combate, lesiones gestionables ni muerte permanente | SPEC-008 | E5-01 | ACC-036 |
| REQ-G14-03 | GDD §14 | Familiar predeterminado excluye asesinatos y contenido perturbador/sexual | SPEC-008 | E5-01 | ACC-036 |
| REQ-G14-04 | GDD §14 | General permite homicidios sin gráfico; ambos excluyen sexual, gore y combate | SPEC-008 | E5-01 | ACC-036 |
| REQ-G14-05 | GDD §14 | Filtrar restricciones al generar y en narración viva | SPEC-008 | E5-01 | ACC-036 |
| REQ-G15-01 | GDD §15 | MIDI/sintetizadores y ambiente; volúmenes separados de música/efectos/narración/general | SPEC-006 | E5-01 | ACC-031 |
| REQ-G15-02 | GDD §15 | TTS opcional del sistema/navegador: voz/velocidad/manual/automático/repetir y lectura de documentos/diálogos | SPEC-006 | E5-01 | ACC-031 |
| REQ-G15-03 | GDD §15 | Todo sonido relevante tiene equivalente textual | SPEC-006 | E5-01 | ACC-031 |
| REQ-G15-04 | GDD §15 | Interfaz traducible y lengua independiente de nacionalidad de NPC | SPEC-006 | E5-01 | ACC-031 |
| REQ-G15-05 | GDD §15 | Daltonismo, alto contraste, color, letra/escala/fuente, teclado/foco, lectores/alt, movimiento; objetivo WCAG 2.2 AA | SPEC-006 | E5-01 | ACC-031 |
| REQ-G16-01 | GDD §16 | Roles configurables de generación, validación y dirección; proveedores intercambiables según capacidades | SPEC-005 | T3-01 | ACC-038 |
| REQ-G16-02 | GDD §16 | Ollama, LM Studio, OpenAI, Anthropic, Gemini y compatibles; FreeLLMAPI público posterior | SPEC-005 | T3-01 | ACC-038 |
| REQ-G16-03 | GDD §16 | Capacidades, errores, límites, costes y versiones de estado fiables | SPEC-005 | T3-01 | ACC-038 |
| REQ-G16-04 | GDD §16 | Backend protege claves y conexiones locales/externas según DEC-002 | SPEC-005 | T3-01 | ACC-038 |
| REQ-G17-01 | GDD §17 | Importar/exportar expedientes autocontenidos validados entre proveedores desde v1 | SPEC-007 | E4-01 | ACC-023 |
| REQ-G17-02 | GDD §17 | Formato versionado verificable; exportación advierte solución y no promete ofuscación segura | SPEC-007 | E4-01 | ACC-023 |
| REQ-G17-03 | GDD §17 | Comunidad y épocas históricas jugables quedan fuera del primer alcance | SPEC-007 | E4-01 | ACC-023 |
| REQ-G18-01 | GDD §18 | Inicio solo tras generación/validación/guardado y hechos invariantes | SPEC-003 | T2-06 | ACC-008 |
| REQ-G18-02 | GDD §18 | Resolver o perder sin avisos de rumbo; guiado/libre y rutas alternativas | SPEC-003 | T2-06 | ACC-008 |
| REQ-G18-03 | GDD §18 | Comunicaciones/lab/inteligencia/órdenes/detenciones respetan tiempo y permisos | SPEC-003 | T2-06 | ACC-008 |
| REQ-G18-04 | GDD §18 | Cierre/informe/reanudación; accesibilidad/audio sin pistas inaccesibles | SPEC-003 | T2-06 | ACC-008 |
| REQ-G19-01 | GDD §19 | Nombre/arte, formato/versiones, catálogo/tiempos y equilibrio requieren decisiones registradas | SPEC-009 | E6-01 | ACC-035 |
| REQ-G19-02 | GDD §19 | Admisibilidad/intervención, seguridad de contenido, persistencia/proveedores y hitos se concretan en specs | SPEC-009 | E6-01 | ACC-035 |
| REQ-T01 | TAD §1–4 | Stack TS, React/Vite, Fastify, Drizzle/PostgreSQL; monolito modular, no microservicios | SPEC-012 | T1-02 | ACC-040 |
| REQ-T02 | TAD §5–6 | Definición inmutable separada de partida y proyección; versión/hash y servidor autoritativo | SPEC-002 | T2-01 | ACC-015 |
| REQ-T03 | TAD §6 | Control transaccional, versión e idempotencia de acciones | SPEC-004 | T3-02 | ACC-013 |
| REQ-T04 | TAD §8–9 | Worker/cola persistente, presupuestos e intentos acotados, capacidades y roles IA | SPEC-007 | E4-01 | ACC-034 |
| REQ-T05 | TAD §10 | Secretos, SSRF, sesiones y límites por usuario/IP/modelo/función/global | SPEC-011 | E7-01 | ACC-022 |
| REQ-T06 | TAD §11 | API versionada y polling inicial; sin WebSockets requeridos | SPEC-004 | T1-01 | ACC-039 |
| REQ-T07 | TAD §13 | Compose y configuración independiente; público aporta IA y autoalojado no depende del creador | SPEC-009 | E6-01 | ACC-032 |
| REQ-T08 | TAD §14 | Backups/restauración, minimización, retención, borrado/exportación y transparencia sobre proveedores | SPEC-010 | E7-01 | ACC-033 |
| REQ-T09 | TAD §15 | AGPL-3.0-only objetivo, avisos/créditos, autor confirmado e inventario licencias original | SPEC-009 | E6-01 | ACC-035 |
| REQ-T10 | TAD §16–19 | Contratos, revisión por hito, ADR, tareas con pruebas y decisiones pendientes visibles | SPEC-012 | T1-02 | ACC-040 |
| REQ-Q01 | Usuario / plan aceptado | KISS: mínima solución y sin capas/paquetes vacíos | SPEC-012 | T1-02 | ACC-040 |
| REQ-Q02 | Usuario / plan aceptado | DRY: reglas y contratos únicos, abstracciones solo con necesidad real | SPEC-012 | T1-02 | ACC-040 |
| REQ-Q03 | Usuario / plan aceptado | Módulos sin ciclos ni dependencias de infraestructura en motor | SPEC-012 | T1-02 | ACC-040 |
| REQ-Q04 | Usuario / plan aceptado | Tipos estrictos, nombres claros, errores deliberados y sin código muerto | SPEC-012 | T1-02 | ACC-040 |
| REQ-Q05 | Usuario / plan aceptado | Cobertura riesgos OWASP Top 10:2025 y controles ASVS 5.0.0 versionados | SPEC-011 | T1-01 | ACC-025 |
| REQ-Q06 | Usuario / plan aceptado | Autorización de datos/campos y proyección sin soluciones ajenas | SPEC-011 | T3-02 | ACC-015 |
| REQ-Q07 | Usuario / plan aceptado | Secretos/configuración segura, mínimo privilegio y cifrado mantenido | SPEC-011 | T1-03 | ACC-024 |
| REQ-Q08 | Usuario / plan aceptado | Validación estructural/contextual, SQL parametrizado y presentación segura | SPEC-011 | T3-02 | ACC-021 |
| REQ-Q09 | Usuario / plan aceptado | Cadena de suministro: lockfile, auditoría y revisión de dependencias/licencias | SPEC-011 | T1-04 | ACC-025 |
| REQ-Q10 | Usuario / plan aceptado | Logs/alertas protegidos y errores cerrados sin exponer datos | SPEC-011 | E7-01 | ACC-028 |
| REQ-Q11 | Usuario / plan aceptado | Cuotas, cancelación, SSRF y presupuestos contra abuso de IA | SPEC-011 | E7-01 | ACC-027 |
| REQ-Q12 | Usuario / plan aceptado | Definición de terminado: evidencia, pruebas y revisión; no afirmar certificación por escáner | SPEC-012 | T1-04 | ACC-040 |

Total: 107 requisitos. Fuente secundaria técnica sujeta a DEC-001–012 de BASELINE. Porcentajes/tiempos del GDD son objetivos de diseño, no métricas ya medidas.
