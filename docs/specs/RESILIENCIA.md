# Resiliencia: consistencia, degradación y recuperación

Fecha: 2026-10-28. Anexo normativo propuesto de SPEC-004/005/007/009/010/011. Desarrolla contratos existentes; no cambia DEC-013 a DEC-021 ni acredita implementación. Responsables y dependencias en [backlog](../plan/BACKLOG.md); escenarios en [catálogo de bordes](../quality/BORDES-EJECUCION.md). Las cifras operativas de este documento son propuestas que deben medirse antes de cerrar sus tareas.

## Invariantes que deben sobrevivir a cualquier fallo

1. Un éxito de escritura implica commit durable del agregado, operación, eventos y primer resultado cuando aplique. La prosa nunca es condición del commit.
2. Un error de red no prueba ni éxito ni rollback. Mientras el resultado sea incierto, no crear una intención sustituta ni mostrar «no se guardó» como hecho.
3. Cada intención conserva su clave y digest. La deduplicación protege efectos locales; no promete que un proveedor externo facture una sola vez.
4. Tiempo de juego, hora operativa y duración monotónica son dominios distintos. Suspender el equipo no consume minutos del caso.
5. La restauración de un manual cambia rama y aumenta revisión, pero no rebobina consumo, identidad, auditoría ni resultado oficial.
6. Autenticación, autorización, validación y límites fallan cerrados. Una dependencia caída no concede permisos ni justifica entregar datos privados.
7. Toda cola, espera, cuerpo, respuesta externa, lote, contexto y retención tiene límite. Alcanzarlo debe dejar un resultado explícito y recuperable.

## Matriz de disponibilidad por capacidad

| Fallo | Sigue disponible | Se bloquea / respuesta | Recuperación |
|---|---|---|---|
| Interpretador IA caído | Lectura, manuales y acciones estructuradas que ya ofrezca la UI | Texto que necesite interpretación: AI_UNAVAILABLE; sin efectos | Reintento explícito o controles existentes; no inventar botones ni acciones sugeridas |
| Narrador caído después de commit | Resultado factual, dossier, guardado y continuación | Solo enriquecimiento de prosa | No reenviar acción; estado factual válido |
| DB inaccesible | Interfaz y vista previa ya cargada, marcada desactualizada | Nuevas lecturas autoritativas y escrituras; 503 | Recuperar operación original y refrescar; no cola offline |
| Esquema incompatible | Health mínimo y diagnóstico administrativo | Readiness y juego | Migración revisada o restauración compatible |
| Worker detenido | Casos validados y juego existente | Nuevas generaciones si no hay capacidad; jobs ya aceptados permanecen durables | Recuperar leases/checkpoints, sin publicar borradores |
| Cuota IA agotada | Lecturas y capacidades sin IA | Nuevas llamadas de esa conexión/función | Informar alcance y reset conocido; no fallback de credencial |
| Telemetría externa caída | Juego mientras la persistencia de dominio funcione | Exportación de telemetría se degrada con buffer acotado | Contador de descartes y alerta local; no bloquear DB esperando collector |
| Disco lleno / DB solo lectura | Lecturas si DB lo permite | Mutaciones; no afirmar autoguardado | Liberación controlada, validación de integridad y nueva readiness |
| Sesión caducada | Pantalla de autenticación; sin nueva información privada | Toda operación protegida | Misma cuenta recupera operación; otra cuenta limpia la vista anterior |

No convertir indisponibilidad en una consecuencia narrativa o una pista. Un fallo global debe explicarse una vez en una zona accesible, sin inundar cada ventana con avisos.

## Escrituras y resultado incierto

Aplicar el orden transaccional de [API-juego](API-juego.md). La API calcula fuera del bloqueo lo que no requiera estado exclusivo; dentro revalida revisión, rama y precondiciones. No llamar IA mientras mantiene locks. Un reintento SQL vuelve a leer el agregado y no reutiliza un resultado calculado sobre estado viejo.

| Punto de interrupción | Estado que puede existir | Procedimiento |
|---|---|---|
| Antes de aceptar petición | Ningún efecto o petición en tránsito | Reenviar exactamente misma intención/clave |
| Antes del commit | Rollback posible; resultado todavía desconocido para cliente | Mismo procedimiento, no inferir por timeout |
| COMMIT enviado, conexión perdida | Commit durable o rollback; cliente no sabe cuál | Reconectar y resolver la misma clave en DB; no ejecutar una nueva intención |
| Commit durable, respuesta perdida | Operación registrada | Replay de respuesta histórica; refrescar vista actual |
| Respuesta llega después de otra rama/revisión | Resultado válido pero antiguo | Mostrar estado de operación; no sobrescribir estado actual |
| Prosa llega después de logout/carga/borrado | Resultado externo no autorizado para vista actual | Descartar incorporación; reconciliar consumo aparte |

