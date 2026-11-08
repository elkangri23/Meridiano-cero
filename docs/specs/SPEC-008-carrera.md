# SPEC-008 Carrera, reputación y consecuencias

Estado: implementado en T5-04 (rama `carrera-reputacion-2026-11-08`) con los valores iniciales para playtest de esta spec; cifras NO aprobadas como equilibrio definitivo — la calibración queda pendiente de jugar y afinar (ver «Valores implementados» y ESTADO.md).
Fuentes: GDD §11–14,17; TAD §5/17. ACC-010/012/030/036/037.

## Perfil y herramientas

Detective: nombre, alias y avatar pixel art. Historial de casos, países, monumentos, medallas, puntos y rango. Todas las herramientas disponibles desde el primer caso; el rango no bloquea laboratorio, inteligencia, viajes ni órdenes.

Prestigio, integridad y confianza institucional son dimensiones internas presentadas con etiquetas cualitativas. No mostrar barras secretas que permitan deducir culpabilidad o calidad de una pista.

## Evaluación

El cierre usa objetivos y hechos del motor, no una calificación improvisada por IA. Informe: verdad completa, cronología, evidencias encontradas/omitidas, detenciones correctas/erróneas, legalidad, objetivos y consecuencias de carrera. No exigir al jugador redactar informe adicional.

Resultado complete/partial/unresolved/incorrect según SPEC-001. Valores iniciales para playtest, no aprobados como equilibrio definitivo: 100/40/0/0 puntos base respectivamente; detención errónea afecta confianza; conducta irregular demostrada afecta integridad; recuperación/legalidad contribuyen a prestigio. No recompensar por acusaciones sin fundamento. La fórmula exacta y umbrales de rangos se fijaron en T5-04 con los valores iniciales de esta spec (tabla en «Valores implementados») y se versionan aquí; la calibración definitiva sigue pendiente de playtest.

CareerRecord se deriva de eventos de cierre únicos. Garantía de unicidad por perfil+definición+recompensa: repetir expediente idéntico puede practicarse pero no multiplicar puntos/medallas. Variante con nuevo contenido validado es otra definición; no basta cambiar ID para eludir regla, usar hash de contenido y origen de variante.

## Valores implementados (T5-04, iniciales para playtest)

Fuente de verdad en código: `packages/case-schema/src/career.ts` (`calculateCaseOutcome`, `outcomeFromReport`, `rankForTotals`, `reputationLabel`, `deriveCareerProfile`). Ninguna de estas cifras es equilibrio definitivo: son la base documentada para que Antonio las afine tras jugar.

Puntos base y medallas por resultado del informe final:

| Resultado | Puntos | Medalla |
|---|---|---|
| complete | 100 | medalla-oro |
| partial | 40 | medalla-plata |
| unresolved | 0 | — |
| incorrect | 0 | — |

Deltas por resultado (prestigio / integridad / confianza):

| Resultado | Prestigio | Integridad | Confianza |
|---|---|---|---|
| complete | +10 | +2 | +2 |
| partial | +4 | +1 | 0 |
| unresolved | 0 | 0 | 0 |
| incorrect | −2 | −5 | −10 |

Ajustes sobre esos deltas, derivados solo del informe final del motor:

| Condición | Efecto |
|---|---|
| Detención errónea (alguna detención incorrecta) | confianza −5, integridad −2 |
| Conducta irregular (≥1 acto irregular) | integridad −5, prestigio −2 |
| Recuperación del objeto (lo aporta el llamante desde `run.recoveredObjects`, no del informe) | prestigio +3 |
| Legalidad (sin actos irregulares y todas las detenciones con orden, o ninguna) | prestigio +2, integridad +1 |

Rangos por la suma de las tres dimensiones (prestigio + integridad + confianza): ≥100 Inspector, ≥50 Sargento, ≥20 Detective, si no Aspirante. El rango es honorífico: ninguna herramienta se bloquea por rango.

Etiquetas de reputación por dimensión (presentación; las dimensiones se muestran con etiquetas, no con barras secretas): ≥15 Ejemplar, ≥8 Sólida, ≥0 Discreta, ≥−5 Dudosa, si no Dañada.

## Perfil derivado y sanciones

No hay agregado mutable aparte: el perfil de carrera se deriva de las filas de `official_results` en orden de creación (suma de deltas, medallas/países/lugares únicos en orden de primera aparición). `first_result` guarda en JSONB el resultado, los objetivos, el motivo, el minuto, las recompensas y los países/lugares descubiertos al cerrar.

Solo la retirada de un caso crea sanción (suspensión). Las advertencias (1.ª/2.ª vez visto) quedan en el dossier de su partida y en los deltas, no como sanción de carrera. Una suspensión se resuelve con el primer caso limpio posterior (sin actos irregulares) y no destruye guardados ni bloquea herramientas. `imposedAt`/`resolvedAt` de la sanción son minutos de cierre de su expediente, no un reloj global.

## Implementación DEC-020 (T5-04)

Migración `apps/api/migrations/0010_official_results.sql` (aditiva): crea la tabla `official_results` con el DDL ya presente en el esquema Drizzle, índice único `(owner_id, content_hash)` y `GRANT SELECT, INSERT` a `meridiano_app` (la app solo lee e inserta; el borrado de filas de prueba es como `meridiano_owner`).

