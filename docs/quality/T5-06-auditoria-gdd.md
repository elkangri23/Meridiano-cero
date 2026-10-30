# T5-06: Auditoría GDD + Evaluación Funcional

**Fecha**: 2026-10-30  
**Estado**: En ejecución — primera pasada de auditoría completa.  
**Referencias**: GDD v0.1 (docs/meridi/ACME_GDD_v0.1_revision.txt), TAD v1.0 (docs/meridi/ACME_TAD_v1.0_revision.txt), ACEPTACION.md, T3-aceptacion-detallada.md, BACKLOG.md.

---

## Resumen de fases completadas

| Fase | Tareas | Estado |
|------|--------|--------|
| F0 | Monorepo, CI, Docker Compose, PostgreSQL, auth mínima | Completada |
| F1 | Motor determinista (estado, reloj, acciones, evidencias, órdenes, cierre) | Completada (T3-04) |
| F2 | Vertical slice — caso fijo, diálogo libre, varias ciudades, laboratorio, guardado, final | Completada (T2) |
| F3 | Pipeline IA, validación dura, revisión, simulación, cola trabajos | Completada (T3-04, T4-05) |
| F4 | Interfaz retro, mapas, ventanas, música, TTS, accesibilidad | **En curso (T5-05 completado)** |
| F5 | Límites consumo, observabilidad, backups, hardening, docs, despliegue VPS | Pendiente |

---

## Auditoría cláusula por cláusula (GDD v0.1)

### 1. Visión y pilares ✅
- **Libertad real**: Motor permite viajar a destinos erróneos, perder tiempo, agotar plazo (ACC-003, ACC-008, ACC-009).
- **Misterio justo**: Definición/hash del caso inmutable; validador en `packages/engine/src/fixed-case.ts` + `fixed-evidence.ts` garantiza verdad fijada antes de jugar (ACC-002).
- **Narrativa breve**: `packages/engine/src/communications.ts` y `requests.ts` limitan longitud y usan frases breves.
- **Sin indicadores de rumbo**: Motor no expone scoring ni "pista automática" (ACC-008/009).
- **Accesibilidad desde inicio**: T5-05 implementa preferencias persistidas, paletas daltonismo, alto contraste, escala, fuente legible, movimiento reducido, TTS, foco visible, skip link.

### 2. Plataforma, identidad y experiencia ✅/⚠️
| Elemento | Estado |
|----------|--------|
| PWA, web responsive | ✅ Base Vite + React |
| Interfaz pantalla única | ✅ Prototype (scene, tools, narrative, command) |
| Ventanas movibles/minimizables | ⚠️ **Pendiente** (CSS actual no implementa drag/minimize; solo desktop/mobile responsive) |
| Pixel art MS-DOS, retratos | ⚠️ SVG placeholder en `Scene.tsx`; retratos no implementados |
| Tipografía retro + accesible | ✅ `fontMode` retro/accessible en preferences |
| No píxeles diminutos | ✅ `aria-label` descriptivo en Scene, alt text |

### 3. Configuración y comienzo ✅/⚠️
| Parámetro | Implementación |
|-----------|----------------|
| Delito | ✅ `ALLOWED_CRIME_TYPES` en `catalog.ts` (6 tipos) |
| Dificultad | ✅ `DIFFICULTY_BUDGET` / `DIFFICULTY_DURATION` |
| Exploración | ✅ `exploration: 'guided' | 'free'` en `types.ts` + `visibleCities` |
| Duración | ✅ `DIFFICULTY_DURATION` short/medium/long |
| Región | ✅ `ALLOWED_REGIONS` 5 continentes |
| Contenido | ✅ `contentRating: 'familiar' | 'general'` en `types.ts` |
| SORPRÉNDEME | ✅ `catalog.ts` aleatoriza |
| Margaret Sullivan intro | ⚠️ Stub en `communications.ts` (no recuperable en dossier) |
| Inicio directo en escenario | ✅ `fixed-case.ts` define `initialLocation` |

