# SPEC-001 Motor y tiempo

Estado: definido para el caso fijo; revisión 2026-10-27. Requisitos GDD §4,6,7,9–14. ADR-003/005/007. Tareas T2-01 a T2-06.

## Contrato y límites

Motor puro: resolveAction(definition, run, action) devuelve nuevo estado, eventos ordenados y resultado discriminado. No muta entradas. No obtiene hora real, números aleatorios, datos externos ni credenciales. Recibe un expediente ya validado y la versión compatible de motor. Validación estructural pertenece a case-schema; validación contextual y reglas pertenecen al motor.

Acciones iniciales: inspect, collect, talk, travel, analyze, communicate, query, wait, request_warrant, detain, recover y finish. Cada tipo tiene parámetros propios validados, nunca un diccionario arbitrario ejecutable. Los identificadores deben existir y ser accesibles. No desvelar por qué un ID oculto no es accesible.

Estados: active → closed. Una secuencia puede quedar awaiting_decision dentro de una partida activa; no ejecutar otras acciones que muten hasta cancelar/reanudar esa secuencia. El cierre es definitivo dentro de esa rama y el motor no admite acciones posteriores en ella. Cargar un manual anterior puede abrir otra rama mediante el servicio de guardados (DEC-017), sin borrar el primer resultado oficial (DEC-020); repetir desde inicio crea otra partida. Resultado de acción: applied, clarification_required, impossible, confirmation_required o case_closed. Errores técnicos se gestionan fuera del motor y no son consecuencias narrativas.

## Reloj

Tiempo entero en minutos desde inicio, con deadlineMinutes exclusivo para completar efectos. El caso comienza en 0. Pensar, teclear, leer, consultar atlas/dossier y conversar no avanzan el reloj. Acciones de inspección física, desplazamiento, análisis, verificaciones y espera tienen costes explícitos.

Para cada acción: validar precondiciones, obtener preview sin efectos, confirmar si procede y aplicar. Toda acción con coste positivo o irreversible requiere confirmación del jugador; una confirmación puede aprobar un lote completo y sus estimaciones. El coste real de un viaje puede incluir retraso seeded ya fijado; el preview declara esa posibilidad sin revelar el sorteo.

Si endTime >= deadline, avanzar únicamente hasta deadline, procesar eventos anteriores al plazo y cerrar por vencimiento. No aplicar efectos terminales de la acción ni eventos situados exactamente en deadline. Eventos con mismo minuto se ordenan por ordinal persistido; el cierre gana los empates con el vencimiento. No se penaliza dos veces el mismo retraso al reintentar.

Solicitudes programadas no adelantan el reloj por tiempo de pared: analyze/communicate/query encolan resultado con dueMinute; wait o acciones posteriores lo hacen madurar. Enviar una solicitud cuesta 0 minutos salvo tarifa explícita del expediente. El resultado nunca depende de lo que improvise el narrador.

## Secuencias

Validar cada paso contra el estado producido por el anterior. Hallazgos no interrumpen. Al faltar una decisión o ser imposible, persistir pasos ya aplicados y el resto pendiente. Ofrecer cancelar el resto o continuar los pasos independientes viables, con preview actualizado. Nunca saltar silenciosamente ni cobrar acciones omitidas. Las acciones dependientes del paso fallido no se ejecutan. La API asigna IDs por paso e impide duplicar efectos al reanudar.

Si el plazo vence, descartar resto pendiente y cerrar. Reanudar tras reinicio conserva cursor y confirmaciones; una versión distinta obliga a nuevo preview.

## Evidencias y personajes

Inspect general solo revela observaciones visibles; inspect específico evalúa reglas del elemento. Collect exige acción explícita o intención que implique recoger; no confundir descripción con posesión. Evidencias: objeto, observación, testimonio, análisis o registro. Cada una conserva origen, minuto, método, admisibilidad y relaciones sustentadas. Sin capacidad artificial de inventario ni combinaciones no definidas.

Talk solo puede emitir hechos autorizados por conocimiento y condiciones del NPC. La cooperación puede bajar sin bloquear todas las rutas. El motor actualiza conversación/relación; la IA no altera estos valores. Solicitudes al equipo recurrente entregan datos factuales, nunca valoraciones de rumbo.

## Órdenes, detención y cierre

Request_warrant evalúa suficiencia de evidencias admisibles mediante reglas del expediente, sin consultar guilty como criterio de concesión. Denegación no cierra. Detain exige orden activa, identidad confirmada y localización conocida; el modo interactivo requiere presencia del detective. El objetivo queda fijo cuando se satisfacen orden y ubicación; no hay fugas improvisadas. La detención no cierra el caso.

Recover exige posesión/localización accesible del objeto definido. Finish requiere confirmación y evalúa objetivos ya materializados. Resultado: incorrect si hay inocente detenido; complete si todos los objetivos se cumplen sin detenciones erróneas; partial si se logra al menos un objetivo sin error de detención; unresolved en otro caso. El vencimiento usa los mismos criterios sobre efectos logrados antes del plazo, conservando reason=deadline.

Carrera se aplica una sola vez por cierre, fuera de este primer contrato numérico. Partidas repetidas no vuelven a otorgar recompensas de un mismo expediente al mismo perfil.

## Aceptación

ACC-002 a ACC-013 y ACC-017. Comprobar entradas sin mutación, efectos al minuto exacto, eventos simultáneos, ausencia de movimiento en tiempo real, lotes, admisibilidad y replay con la misma semilla. Los costes concretos del fixture están en SPEC-003; el equilibrio global se cierra en SPEC-008.

## Frontera de integración detallada

El [API de juego](API-juego.md) valida una unión cerrada de acciones y adapta al motor; no entrega Record<string,unknown> sin comprobar al dominio. La versión del agregado HTTP y la secuencia de auditoría pueden ser distintas de las versiones/ordinales internos restaurados del motor.

Las políticas de conversación se desarrollan en [CONVERSACIONES](CONVERSACIONES.md). No se permite que el modelo amplíe efectos más allá de la transición validada.
