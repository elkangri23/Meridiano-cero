# Observabilidad, residencia y ciclo de vida de datos

Fecha: 2026-10-28. Anexo propuesto de SPEC-004/005/007/009/010/011. Implementación pendiente; no implica telemetría obligatoria ni un servicio externo. Complementa [resiliencia](RESILIENCIA.md) y [casos límite](../quality/BORDES-EJECUCION.md). «Residencia» se cubre literalmente además de resiliencia: qué datos viven dónde y qué cruza cada frontera. No se certifican condiciones de proveedores ni cumplimiento legal.

## Preguntas que la operación debe poder responder

- ¿La acción quedó confirmada, sigue incierta o fue rechazada antes de actuar?
- ¿La latencia procede de espera de conexión, lock, motor, transporte IA o serialización?
- ¿Hay pérdida de servicio general o solo de una función/conexión?
- ¿Una recuperación ha duplicado efectos, publicación o consumo reservado?
- ¿Qué versión de aplicación, motor, esquema y política produjo un fallo?
- ¿Se puede recuperar una partida y qué datos se perderían si se restaura hoy?

Ninguna pregunta exige leer la solución, prompts, conversación o credencial del usuario. El ActionLog privado de dominio no se copia al logger operativo. El historial de operaciones durable no se sustituye por logs que pueden descartarse.

## Tres registros con finalidades diferentes

| Registro | Contenido | Acceso / garantía |
|---|---|---|
| Dominio | Transición, rama, revisión, hechos y operación; snapshot y primer cierre | Servidor autorizado; atomicidad SQL; contiene información privada |
| Auditoría administrativa | Actor interno, acción administrativa, objeto opaco, resultado, fecha; sin valor de secreto | Acceso mínimo; cambios de proveedor, clave, exportación, borrado, corte, restore y configuración quedan trazados |
| Operación | Código normalizado, duración, fase, resultado, correlación opaca, versión | Personal operativo autorizado; redacción, rotación y retención; fallo de exportación no revierte juego |

La auditoría de cambios sensibles se confirma con su cambio persistido. Si no puede persistirse, se rechaza ese cambio; es distinto de un collector de métricas caído. El historial de dominio no es un almacén de depuración indiscriminado.

## Eventos estructurados mínimos

Campos permitidos: timestamp UTC, level, eventName de catálogo, service, release, environment, requestId generado por servidor, traceId/spanId si existen, operationId/jobId opacos cuando corresponda, phase, outcome, errorCode normalizado, durationMs monotónica, retryAttempt y schemaVersion del evento. Registrar branch/revision solo en diagnóstico restringido cuando haga falta resolver una operación; nunca como labels métricos.

Catálogo inicial: request.completed, operation.committed, operation.replayed, operation.conflict, operation.uncertain, provider.completed, provider.failed, provider.breaker_changed, quota.denied, quota.reconciled, job.claimed, job.recovered, job.terminal, backup.completed, restore.checked, readiness.changed y telemetry.dropped. Un resultado imposible del juego no es un error de servidor.

No registrar Authorization, Cookie, Set-Cookie, CSRF, claves, confirmationToken, idempotencyKey cruda, cuerpos, texto libre, nombres, email, IP completa por defecto, URL de proveedor con query, SQL con parámetros, seed, solution, payload de solicitudes, memoria NPC ni stack de terceros sin sanitizar. Redactar antes de serializar/exportar, también en excepciones, spans, logs de proxy y mensajes de SDK. No basta un filtro en la pantalla de administración.

requestId de cliente no controla el ID autoritativo. Validar y acotar cualquier contexto de trace recibido; no permitir inyección de líneas o cardinalidad ilimitada. operationId enlaza reintentos entre requests; cada intento tiene requestId diferente. Una respuesta HTTP incluye requestId seguro para soporte, sin exigir al usuario copiar una conversación. Las herramientas de soporte reautorizan el acceso a la operación.

## Métricas y denominadores

Nombres conceptuales, no librería elegida. Labels solo catálogos acotados: servicio, plantilla de ruta, método, clase de estado, función IA, adaptador habilitado, resultado y fase. Prohibidos userId/runId/jobId/requestId, modelo libre, URL, mensajes de error y IDs de conexión personales como labels. Detalle por cuenta pertenece a un ledger restringido, no al backend de series temporales.

