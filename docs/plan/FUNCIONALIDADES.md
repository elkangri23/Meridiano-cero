# Funcionalidades objetivo y entregas

Esta es la vista de producto del GDD/TAD. El catálogo describe el objetivo v1, no una lista de funciones ya jugables. Motor/fixture tienen implementación, la UI es un prototipo y la IA tiene servicios parciales. [Estado por área y límites](ESTADO.md). Las fases iniciales incorporan un subconjunto; fase 5 completa GDD funcional y fases 6–7 distribución/servicio. Las cláusulas normativas y pruebas están en REQUISITOS y specs.

| Sistema | Funcionalidad que recibirá el jugador/administrador | Primera entrega / completa |
|---|---|---|
| Identidad | Cuenta, detective con nombre/alias/avatar, preferencias | Local F3; público F7 |
| Creación | Delito, dificultad, exploración, duración, región, contenido y SORPRÉNDEME | F4; variedad completa F5 |
| Casos | Verdad fija antes de jugar, personajes/motivaciones/cronología, objetivos y plazo | Fixture F2; generador F4 |
| Coherencia | Validación dura, revisión semántica y rutas simuladas | Fixture F2; generador F4 |
| Introducción | Margaret presenta brevemente; omitir y recuperar en dossier | F3 |
| Órdenes | Lenguaje natural general/específico, referencias y lotes | F3 |
| Tiempo | Plazo visible, costes confirmados, tareas paralelas, sin tiempo por pensar | Motor F2; UI F3 |
| Exploración | Tres ciudades del fixture, guiado/libre, buscador y viajes equivocados | F3 |
| Geografía | Catálogo real verificable, destinos culturales, atlas gratuito | F5 |
| Inspección | Visible frente a oculto, recogida explícita/implicada y acciones plausibles | F2–F3 |
| Evidencias | Dossier sin capacidad artificial, tipos y procedencia, corroboración | F3 |
| NPC | Personalidad, memoria, cobertura, cooperación y conocimiento limitado | F3; equipo completo F5 |
| Equipo | Margaret, Richter, Elena, David y Clara sin consejos que resuelvan | F5 |
| Comunicaciones | Llamadas/WhatsApp/SMS/correo/fax simulados y documentos | Base F3; completo F5 |
| Laboratorio | Análisis de huellas, documentos, fotos/audio/muestras/materiales aplicables | Base F3; variedad F5 |
| Inteligencia | Consultas en lenguaje natural a registros definidos | F3; variedad F5 |
| Legalidad ficticia | Admisibilidad, orden no equivalente a culpa y denegación no terminal | F2–F3 |
| Detención | Coordinada o interactiva sin violencia; localización estable con orden | Fixture F3; distribución de tipos F5 |
| Resolución | Cierre confirmado o por plazo, cuatro resultados e informe automático | F3 |
| Carrera | Rangos honoríficos, puntos/medallas/países/monumentos y todas las herramientas al inicio | Herramientas F3; carrera F5 |
| Consecuencias | Integridad/prestigio/confianza cualitativos, advertencias y recuperación | F5 |
| Irregularidades | Acciones no convencionales con consecuencias plausibles y proporcionales | Fixture F3; completo F5 |
| Guardado | Autoguardado, varios casos aislados, resumen y archivo | Guardado F3; archivo completo F5 |
| Repetición | Repetir exacto sin explotar puntos o generar variante validada | F5 |
| Presentación | Ventanas retro, escenas pixel art y retratos | Funcional F3; acabado F5 |
| Audio | Música/ambiente y volúmenes independientes; texto equivalente | F5 |
| Voz | TTS opcional con voz/velocidad/manual/automático/repetir | F5 |
| Idiomas | Interfaz traducible y traductor A.C.M.E.; idioma no ligado a nacionalidad | Preparación F3; completo F5 |
| Accesibilidad | Teclado/foco, lectores, contraste, color, fuente/escala y movimiento | Base F3; objetivo AA revisado F5 |
| Proveedores | Ollama local, LM Studio y externos/compatibles; roles diferenciados | Ollama F3; adaptadores F4 |
| Compartir | Import/export autocontenido versionado, validado y entre proveedores | F4 |
| Autoalojamiento | Compose, proveedor propio, sin servidor/cuenta central obligatoria | F6 |
| Servidor público | Registro y juego gratis con IA del administrador, sin API del jugador | F7 |
| Operación | Health, migraciones, cuotas, alertas, copia/restauración y privacidad | Base F1; completo F6–F7 |
| Código abierto | AGPL objetivo, fuentes, créditos e inventario de licencias | F6 |

## Restricciones que forman parte de la experiencia

No ayudas automáticas de rumbo, pruebas nuevas improvisadas, solución cambiada, combate, salud ni muerte permanente. Familiar por defecto; General también excluye gore/delitos sexuales/combate. No píxeles imprescindibles ni pistas solo por color/sonido. No movimiento autónomo en tiempo real. No rangos que bloqueen herramientas.

La v1 no incluye comunidad pública de casos, épocas históricas jugables, multijugador, pagos, apps nativas, funcionamiento offline integral ni federación. La inspiración retro no autoriza reutilizar marcas, personajes o gráficos protegidos.

## Proveedores confirmados

Instalaciones propias: proveedor y endpoint configurables mediante adaptadores. Casa: Ollama; trabajo: FreeLLMAPI. VPS: proveedor predeterminado del administrador y claves personales opcionales para otro proveedor habilitado, sin obligar a aportar claves para jugar. DEC-018/019; [detalle de contratos y aceptación](../specs/IA-proveedores.md). Es alcance confirmado, no funcionalidad completa ya disponible.