`apps/api/src/game/career.ts`: `recordOfficialResult` inserta con `INSERT … ON CONFLICT (owner_id, content_hash) DO NOTHING` dentro de la misma transacción del cierre (atómico con el registro de operación); `loadOfficialResultForContent` carga el oficial de un contenido y calcula rango antes/después por deltas acumulados; `loadCareerProfile` deriva el perfil; `placesAndCountries` toma los lugares descubiertos más la posición actual.

Un cierre es oficial o de práctica comparando el `operationId` del resultado oficial con el `run_id` del registro de operación de ese cierre (`isThisRun`): el primer cierre confirmado en servidor prevalece; dos cierres concurrentes del mismo contenido crean una sola fila; reintentar la misma operación devuelve lo registrado (y una partida cerrada rechaza acciones con 409 RUN_CLOSED).

Superficie de UI: vista de carrera en el archivo (`apps/web/src/archive/CareerSection.tsx`, endpoint `GET /api/v1/career`), evaluación de carrera por Margaret en la ventana del equipo (`teamServiceId 'evaluate'`, sin valorar el caso en curso) y sección «Consecuencias de carrera» en el informe final (`ReportContent`): el cierre oficial muestra puntos/medalla/rango antes→después/deltas; el de práctica muestra el resultado oficial existente y que este cierre no cambia la carrera; una partida cerrada antes de la carrera muestra una frase honesta sin resultado oficial.

## Conductas irregulares

Intentar forzar acceso, suplantar, sobornar o entrar sin permiso es una intención de juego, sin tutorial real de delito. Antes de consecuencia irreversible ofrecer confirmación con riesgos conocidos. Solo testigos/autoridades con conocimiento plausible producen respuesta; no existe detector omnisciente del comportamiento.

Consecuencias definidas por expediente: evidencia inadmisible, cooperación reducida, advertencia, pérdida de confianza, retirada del caso o suspensión de carrera. No hay salud, combate, lesiones controlables ni muerte permanente. Una suspensión no destruye guardados; su alcance/duración se fija en reglas de carrera y permite recuperación.

Valores de playtest implementados (GDD §14, pendientes de calibración por SPEC-008): cada acto cuesta 30 min; ser visto es advertencia + cooperación de los testigos a 0; a la 3.ª vez que te ven, retirada del caso; el informe final descuenta 10 puntos por acto (línea «Conducta irregular» siempre en el desglose, también a 0). Lo revelado sobornando o suplantando se marca inadmisible; lo recuperado tras forzar el acceso ya era inadmisible por `recover`. La retirada cierra la partida con motivo `withdrawn` y sin puntos de tiempo restante.

Preservar rutas alternativas aun con cooperación reducida, salvo pérdida legítima por plazo/retirada definida. Ninguna consecuencia reescribe la verdad.

## Guardado y archivo

Autoguardado de cada transición confirmada. Múltiples casos abiertos con relojes independientes y sin avance mientras no se actúa. Resumen al retomar se deriva de lo descubierto y pendientes, sin pistas nuevas. Archivo de cerrados con informe; repetir crea nueva partida sobre definición fija. Generar variante requiere pipeline completo.

## Aceptación y cierre pendiente

T5-04 implementa la fórmula y los umbrales con los valores iniciales de esta spec (ver «Valores implementados»); la calibración definitiva con evidencia de playtest sigue pendiente — los valores NO se presentan como definitivos. Tests de recompensa idempotente, repetición, varias partidas, reputación recuperable, sanción con conocimiento plausible y lectura de informe: `apps/api/src/game/career.integration.test.ts` (7 tests) y `apps/web/src/e2e/career.spec.ts` (3 tests). Ninguna fórmula abierta debe resolverse como constante improvisada en implementación.

## Guardados manuales y repetición

DEC-017 permite volver a un guardado manual del mismo caso y probar decisiones distintas. La carga no borra el registro de recompensas ya concedidas ni permite acumularlas por repetir la misma resolución. DEC-020 fija el primer resultado para carrera y reputación; no se sustituye por el mejor resultado posterior.

### Primer resultado oficial

El primer cierre definitivo persistido del caso para ese perfil fija su resultado oficial, sea éxito, parcial, error o vencimiento. Cargar guardados antes de ese primer cierre permite cambiar decisiones sin existir aún un resultado oficial. Tras registrarlo, las nuevas resoluciones del mismo expediente son práctica: no mejoran ni empeoran de nuevo la carrera/reputación ni vuelven a otorgar puntos o medallas.

El registro oficial y su clave de unicidad quedan fuera del estado restaurable. Abrir otra partida del mismo expediente no reinicia esta regla; se aplica la identidad de contenido ya prevista, no solo el runId. Una variante realmente distinta y validada conserva el tratamiento de otra definición.

Persistir cierre y registro oficial de forma atómica. Dos cierres concurrentes no producen dos resultados oficiales: el primero confirmado en servidor prevalece. Reintentar la misma operación devuelve lo registrado. La UI distingue el resultado oficial del resultado de práctica.

Aceptación adicional bajo ACC-030: cerrar incorrectamente, cargar un guardado anterior y lograr éxito conserva el primer resultado; cerrar con éxito y repetir con error tampoco cambia carrera/reputación. Reintentos, dos pestañas y otra partida del mismo contenido no crean recompensas ni sustituciones adicionales.

## Persistencia de primer resultado en T3

Aunque las fórmulas numéricas se implementen en T5-04, T3-02 debe conservar identidad de contenido y primer cierre oficial fuera del snapshot restaurable. No esperar a la fase de puntos para permitir que una carga borre qué cierre fue el primero. [GUARDADOS](GUARDADOS.md) concreta concurrencia, práctica y registros.