| Señal | Tipo y unidad | Uso / regla |
|---|---|---|
| http_requests_total | Contador | Peticiones terminadas por plantilla y resultado; health separado |
| http_duration_seconds | Histograma | p50/p95/p99 por función; separar IA de lectura/commit |
| operations_total | Contador por outcome | committed/replayed/conflict/rejected/uncertain; replay no cuenta como segundo efecto |
| db_pool_wait_seconds / db_query_seconds | Histogramas | Espera frente a ejecución; sin SQL literal |
| db_pool_in_use / db_pool_waiters | Gauges | Saturación real y espera acotada |
| provider_calls_total / provider_duration_seconds | Contador/histograma | Función, adaptador, éxito/fallo/timeout/cancelado; sin datos de cuenta |
| provider_usage_tokens | Contador separado observed/estimated | No sumar estimación y observación como dos consumos |
| provider_usage_unknown / budget_reserved | Gauges | Deuda de conciliación y reservas, unidad declarada |
| jobs_queued / jobs_running / oldest_job_age_seconds | Gauges | Antigüedad evita ocultar un job atascado detrás de poco volumen |
| job_lease_recoveries / stale_publish_rejected | Contadores | Recuperación y rechazo por fencing |
| factual_fallback_total / invalid_ai_output_total | Contadores | Calidad operacional; no valorar estrategia del jugador |
| backup_last_success_age_seconds / restore_last_test_age_seconds | Gauges | Copia reciente y restauración probada son señales separadas |
| disk_free_bytes / process_memory_bytes / event_loop_delay_seconds | Gauge/histograma | Capacidad de almacenamiento y proceso |
| telemetry_dropped_total / exporter_failures_total | Contadores | Visibilidad del propio sistema de observación |

Evitar doble conteo al reiniciar o exportar de nuevo. Contadores de proceso pueden reiniciar; ledger de consumo es persistente. No calcular coste monetario con tarifa no verificada. Uso desconocido nunca equivale a cero. Distribuir histogramas con buckets definidos según presupuestos y revisar cardinalidad bajo carga sintética.

## Objetivos de servicio propuestos y medición

Para T3 local se mide sin prometer disponibilidad mientras el equipo duerme. Para público, propuesta para validar en T7-05: disponibilidad mensual 99,5% en API de juego autoritativa; p95 lectura <500 ms y commit sin IA <1 s en perfil de carga documentado. Interpretación: p95 <15 s y deadline duro inicial 30 s a calibrar por proveedor; fallback factual después de commit no hace fallar disponibilidad del juego. No son mediciones actuales ni autorización de lanzamiento.

Disponibilidad = solicitudes elegibles correctas / solicitudes elegibles. Elegibles: peticiones válidas autenticadas sobre recursos propios; excluir errores de usuario esperados, probes y pruebas internas etiquetadas. Contar 5xx, timeouts y 429 por falta de capacidad global como fallos; cuotas contractuales del usuario se reportan aparte. Caída completa sin tráfico se detecta con sonda sintética; no presentar denominador cero como 100%. Registrar exclusiones y mantenimiento, sin quitarlos silenciosamente del informe.

Sonda básica usa cuenta y caso sintéticos, aislados de carrera real y sin llamada IA de pago. Comprueba leer y confirmar una acción controlada y verificar su durabilidad; health 200 solo prueba proceso. Ejecutar sonda de proveedor real por separado únicamente con presupuesto y configuración autorizados. Medir experiencia completa en T3-05; mocks no prueban calidad/latencia de proveedor.

## Alertas accionables y paneles

Umbrales iniciales propuestos; T7-05 valida carga, ruido y canal. Cada alerta incluye severidad, entorno, inicio, ventana, impacto, enlace a procedimiento, correlación segura y responsable operativo. Agrupar por incidente, deduplicar y enviar recuperación. Mantenimiento tiene duración máxima y deja auditoría. No enviar mensajes externos durante esta tarea documental.

| Condición | Nivel / ventana propuesta | Acción inicial |
|---|---|---|
| Readiness falla 3 sondas consecutivas en 1 min | Crítico | Detener admisión, comprobar DB/esquema/espacio |
| Error elegible >5% con al menos 20 solicitudes en 5 min | Alto | Separar API/DB/proveedor; revisar última versión |
| No tráfico y sonda funcional falla | Alto, 3 intentos acotados | Detectar caída de proxy/DNS/servicio |
| Integridad de snapshot o duplicación oficial detectada | Crítico inmediato | Aislar escritura afectada, preservar evidencia; no reparar silenciosamente |
| Reserva >80% del presupuesto global | Aviso; corte al límite | Detener admisión al límite, conciliar desconocidos |
| Job más viejo supera deadline de job | Alto | Inspeccionar lease y checkpoint; no reiniciar todos los jobs |
| Backup supera 24 h o falla verificación | Alto | Mantener copia anterior, corregir y ensayar lectura |
| Espacio libre <15% / <5% | Aviso / crítico | Limpiar solo datos caducados autorizados; proteger DB |
| Exportador caído o buffer pierde eventos | Aviso tras 5 min | Usar diagnóstico local acotado; restaurar visibilidad |
| Fallo de acceso/recuperación aumenta | Aviso agregado | Revisar abuso sin registrar secretos ni enumerar cuentas |

