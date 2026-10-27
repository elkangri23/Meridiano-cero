# Catálogo de aceptación

Todos los escenarios de producto están NO EJECUTADOS. Se implementarán en las tareas correspondientes. Para cada ejecución conservar revisión, comando/procedimiento y resultado. Las evaluaciones de IA real no se sustituyen por un mock.

| ID | Escenario y resultado esperado | Nivel |
|---|---|---|
| ACC-001 | Solo expediente validado y persistido permite iniciar; introductorio omisible y recuperable | Integración/E2E |
| ACC-002 | Ninguna acción, diálogo o cambio de modelo altera definición/hash ni inventa evidencia | Motor/IA |
| ACC-003 | Guided muestra ciudades sin pistas de rumbo; libre descubre ciudades y permite destinos erróneos; no finge cobertura | E2E |
| ACC-004 | General no revela evidencia oculta; específica sí; collect explícito; tipos/procedencia conservados | Motor |
| ACC-005 | NPC limitado, contexto y trato persistidos; presión reduce cooperación sin bloquear rutas; equipo factual | IA/manual |
| ACC-006 | Pensar/leer/conversar y tiempo real inactivo no avanzan reloj; todas las herramientas accesibles | Motor/E2E |
| ACC-007 | Eventos paralelos ordenados, incluso en viaje; vencimiento exacto domina empates | Motor |
| ACC-008 | Ruta A sin evidencias exclusivas B completa; costes 455/545 min | Motor/E2E |
| ACC-009 | Ruta B sin evidencias exclusivas A completa; costes 485/575 min | Motor/E2E |
| ACC-010 | Orden puede denegarse sin cierre o concederse para inocente; inadmisibilidad aplicada | Motor |
| ACC-011 | Hallazgo no pausa lote; imposibilidad exige decisión; sin cobro por omitidas; cursor reanudable | Motor/API |
| ACC-012 | Detención no cierra; finish confirma y revela informe; resultados completo/parcial/incorrecto/no resuelto | Motor/E2E |
| ACC-013 | Reintentos misma clave no duplican efectos; otra carga/conflicto de versión se rechaza | Integración |
| ACC-014 | Reinicio conserva inventario, conversación, solicitudes y reloj; partidas simultáneas aisladas | Integración |
| ACC-015 | Usuario B no lee/muta/exporta partida A; PlayerView no filtra centinelas secretos ni IDs ocultos | Seguridad |
| ACC-016 | Prompt malicioso, referencia secreta y salida no estructurada no crean permisos/hechos/acciones | IA/seguridad |
| ACC-017 | Misma semilla/acciones produce mismo resultado; refs rotas y versión futura se rechazan | Motor/esquema |
| ACC-018 | Timeout/JSON IA inválido no cambia estado; fallo narración posterior no duplica ni pierde acción | Integración |
| ACC-019 | Navegación teclado/foco, lector, contraste, escala, color y movimiento; móvil sin panel inaccesible | E2E/manual |
| ACC-020 | Login limitado, sesiones rotadas/revocadas, CSRF y recuperación sin enumeración | Seguridad |
| ACC-021 | Cargas XSS/SQL se tratan como datos; no ejecución dinámica ni SQL concatenado | Seguridad |
| ACC-022 | SSRF: loopback, IPv6, metadata, DNS cambiante y redirects bloqueados en público; Ollama solo política local | Seguridad |
| ACC-023 | Importación oversized/profunda/operadores desconocidos/hash alterado rechazados; exportación solo autorizada con aviso | Integración/seguridad |
| ACC-024 | Build frontend, errores y logs sin secretos; modo local no habilitable accidentalmente en público | Seguridad |
| ACC-025 | CI desde checkout limpio verifica lock, tipos, lint, imports, pruebas y hallazgos de dependencias/secretos | CI |
| ACC-026 | Backup restaurado conserva partidas; migración controlada y rollback operativo documentados | Operación |
| ACC-027 | Cuota rechaza antes de invocar, corte global, concurrencia/cancelación y métricas comprobados | Integración |
| ACC-028 | Fallos de acceso/proveedor generan logs redactados y alerta verificable; incidente recuperable | Operación |
| ACC-029 | Variedad delitos/dificultad/región/duración; Familiar/General filtrados antes y durante juego | Generador/manual |
| ACC-030 | Carrera recuperable, etiquetas cualitativas y sin recompensas por repetir expediente idéntico | Motor/E2E |
| ACC-031 | Audio/TTS configurables independientes, traducción, texto equivalente y preferencias persistidas | E2E/manual |
| ACC-032 | Instalación independiente arranca con proveedor propio sin cuenta ni llamadas al creador | Instalación |
| ACC-033 | Registro público permite jugar sin API personal; política de retención/exportación/borrado probada | E2E/operación |
| ACC-034 | Pipeline rechaza caso insoluble; simula alternativas, errores y retrasos; job recuperable/cancelable | Generación |
| ACC-035 | Créditos/avisos y licencias de código/assets comprobados antes de publicación | Revisión |
| ACC-036 | Cierre prematuro y plazo evalúan objetivos; original obtenido irregularmente tiene consecuencias proporcionales | Motor |
| ACC-037 | Caso archivado/repetido y variante nueva conservan versiones; resumen de reanudación no revela pistas nuevas | E2E |
| ACC-038 | Modelo insuficiente puede jugar fixture validado; test de conexión no se presenta como evaluación de calidad | IA/manual |
| ACC-039 | Health/readiness, migraciones y reinicio base conservan datos sin credenciales predeterminadas públicas | Integración |
| ACC-040 | Revisión KISS/DRY, código sin ciclos, contratos únicos y cada dependencia con consumidor | Revisión/CI |

## Gates por hito

F1: 020 (sesión local aplicable), 024/025/039/040.
F2: 001/002/004/006–013/017/036.
F3: 003/005/014–016/018/019 (base)/038.
F4: 023/027 (generación)/029/034.
F5: completar 003/005/019/029–031/036/037.
F6: 026/032/035.
F7: completar 020–028/033 y revisión de todos los requisitos v1.

No todos los tipos de prueba son automáticos. La conformidad de accesibilidad requiere evaluación manual además de herramientas.
