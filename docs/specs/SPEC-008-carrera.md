# SPEC-008 Carrera, reputación y consecuencias

Estado: reglas funcionales detalladas; cifras propuestas para calibrar en T5-04 antes de implementar.
Fuentes: GDD §11–14,17; TAD §5/17. ACC-010/012/030/036/037.

## Perfil y herramientas

Detective: nombre, alias y avatar pixel art. Historial de casos, países, monumentos, medallas, puntos y rango. Todas las herramientas disponibles desde el primer caso; el rango no bloquea laboratorio, inteligencia, viajes ni órdenes.

Prestigio, integridad y confianza institucional son dimensiones internas presentadas con etiquetas cualitativas. No mostrar barras secretas que permitan deducir culpabilidad o calidad de una pista.

## Evaluación

El cierre usa objetivos y hechos del motor, no una calificación improvisada por IA. Informe: verdad completa, cronología, evidencias encontradas/omitidas, detenciones correctas/erróneas, legalidad, objetivos y consecuencias de carrera. No exigir al jugador redactar informe adicional.

Resultado complete/partial/unresolved/incorrect según SPEC-001. Valores iniciales para playtest, no aprobados como equilibrio definitivo: 100/40/0/0 puntos base respectivamente; detención errónea afecta confianza; conducta irregular demostrada afecta integridad; recuperación/legalidad contribuyen a prestigio. No recompensar por acusaciones sin fundamento. La fórmula exacta y umbrales de rangos se fijarán tras jugar fixture y se versionarán.

CareerRecord se deriva de eventos de cierre únicos. Garantía de unicidad por perfil+definición+recompensa: repetir expediente idéntico puede practicarse pero no multiplicar puntos/medallas. Variante con nuevo contenido validado es otra definición; no basta cambiar ID para eludir regla, usar hash de contenido y origen de variante.

## Conductas irregulares

Intentar forzar acceso, suplantar, sobornar o entrar sin permiso es una intención de juego, sin tutorial real de delito. Antes de consecuencia irreversible ofrecer confirmación con riesgos conocidos. Solo testigos/autoridades con conocimiento plausible producen respuesta; no existe detector omnisciente del comportamiento.

Consecuencias definidas por expediente: evidencia inadmisible, cooperación reducida, advertencia, pérdida de confianza, retirada del caso o suspensión de carrera. No hay salud, combate, lesiones controlables ni muerte permanente. Una suspensión no destruye guardados; su alcance/duración se fija en reglas de carrera y permite recuperación.

Preservar rutas alternativas aun con cooperación reducida, salvo pérdida legítima por plazo/retirada definida. Ninguna consecuencia reescribe la verdad.

## Guardado y archivo

Autoguardado de cada transición confirmada. Múltiples casos abiertos con relojes independientes y sin avance mientras no se actúa. Resumen al retomar se deriva de lo descubierto y pendientes, sin pistas nuevas. Archivo de cerrados con informe; repetir crea nueva partida sobre definición fija. Generar variante requiere pipeline completo.

## Aceptación y cierre pendiente

T5-04 cierra fórmula y umbrales en spec con evidencia de playtest antes de código. Tests de recompensa idempotente, repetición, varias partidas, reputación recuperable, sanción con conocimiento plausible y lectura de informe. Ninguna fórmula abierta debe resolverse como constante improvisada en implementación.

## Guardados manuales y repetición

DEC-017 permite volver a un guardado manual del mismo caso y probar decisiones distintas. La carga no borra el registro de recompensas ya concedidas ni permite acumularlas por repetir la misma resolución. DEC-020 fija el primer resultado para carrera y reputación; no se sustituye por el mejor resultado posterior.

### Primer resultado oficial

El primer cierre definitivo persistido del caso para ese perfil fija su resultado oficial, sea éxito, parcial, error o vencimiento. Cargar guardados antes de ese primer cierre permite cambiar decisiones sin existir aún un resultado oficial. Tras registrarlo, las nuevas resoluciones del mismo expediente son práctica: no mejoran ni empeoran de nuevo la carrera/reputación ni vuelven a otorgar puntos o medallas.

El registro oficial y su clave de unicidad quedan fuera del estado restaurable. Abrir otra partida del mismo expediente no reinicia esta regla; se aplica la identidad de contenido ya prevista, no solo el runId. Una variante realmente distinta y validada conserva el tratamiento de otra definición.

Persistir cierre y registro oficial de forma atómica. Dos cierres concurrentes no producen dos resultados oficiales: el primero confirmado en servidor prevalece. Reintentar la misma operación devuelve lo registrado. La UI distingue el resultado oficial del resultado de práctica.

Aceptación adicional bajo ACC-030: cerrar incorrectamente, cargar un guardado anterior y lograr éxito conserva el primer resultado; cerrar con éxito y repetir con error tampoco cambia carrera/reputación. Reintentos, dos pestañas y otra partida del mismo contenido no crean recompensas ni sustituciones adicionales.

## Persistencia de primer resultado en T3

Aunque las fórmulas numéricas se implementen en T5-04, T3-02 debe conservar identidad de contenido y primer cierre oficial fuera del snapshot restaurable. No esperar a la fase de puntos para permitir que una carga borre qué cierre fue el primero. [GUARDADOS](GUARDADOS.md) concreta concurrencia, práctica y registros.