Panel de servicio: disponibilidad, latencias, capacidad y versión. Panel de IA: llamadas, fallback, rechazos, consumo observado/estimado/desconocido. Panel de persistencia: locks, operaciones inciertas, conflictos, backup/restore. Panel de jobs desde fase 4: espera, etapa, recuperaciones y cancelaciones. No mostrar prosa/solución en paneles. Exportación remota es opt-in en instalación propia; salida estructurada local y rotación bastan inicialmente.

## Residencia y movimientos de datos

| Clase | Origen / residencia prevista | Puede salir a | Exclusión obligatoria |
|---|---|---|---|
| Identidad y sesión | DB de instalación | Correo configurado solo para función requerida | No prompts, exportación de casos ni métricas |
| Expediente y solución | DB/archivos privados y backup | Generación/revisión autorizadas; exportación explícita del expediente | No DTO normal, logs, assets web ni narración local completa |
| Partida, guardado y memoria | DB privada y backup | Contexto mínimo autorizado del proveedor seleccionado | No cuenta ajena ni prosa de rama abandonada |
| Clave personal | Backend cifrado; custodia maestra separada | Autenticación del destino elegido | No frontend de lectura, logs, prompts o exportación de cuenta en claro |
| Consumo y reservas | Ledger de instalación | Agregados operativos opcionales | No información de pago inventada; sin claves |
| Logs/métricas/trazas | Local por defecto | Collector habilitado por operador | No texto privado, solución o identificadores de alta cardinalidad |
| Preferencias y borrador UI | Cuenta; borrador volátil navegador | Backend si la función lo exige | No secretos en almacenamiento persistente del navegador |

Casa con endpoint local no garantiza ausencia de egreso: catálogo/configuración deben identificar destino efectivo de cada función. Trabajo/VPS pueden enviar texto de juego a un tercero. No afirmar país, región, retención, entrenamiento o subprocesadores de FreeLLMAPI u otro proveedor sin evidencia de sus condiciones y configuración. Cambiar proveedor exige actualizar información de destino antes de nuevos envíos; no cambiar de clave/conexión silenciosamente.

Ficha obligatoria antes de habilitar conexión pública: operador, servicio, adaptador, funciones, categorías transmitidas, región declarada y evidencia o desconocida, retención declarada o desconocida, política de uso de datos, fecha de revisión, límites, contacto de incidentes y restricciones de salida. Un campo desconocido queda visible como bloqueo de revisión de privacidad, no se rellena por inferencia. T7-06 cierra la ficha con fuentes verificadas; este documento no es asesoramiento legal.

## Retención, exportación y borrado

Propuesta técnica para revisión antes de público: logs operativos 14 días, trazas 7 días, métricas agregadas 30 días, backups 30 días. Auditoría de seguridad/consumo requiere plazo explícito justificado en T7-06; no adoptar automáticamente esos 30 días. Manuales no caducan silenciosamente por esta propuesta. Retención de partidas/conversaciones se decide junto con cuenta y borrado; no borrar por inactividad sin regla de producto aprobada.

Borrado de cuenta: verificar identidad → marcar deleting y revocar sesiones → impedir nuevas llamadas/jobs → cancelar pendientes → eliminar credenciales activas → borrar/anonimizar relaciones según política → emitir recibo sin datos privados. Una respuesta tardía no recrea conversación, cuenta ni reserva activa. Exportación toma un corte consistente y excluye claves, tokens, secretos de otras cuentas y solución no solicitada; descarga autenticada con caducidad y nueva autorización al servir.

Backups inmutables pueden retener datos hasta expirar; informar esa ventana. Mantener registro mínimo de supresiones protegido y aplicarlo antes de reabrir una restauración para no resucitar cuentas, claves o consentimientos revocados. Una copia restaurada no vuelve a enviar correo ni llama a IA automáticamente. Rotar clave maestra requiere keyVersion, lectura de versiones previas durante transición, recifrado verificable y prueba de backup recuperable antes de retirar una clave. Pérdida de clave no se arregla regenerándola: marcar conexiones inaccesibles, conservar partidas y solicitar nueva credencial.

## Verificación requerida

Inyectar cadenas centinela sintéticas en cookie, clave, prompt, solución, nombre, error de proveedor y SQL; inspeccionar todos los sumideros y respuestas. Ensayar caída de collector, volumen de logs, cardinalidad maliciosa, timezone distinto, reset de contadores y dos cuentas. Medir recepción y resolución de una alerta en entorno configurado; un log que dice «alerta enviada» no prueba entrega. Registrar por separado tests unitarios, PostgreSQL real, transporte sintético, revisión manual y proveedor real. Catálogo y tareas enlazados al inicio.