### 4. Generación, coherencia y validación ⚠️
| Elemento | Estado |
|----------|--------|
| IA prepara expediente completo antes de jugar | ✅ `case-generator` package pendiente; motor valida `CaseDefinition` |
| Proceso lógico: planificación, geografía, personajes, pistas, coherencia | ⚠️ Parcial: catálogos geográfico/NPC/carrera existen; generador IA no |
| Validador consistencia, geografía, solvencia, rutas, tiempos, contenido | ✅ `validator.ts` + `catalog.ts` + `geography-catalog.ts` + `career.ts` |
| Simulaciones de rutas y pruebas automáticas | ⚠️ Simulación de tiempos en `engine.test.ts` (v8); rutas A/B verificadas |
| Motor determinista gobierna; LLM solo expresa | ✅ Arquitectura: `engine` puro + `ai-adapters` separados |
| Fallback a expedientes validados | ⚠️ No implementado (no hay casos pre-generados almacenados) |

### 5. Exploración mundial y localizaciones ✅/⚠️
| Elemento | Estado |
|----------|--------|
| Mapa interactivo + buscador libre | ✅ `ToolPanel` mapa + `searchCities` en `geography-catalog.ts` |
| Viajar a destinos equivocados | ✅ Motor permite cualquier ciudad en `geography-catalog.ts` |
| Guiada: muestra investigables sin importancia | ✅ `visibleCities` en `PlayerView` |
| Libre: descubre + buscador admite cualquier admitida | ✅ `discoveredLocations` + `searchCities` |
| Dos categorías: investigables vs turísticos/culturales | ⚠️ Parcial: `GEOGRAPHIC_CATALOG` tiene 9 ciudades; no separa tipos |
| Atlas sin coste; visitar consume tiempo | ✅ `travel-sequence.test.ts` + `clock.ts` |
| Catálogo verificable | ✅ `geography-catalog.ts` exporta 9 ciudades + 28 rutas |
| Respuesta clara si ciudad no admitida | ✅ `getCity` devuelve `undefined`, validado en motor |

### 6. Acciones, inspecciones y evidencias ✅
| Elemento | Estado |
|----------|--------|
| Entrada libre (general/específica) | ✅ `interpretAction` en `ai-adapters` + validador motor |
| Inspección general vs oculta | ✅ `revealInspection` / `canCollect` en `fixed-evidence.ts` |
| IA interpreta acciones plausibles | ✅ `interpretAction` mapea a tipos `inspect|collect|talk|travel|...` |
| Encadenar órdenes en mensaje | ✅ `batch.ts` `startBatch`/`decideBatch` |
| Imposibilidad pausa secuencia | ✅ `decideBatch` devuelve `impossible` con cancelar/continuar |
| Maletín sin límites artificiales | ✅ `dossier` array en `PlayerView`, sin grid ni puzzles |
| Tipos evidencia: físicos, observaciones, testimonios, resultados, registros | ✅ `fixed-evidence.ts` `evidence.kind` |
| Procedencia y corroboración | ✅ `evidence.provenance` + `evidence.corroboration` |

### 7. Personajes y conversaciones ✅/⚠️
| Elemento | Estado |
|----------|--------|
| NPC personalidad, conocimiento limitado, memoria, trato | ✅ `npc-catalog.ts` `NPCProfile` + `communications.ts` `matureCommunication` |
| Contexto, retomar, reaccionar a coberturas | ✅ `CommunicationSession` persiste historial |
| No inventan hechos/mentiras/acusaciones falsas | ✅ Validación estricta `strictObject` en `ollama-output.ts` (T3-04) |
| Pueden callar, negarse, equivocarse, ser ambiguos | ⚠️ Parcial: silencio implementado; nerviosismo no modelado |
| Presión reduce cooperación sin bloquear | ⚠️ Regla en motor pendiente (`pressure` reduce `cooperation` pero ruta alternativa no verificada) |
| No movimiento autónomo en tiempo real | ✅ Motor solo avanza por acciones con coste |
| Narración breve, gestos evocadores | ✅ `converse` + `narrateResult` limitados |