La UI conserva durante una petición pendiente su clave, ruta y cuerpo validado, ligados a cuenta/instalación. No persistir tokens de confirmación, CSRF, texto privado o credenciales en localStorage. Si se quiere recuperación tras recarga sin conservar cuerpo sensible, implementar consulta autenticada por clave y ámbito, con un localizador opaco mínimo en sessionStorage y limpieza al salir. Esta ampliación requiere contrato y pruebas en T3-06: GET por operationId no sirve cuando la respuesta que traía ese ID se perdió. «No encontrada» tampoco autoriza una clave nueva mientras la petición original pueda seguir en vuelo.

Retener deduplicación durante la vida recuperable de la partida, incluso tras cierre/carga. Si se compactan respuestas históricas, conservar un tombstone con ámbito, clave, digest y resultado de resolución; nunca reciclar la clave como nueva. Borrado de cuenta debe eliminar o anonimizar lo que corresponda según política explícita; no usar retención infinita encubierta. Cerrar política antes de purgar operaciones. Un retry histórico sigue requiriendo permisos actuales y no entrega informes secretos de una rama cerrada a la rama activa: devuelve metadatos de operación y una proyección autorizada bajo el estado actual. Concretar esta restricción en API-juego antes de implementarla.

## Presupuestos temporales y reintentos

Cada petición propaga un deadline restante y AbortSignal a transporte y validadores. El reloj monotónico mide duración dentro de proceso; timestamps UTC de DB gobiernan expiraciones persistidas. Fijar timeout de adquisición de conexión, statement, lock, transporte y cierre. El timeout HTTP debe dejar margen para resolver/registrar resultado; un Promise.race no cancela por sí solo el trabajo perdedor.

| Operación | Política propuesta | No reintentar automáticamente |
|---|---|---|
| GET autoritativo | Hasta 2 reintentos con jitter y deadline total | 401/403/404 o incompatibilidad |
| Escritura de juego | Recuperar misma clave; UI indica resultado incierto | Con nueva clave, payload modificado o ante conflicto de revisión |
| Transacción abortada por conflicto serializable/deadlock | Hasta 2 reejecuciones locales desde estado releído | Errores de integridad, esquema o commit ambiguo |
| IA de interpretación | Como máximo 1 recuperación de transporte si no hay salida usable y queda presupuesto | Credencial inválida, salida semántica inválida reiterada, coste desconocido sin reserva |
| Narración | Fallback factual inmediato tras presupuesto; no bucle para mejorar estilo | No repetir motor |
| Generación | Límites globales por job y por etapa de SPEC-007; cada intento consume del mismo presupuesto | No multiplicar reintentos de SDK, adaptador y worker |

Un único nivel posee la política de retry por llamada. Retry-After se acota al deadline y se presenta al usuario; no mantener un hilo durmiendo indefinidamente. Un 429 no equivale siempre a proveedor caído: separar cuota propia, cuota de cuenta externa y saturación global.

Circuit breaker propuesto por conexión y función, sin mezclar claves de distintos usuarios: abrir tras 5 fallos transitorios consecutivos, esperar 30 s, permitir una sonda, cerrar tras éxito validado. Medir estos valores en T3-08/T7-05. Errores de validación del usuario no alimentan el breaker. Limitar el número de breakers y eliminar entradas inactivas. Una clave revocada se deshabilita explícitamente; no se sonda indefinidamente. No instalar Redis para compartir breakers: coordinación mínima con componentes existentes y límites globales persistidos cuando haya varias réplicas.

## Saturación y aislamiento

Admisión antes de reservar recursos caros: tamaños → autenticación → permiso → límite por usuario/función → presupuesto → concurrencia → llamada. Reservas y publicación del job son atómicas. Separar cupos de interpretación interactiva y generación para que un job no monopolice la instalación. Claves personales siguen sujetas a límites de CPU/memoria/concurrencia del servicio.