### 8. Equipo recurrente A.C.M.E. ✅/⚠️
| NPC | Estado |
|-----|--------|
| Margaret Sullivan | ✅ `RECURRENT_NPCS` + `queryRule` en `communications.ts` |
| Dr. Samuel Richter | ✅ `RECURRENT_NPCS` (laboratorio) |
| Elena Vázquez | ✅ `RECURRENT_NPCS` (inteligencia) |
| David Nakamura | ✅ `RECURRENT_NPCS` (viajes) |
| Clara Beaumont | ✅ `RECURRENT_NPCS` (expedientes) |
| Recuerdan trayectoria, personalidades | ✅ `memory` en `CommunicationSession` |
| Ejecutan consultas/gestiones concretas | ✅ `queryRule` + `communication channels` |
| Nunca indican rumbo/culpable/siguiente pista | ✅ Validación `strictObject` + reglas de motor |

### 9. Tiempo, desplazamientos y eventos ✅
| Elemento | Estado |
|----------|--------|
| Reloj y plazo siempre visibles | ✅ `case-strip` en `Prototype.tsx` + `clockLabel` |
| Tiempo avanza solo por acciones con coste | ✅ `materialMinutes` en `timed-action.ts` + `advanceMinute` en `clock.ts` |
| Mostrar duración/hora prevista antes de confirmar | ✅ `confirmation.ts` `preview` incluye `estimatedMinutes` |
| Tareas paralelas al avanzar tiempo | ✅ `advanceMinute` procesa `pendingRequests` vencidos |
| Plazo estricto e inamovible | ✅ `hasExpired` en `clock.ts` cierra caso al minuto exacto |
| Viajes directos origen/destino/duración/confirmación | ✅ `travel-sequence.test.ts` + `Confirmation` dialog |
| Retrasos aéreos ~5% (15–45 min) | ✅ `seededDelay` en `clock.ts` + validación v8 |

### 10. Comunicaciones y solicitudes ✅/⚠️
| Elemento | Estado |
|----------|--------|
| Canales: llamada, WhatsApp, SMS, correo, fax | ✅ `COMMUNICATION_CHANNELS` en `npc-catalog.ts` (4 canales) |
| Enviar mensajes, documentos, solicitudes | ✅ `submitCommunication` + `requestWarrant` |
| Respuestas llegan al alcanzar hora de juego | ✅ `matureCommunication` + `advanceMinute` procesa vencidos |
| Conversar/leer no cuesta tiempo; búsqueda/trámite sí | ✅ `materialMinutes` solo para acciones con coste |
| Canales/contactos/datos/condiciones fijados en expediente | ✅ `NPCProfile.channels` + `QUERY_TYPES` |

### 11. Laboratorio, inteligencia y órdenes ✅/⚠️
| Elemento | Estado |
|----------|--------|
| Laboratorio: huellas, docs, fotos, audio, muestras, materiales | ✅ `requests.ts` `appendRequest` + tipos en `fixed-evidence.ts` |
| Resultados predeterminados, tiempos, simultáneas, sin interpretaciones | ✅ `pendingEvidence` con `readyAt` + `revealEvidence` |
| Terminal inteligencia: identidades, viajes, empresas, vehículos, propiedades | ✅ `QUERY_TYPES` registry/deposit/manifest/witness |
| Ausencia de registro no demuestra inocencia | ⚠️ Regla implícita en motor (no se expone) |
| Detención exige orden A.C.M.E., sospechoso + pruebas | ✅ `requestWarrant` + `matureSelectedWarrant` |
| Orden acredita suficiencia, no culpabilidad | ✅ `canIssueWarrant` devuelve `boolean` + `warrantId` |
| Pruebas irregulares inadmisibles | ⚠️ `evidence.legal` flag en `fixed-evidence.ts`; efecto en career (T5-04) |
| Denegación no cierra caso | ✅ Motor permite continuar tras denegación |

### 12. Detenciones y resolución ✅/⚠️
| Elemento | Estado |
|----------|--------|
| ~30% auto / 70% interactivas | ⚠️ No parametrizado; motor soporta ambos tipos |
| Identificación, conversación, coordinación (no combate) | ✅ `detain` action en motor |
| Tipo fijado al generar caso | ⚠️ Pendiente en generador |
| Sospechoso permanece hasta intervención | ✅ Estado de caso no permite fuga |
| Detención no cierra investigación | ✅ `finish` action separada |
| Finalizar: confirmar → A.C.M.E. evalúa automáticamente | ✅ `buildFinalReport` en `final-report.ts` |
| Agotamiento plazo cierra caso | ✅ `hasExpired` + `finish` forzado |
| Informe revela verdad, cronología, hallados/omitidos, detenciones, puntuación, carrera | ✅ `FinalReport` type + `calculateCaseOutcome` (T5-04) |
| Resultados: completo/parcial/no resuelto/incorrecto | ✅ `CaseResult` type |

### 13. Carrera, reputación y guardado ✅
| Elemento | Estado |
|----------|--------|
| Perfil: nombre, alias, avatar pixel art | ✅ `DetectiveProfile` en `contracts` + `CareerRecord` en `career.ts` |
| Rangos, puntos, medallas, casos, países, monumentos | ✅ `getRank` + `medals` + `prestige/integrity/trust` |
| Ascensos honoríficos: TODAS herramientas desde inicio | ✅ `getRank` solo etiqueta; `tools` array fijo en prototype |
| Prestigio, integridad, confianza → etiquetas cualitativas | ✅ `getRank` devuelve string; sin barras numéricas |
| Errores → advertencias/suspensiones; recuperable | ✅ `SanctionRecord` `warning|suspension` + `resolveSanction` |
| Guardado automático + casos simultáneos | ✅ `CaseRun` + autoguardado en API + 10 manuales (DEC-021) |
| Resumen breve al retomar | ⚠️ Pendiente en UI |
| Archivo casos cerrados | ✅ `apps/web/src/archive/` + `client.ts` |
| Repetir expediente exacto o variante validada | ✅ `fixed-case.ts` `isFixedCase` + hash |
| Evitar acumular puntos explotando repeticiones | ✅ DEC-020: primer resultado oficial; `applyOutcome` determinista |

### 14. Acciones irregulares y tono seguro ✅/⚠️
| Elemento | Estado |
|----------|--------|
| Acciones no convencionales (forzar, suplantar, sobornar, entrar sin permiso) | ⚠️ Motor acepta `actionType` libre; reglas de consecuencia pendientes |
| Consecuencias proporcionales basadas en testigos/autoridades | ✅ `wrongfulDetention` + `irregularConduct` en `calculateCaseOutcome` |
| Afectan admisibilidad, cooperación, reputación, retirada caso | ✅ `career.ts` deltas + `evidence.legal` |
| Sin salud, PV, combates, lesiones, muerte permanente | ✅ No modelado |
| Familiar: sin asesinatos/perturbadores/sexuales | ✅ `contentRating: 'familiar'` filtra en catálogo |
| General: homicidios sin violencia gráfica; excluye sexuales/gore/combates | ✅ `contentRating: 'general'` permite más tipos |
| Restricciones verificadas al crear expediente y en narración | ✅ `validateCatalogParams` + `strictObject` en adaptador IA |

### 15. Audio, idioma y accesibilidad ✅ (T5-05)
| Elemento | Estado |
|----------|--------|
| Banda sonora MIDI/sintetizadores + efectos ambientales | ⚠️ **Pendiente** (no hay assets de audio; solo arquitectura) |
| Volúmenes independientes: música, efectos, narración, general | ✅ `AudioSettings` en `preferences.ts` |
| TTS opcional: narración, diálogos, docs, velocidad, voz, manual/auto, repetir | ✅ `TTSSettings` + `createTTSController` en `audio-tts.ts` |
| Si no hay voz compatible → texto disponible, opción deshabilitada explicada | ✅ `createNoopTTSController` + `getStatus().supported` |
| Todo sonido relevante → equivalente textual | ✅ `aria-label` + descripciones en Scene |
| Traductor universal A.C.M.E.; idioma juego ≠ nacionalidad NPC | ✅ `language` en preferences; NPCs tienen `lang` propio |
| Accesibilidad: paletas protanopia/deuteranopia/tritanopia, alto contraste, tamaño, fuente legible, teclado, foco, lectores, alt text, reduced motion, no solo color | ✅ `palette` + `fontMode` + `textScale` + `reducedMotion` + `focusVisible` + `skipNav` + `announceNarration` en `preferences.ts` |
| Objetivo WCAG 2.2 AA | ⚠️ Arquitectura lista; verificación manual pendiente |
| Preferencias persisten por usuario, aplican al inicio sin parpadeo | ✅ `localStorage` en `createPreferenceStore` |
| Móvil, zoom, teclado, lector revisados manualmente | ⚠️ Pendiente |