Colas finitas por usuario y global; al llenarse, rechazo explícito sin promesa de ejecución. El scheduling debe impedir hambre de una cuenta sin permitir que crear muchas cuentas burle el límite global. T4-07 medirá espera máxima y política de equidad. Exportación grande, validación/importación y simulación tienen presupuesto propio; no deben bloquear el event loop de lectura de partidas. En T3 no se exige worker vacío: limitar tamaños y medir primero.

Consumo externo desconocido conserva reserva conservadora hasta reconciliación o política de vencimiento documentada. Un timeout no libera automáticamente todo el presupuesto ni registra cero tokens. Uso estimado/observado/desconocido y ajuste posterior son registros diferentes y auditables. El corte global se verifica justo antes de enviar cada llamada, incluidas recuperaciones; no solo al crear el job.

## Worker: lease no equivale a exclusividad eterna

Cada reclamo incrementa un fencing token persistido. Checkpoint, heartbeat, publicación y cambio terminal hacen compare-and-set de job, estado y token. Un worker A cuyo lease venció no puede publicar aunque termine después de que B haya recuperado. El heartbeat usa hora DB; salto de reloj local no otorga propiedad.

Checkpoint contiene versión de pipeline, hash de entrada, etapa validada, salida privada, intentos, reserva y conexión seleccionada. Recuperar solo si todos son compatibles; si no, detener con diagnóstico conservando artefactos. No reutilizar borradores de otro usuario o conexión. succeeded/failed/cancelled son terminales; una nueva generación es otra intención explícita.

Cancelación y publicación compiten en una transacción: si cancelación se confirma primero, jamás publicar; si publicación ya se confirmó, responder «ya finalizado» y no fingir cancelación. Las llamadas externas ya enviadas pueden terminar y consumir, pero no rescatan el job cancelado. Limpiar reservas huérfanas mediante reconciliación idempotente; no por borrado ciego de filas antiguas.

## Arranque, parada y actualización

Arranque valida configuración, versiones y ledger de migración antes de readiness. Health mide proceso; readiness mide capacidad real de atender tráfico. No hacer llamadas de pago a IA en cada probe. Exponer capacidades degradadas al cliente por un contrato público mínimo; no publicar URLs, credenciales ni estado interno de DB.

Parada: marcar no listo → dejar de admitir mutaciones/jobs → drenar operaciones admitidas dentro de plazo → abortar transporte externo → cerrar servidor/pool una sola vez. Señales repetidas comparten una promesa de cierre. Agotar el plazo fuerza salida y recuperación posterior de operaciones/leases, nunca inventa rollback. T3-08 fija y prueba presupuesto total de apagado frente al del supervisor.

Migración: bloqueo exclusivo, backup verificable, compatibilidad explícita API/esquema/motor/fixture, prueba de reanudación de partida antigua. No arrancar versión antigua sobre DB nueva ni desplegar mezcla incompatible. Cambio de assets web con pestaña abierta produce actualización solicitada preservando intención pendiente; no reproducir acciones automáticamente. Preferir mantenimiento breve y claro a un despliegue sin interrupción no demostrado.

## Recuperación de desastre

Autoguardado protege la transacción; backup protege pérdida de instalación. No son equivalentes. Propuesta a validar en T6-05: RPO público máximo 24 h y RTO 4 h; instalación propia los declara según sus recursos. No son SLA ni valores alcanzados. Si se exige RPO inferior se diseña copia continua/recuperación puntual antes de prometerlo.

Backup coherente de DB, definiciones, claves necesarias para descifrar credenciales (custodia separada), versiones y configuración no secreta. Cifrado, verificación de integridad, copia fuera del host y caducidad definida. No imprimir secretos al validar. Registrar instante de datos recuperables, no solo fecha del archivo.

Ensayo en destino aislado sin correo ni IA real: restaurar, validar hashes/FK/operaciones/resultados oficiales, abrir manual antiguo, repetir una clave anterior, cargar rama, reanudar job sin publicación doble y comprobar revocaciones/borrados posteriores mediante registro de supresiones. Si restauración pierde cierres posteriores al punto recuperado, comunicar pérdida y bloquear conciliación automática de carrera externa inexistente; no afirmar que esos resultados fueron preservados.

Volver a servicio requiere evidencia, nuevas sesiones cuando proceda y comprobación de corte global. Nunca restaurar encima del único volumen sano. Rollback de aplicación usa imagen/esquema compatibles; rollback de DB es restauración explícita con pérdida de datos estimada. Registrar inicio de incidente, backup seleccionado, integridad, instante de reapertura, RPO/RTO medidos y límites.