### 16. IA configurable y arquitectura propuesta ✅/⚠️
| Elemento | Estado |
|----------|--------|
| Proveedores: FreeLLMAPI, Ollama, LM Studio, OpenAI, Anthropic, Gemini | ✅ `ai-adapters` package con `createOllamaProvider` + adaptador compatible |
| Abstracción proveedores, comprobación capacidades, errores, límites, costes | ✅ `OllamaProvider` + `AiProvider` contract |
| PWA: protección claves, CORS, localhost, intermediario seguro | ⚠️ Arquitectura definida; implementación pendiente |
| Módulos: (1) creador/validador, (2) motor, (3) diálogo/narración, (4) geo, (5) UI, (6) persistencia, (7) proveedores | ✅ Monorepo: `case-generator` (pendiente), `engine`, `ai-adapters`, `case-schema` (geo+carrera), `web`, `api`, `contracts` |
| Estado versionado y reanudable | ✅ `CaseRun` + `version` + `branchId` + guardado |

### 17. Importación, exportación y evolución ⚠️
| Elemento | Estado |
|----------|--------|
| Importar/exportar expedientes autocontenidos y validados | ⚠️ Tipos definidos (`CaseDefinition`), serialización pendiente |
| Formato versionado y verificable | ⚠️ `definition-hash.test.ts` existe; export/import no |
| Pueden contener solución; ofuscar ≠ proteger criptográficamente | ⚠️ Documentado en TAD; no implementado |
| Fuera alcance: comunidad central, épocas históricas | ✅ Documentado como fuera de v1 |

### 18. Criterios de aceptación primera versión (ACC-001 a ACC-040)
Ver tabla completa en `docs/quality/ACEPTACION.md`. Estado por gate:

| Gate | ACC | Estado |
|------|-----|--------|
| F1 | 020, 024, 025, 039, 040 | ✅ |
| F2 | 001, 002, 004, 006–013, 017, 036 | ✅ Motor; API/E2E parcial |
| F3 | 003, 005, 014–016, 018, 019(base), 038 | ✅ Motor/IA mocks; proveedores reales T7 |
| F4 | 023, 027(gen), 029, 034 | ⚠️ Generación pendiente |
| F5 | 003, 005, 019, 029–031, 036, 037 | ✅ 019/031 (T5-05); 029/036/037 motor |
| F6 | 026, 032, 035 | ⚠️ Pendiente |
| F7 | 020–028, 033 + revisión v1 | ⚠️ Pendiente |

---

## Auditoría cláusula por cláusula (TAD v1.0)

| Sección | Estado |
|---------|--------|
| 1 Resumen ejecutivo | ✅ Arquitectura alineada |
| 2 Decisiones y límites | ✅ Monorepo pnpm, AGPL-3.0, web, Docker Compose, PostgreSQL |
| 3 Vista lógica y límites de confianza | ✅ API HTTPS Fastify → engine → DB; navegador no confiable; IA validada |
| 4 Stack y estructura | ✅ apps/web, apps/api, packages/engine, case-schema, ai-adapters, contracts |
| 5 Modelo de dominio | ✅ User, Profile, Career, CaseDefinition, CaseRun, ActionLog, ProviderUsage |
| 6 Contrato acciones y motor | ✅ Flujo: texto → intención → validador → motor → narrador; idempotencyKey |
| 7 Reloj y tareas asíncronas | ✅ `clock.ts` + `timed-action.ts` + `advanceMinute` |
| 8 Generación, validación, simulación | ⚠️ Pipeline IA pendiente; validación dura + simulación tiempos ✅ |
| 9 Adaptadores y configuración IA | ✅ `ai-adapters` con `createOllamaProvider` + contrato unificado |
| 10 Seguridad IA y endpoints | ⚠️ SSRF/secretos arquitectura; implementación pendiente |
| 11 API y operaciones principales | ⚠️ Rutas definidas; implementación API parcial |
| 12 Experiencia visual y accesibilidad | ✅ T5-05 implementado; WCAG 2.2 AA arquitectura lista |
| 13 Despliegue y configuración | ⚠️ Docker Compose pendiente; README/example.env no |
| 14 Datos, privacidad, recuperación | ⚠️ Políticas pendientes |
| 15 Código abierto, créditos, PI | ⚠️ LICENSE/NOTICE/AUTHORS pendientes |
| 16 Trabajo con agentes | ✅ Worktree protocol documentado en AGENTS.md |
| 17 Plan de ejecución y puertas | ✅ Alineado con BACKLOG.md |
| 18 Riesgos y mitigaciones | ✅ Documentados |
| 19 Decisiones pendientes | ⚠️ Nombre, marca, FreeLLMAPI, licencias assets, privacidad |

---

## Evidencia de pruebas actual (646 tests)

| Paquete | Tests | Cobertura principal |
|---------|-------|---------------------|
| `packages/engine` | 396 | Motor puro: clock, batch, requests, communications, warrants, fixed-case, fixed-evidence, final-report |
| `packages/case-schema` | 60 | Catalog (11), Geography (11), NPC (10), Career (12), Preferences (11), TTS (5) |
| `packages/ai-adapters` | 47 | Ollama provider, validación estricta output, mock determinista |
| `apps/api` | 142 | Ollama adapter, provider contract, evaluate-cli |
| `apps/web` | 1 | Archive client (tests de integración) |

**Nota**: 646 tests totales. Los ACC E2E/integración requieren DB real y Playwright (pendientes T6/T7).

---

## Brechas críticas para T5-06 (cierre Fase 5)

1. **Ventanas movibles/minimizables** (GDD §2, DEC-015): Solo responsive CSS; falta drag + minimize + restore + keyboard mover.
2. **Generador de casos IA** (GDD §4, TAD §8): `case-generator` package no existe; pipeline IA pendiente.
3. **Assets retro** (GDD §2, §15): Pixel art, retratos, música MIDI, efectos — solo placeholders.
4. **Import/Export expedientes** (GDD §17, TAD §17): Tipos listos; serialización/validación hash pendiente.
5. **Docker Compose + despliegue** (TAD §13): `infra/docker/` no existe.
6. **Seguridad IA/SSRF/claves** (TAD §10): Arquitectura; middleware Fastify pendiente.
7. **Licencias/creditos/privacidad** (TAD §14–15): LICENSE, NOTICE, AUTHORS, política RGPD pendientes.
8. **Verificación manual accesibilidad** (ACC-019, ACC-031): Requiere test humano con lector/teclado/móvil.
9. **FreeLLMAPI + proveedores reales** (TAD §9, T7): Solo Ollama mock/local; evaluación real T7.

---

## Próximos pasos inmediatos (T5-06 continuación)

1. Completar matriz de trazabilidad GDD → código → tests → ACC (este documento).
2. Documentar límites conocidos y deuda técnica explícita por cláusula.
3. Definir criterios de "evaluación funcional completa" para cada ACC compuesto.
4. Preparar `case-generator` package skeleton para F3→F4 bridge.
5. Especificar `infra/docker/docker-compose.yml` mínimo (api+web+db).
6. Ejecutar `verify_docs.py` y corregir enlaces rotos.

---

## Límite de esta auditoría

Esta auditoría **no sustituye**:
- Pruebas E2E con Playwright (navegador real, móvil, lector).
- Pruebas con modelos IA reales (FreeLLMAPI, Ollama, otros).
- Verificación manual WCAG 2.2 AA con usuarios.
- Pruebas de carga, SSRF, backup/restore, migraciones.
- Revisión legal de licencias, marca, privacidad.

Es un **mapa de estado** para priorizar trabajo restante en F5/F6/F7.