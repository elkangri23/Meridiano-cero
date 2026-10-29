# Casos límite de ejecución y hallazgos

Fecha: 2026-10-28. Revisión estática del repositorio y contratos. No se ha ejecutado producto, proveedor, PostgreSQL ni ensayo de desastre en esta revisión. No es posible demostrar exhaustividad sobre todas las entradas y fallos físicos; este catálogo cubre fronteras, estados, concurrencia y combinaciones identificadas, con oráculos verificables.

## Evidencia y alcance de los hallazgos

| Hallazgo | Evidencia revisada | Consecuencia / tarea |
|---|---|---|
| H-01: recuperación por ID insuficiente si la respuesta se pierde | API-juego solo describe consulta por operationId y retry con cuerpo original | Concretar localizador por clave sin persistir secretos; T3-06 |
| H-02: replay histórico puede revelar informe tras cargar rama activa | API-juego devuelve resultado histórico; GUARDADOS prohíbe trasladar informe a rama activa | Reautorizar proyección histórica, sin reaplicar; T3-06 |
| H-03: observabilidad todavía no conectada | apps/api/src/app.ts usa logger:false, genera requestId y errores mínimos | Implementar eventos/medidas sanitizados, no activar logger crudo; T3-08 |
| H-04: timeout de probe no demuestra cancelación SQL | database/readiness.ts usa Promise.race y aborta delay, no la query | Acotar consulta/pool y comprobar ausencia de acumulación; T3-08 |
| H-05: apagado sin presupuesto explícito y pool cerrado en dos caminos | server.ts llama pool.end desde onClose y shutdown | Cierre idempotente y drenaje medido; T3-08 |
| H-06: contratos de juego sin persistencia consumida | createApp registra health/readiness/auth; database/schema y db/schema difieren | Consolidar esquema antes de garantías de commit; T3-02 y T3-06 |
| H-07: lease/deduplicación descritos sin fencing ni arbitraje terminal | SPEC-007 | Worker atrasado, cancelación y publicación requieren CAS; T4-07 |
| H-08: RPO/RTO, retención y alertas sin objetivos comprobados | SPEC-009/010 y manuales de operación | Propuestas medibles y ensayo aislado; T6-05/T7-05/T7-06 |
| H-09: transporte duplicado aún sin consolidar | ESTADO e IA-proveedores distinguen apps/api/src/ai y packages/ai-adapters | No extrapolar seguridad a adaptador no consumido; T3-04/T3-08 |

H-01/02/07/08 son huecos o precisiones de diseño, no vulnerabilidades explotadas. H-03/04/05/06 son observaciones estáticas del camino actual, sin afirmar incidente ocurrido. Ya estaban contemplados en general: idempotencia, diez guardados, ramas, plazo, fallback factual, cuotas y backup. La aportación es concretar sus interacciones y pruebas, no presentarlos como requisitos totalmente nuevos.

Contratos asociados: [resiliencia](../specs/RESILIENCIA.md), [observabilidad y datos](../specs/OBSERVABILIDAD-Y-DATOS.md), [API](../specs/API-juego.md), [guardados](../specs/GUARDADOS.md), [conversaciones](../specs/CONVERSACIONES.md). El [catálogo T3 previo](T3-aceptacion-detallada.md) sigue vigente.

## Cómo ejecutar el catálogo

Cada fila BOR es un escenario previsto, no un resultado aprobado. La columna «oráculo» especifica qué comprobar además del HTTP. Usar dos cuentas sintéticas A/B, dos pestañas de A, fixture validado, reloj controlado, proveedor doble y barreras de concurrencia reproducibles. Fallar exactamente antes/después de commit, envío externo, checkpoint y publicación. Guardar semilla, versión, punto de fallo y estado durable final, sin credenciales.

Tipos: U = unidad pura; I = integración con PostgreSQL real/procesos; E = E2E navegador; M = comprobación manual; O = ensayo operativo aislado. Una prueba U de un mock SQL no sustituye I. La columna responsable enlaza la tarea que debe aportar evidencia. Prioridad P0 bloquea el hito afectado por integridad/privacidad; P1 bloquea su aceptación funcional; P2 requiere cierre operativo antes del despliegue correspondiente. No todas bloquean el primer caso.

## Entrada, sesión y API

| ID | P | Disparador | Oráculo y recuperación | Tipo / tarea |
|---|---|---|---|---|
| BOR-001 | P1 | JSON truncado, inválido o campos extra | 400 sin transición ni llamada IA | I / T3-06 |
| BOR-002 | P1 | Cuerpo multibyte al límite y un byte por encima | Límite por bytes antes de parseo; 413 sin asignación desmedida | I / T3-06 |
| BOR-003 | P1 | Texto vacío, controles, Unicode combinado, emoji e IME | Validación coherente con UTF-16 del contrato; Enter durante composición no envía | U/E / T3-07 |
| BOR-004 | P0 | ID oculto, ajeno, inexistente o manipulado | Misma respuesta pública; ninguna solución en error/label | I / T3-06 |
| BOR-005 | P0 | Cookie revocada mientras petición espera | Revalidar autoridad en punto de mutación; ninguna escritura posterior autorizada por caché vieja | I / T3-06 |
| BOR-006 | P0 | Logout A, login B, respuesta tardía de A | Vista/borrador/caché de A no aparecen en B | E / T3-07 |
| BOR-007 | P0 | Origin/CSRF incorrecto, proxy falso o CORS inesperado | Rechazo antes de mutación; no bootstrap público por cabecera | I / T3-06 |
| BOR-008 | P1 | Dos POST de creación simultáneos, misma clave | Una partida y un registro; ambos resuelven mismo runId | I / T3-06 |
| BOR-009 | P1 | Misma clave con otra ruta/cuerpo/caso | Conflicto sin efectos adicionales | I / T3-06 |
| BOR-010 | P1 | Cursor antiguo, alterado o de otro filtro/usuario | Rechazo controlado o página autorizada; sin saltos de ámbito | I / T3-06 |

## Commit, reintento y concurrencia

| ID | P | Disparador | Oráculo y recuperación | Tipo / tarea |
|---|---|---|---|---|
| BOR-011 | P0 | Dos commits de misma versión con claves distintas | Solo uno aplica; otro conflicto, no doble coste | I / T3-06 |
| BOR-012 | P0 | Desconexión antes, durante y después de COMMIT | Resolver misma clave: cero o un efecto; jamás dos | I / T3-06 |
| BOR-013 | P1 | Respuesta perdida antes de conocer operationId | Localizador/retry seguro recupera resultado sin nueva intención | I/E / T3-06 |
| BOR-014 | P1 | Replay con token ya caducado | Resolver operación existente antes de caducidad; no reaplicar | I / T3-06 |
| BOR-015 | P0 | Replay de cierre después de cargar manual activo | Metadatos seguros; no informe/solución de rama anterior | I/E / T3-06 |
| BOR-016 | P1 | Respuestas HTTP llegan en orden inverso | UI conserva revisión actual, consulta servidor ante duda de rama | E / T3-07 |
| BOR-017 | P0 | Deadlock/aborto serializable al cerrar | Retry relee; estado, log y resultado oficial indivisibles | I / T3-06 |
| BOR-018 | P0 | Caída proceso tras estado pero antes de insertar log | Rollback conjunto; no estado huérfano | I / T3-06 |
| BOR-019 | P1 | Retención compacta operación y llega retry viejo | Tombstone impide ejecutarla como nueva | I / T3-06 |
| BOR-020 | P0 | Cierres de dos runs del mismo contenido | Una fila oficial por perfil/contenido; otro informe es práctica | I / T3-06 |

## Guardados, ramas y carrera

| ID | P | Disparador | Oráculo y recuperación | Tipo / tarea |
|---|---|---|---|---|
| BOR-021 | P1 | Dos manuales concurrentes cuando existen nueve | Total diez, uno rechazado; autoguardado sigue disponible | I / T3-06 |
| BOR-022 | P0 | Falla reemplazo de manual en cualquier escritura | Anterior íntegro o nuevo completo; nunca hueco | I / T3-06 |
| BOR-023 | P1 | Renombrar/borrar/reemplazar mismo save simultáneamente | Versión de metadatos resuelve conflicto; no borrar otro save | I / T3-06 |
| BOR-024 | P0 | Snapshot corrupto, hash profundo distinto o motor incompatible | Conserva partida y original; SAVE_INCOMPATIBLE sin carga parcial | U/I / T3-06 |
| BOR-025 | P0 | Cargar mientras acción o narración está en vuelo | Nueva rama/revisión; respuesta vieja no cambia memoria ni inventario | I/E / T3-06 |
| BOR-026 | P1 | Cargar con lote pausado y solicitudes pendientes | Cursor/semilla/tiempos coherentes; nuevo preview; sin llamadas externas recreadas | U/I / T3-06 |
| BOR-027 | P0 | Cargar antes/después del primer cierre incorrecto o vencido | Oficial persiste solo si ya se confirmó; éxito posterior es práctica | I / T3-06 |
| BOR-028 | P1 | Guardar cerrado, cargar cerrado, borrar último manual | No nuevo premio; estado cerrado; autoguardado no desaparece | I / T3-06 |
| BOR-029 | P0 | Reimportar contenido con otro ID para repetir premio | Identidad canónica evita duplicación; no prometer equivalencia semántica universal | I / T4-07 |
| BOR-030 | P1 | Fórmula de carrera cambia después de un cierre | Conserva versión aplicada; no recalcular premios sin migración aprobada | U/I / T5-07 |

## Motor, tiempo y semántica funcional

| ID | P | Disparador | Oráculo y recuperación | Tipo / tarea |
|---|---|---|---|---|
| BOR-031 | P1 | Acción termina deadline-1, deadline y deadline+1 | Solo primera aplica efecto terminal; empate lo gana cierre | U / T5-07 |
| BOR-032 | P1 | Varios eventos y solicitud al mismo minuto del plazo | Orden ordinal estable; no revelar evento exactamente en deadline | U / T5-07 |
| BOR-033 | P1 | Suspender PC, DST, cambio timezone/reloj de pared | Minuto del juego invariable; expiración operativa separada | U/E / T3-07 |
| BOR-034 | P1 | Costes negativos, NaN, fracción, overflow, grafo cíclico | Validador rechaza; motor no cuelga ni envuelve enteros | U / T5-07 |
| BOR-035 | P1 | Lote parcialmente ambiguo antes de confirmar | Ningún fragmento ejecutado ni cobrado | U/E / T3-07 |
| BOR-036 | P1 | Paso intermedio imposible con sucesores dependientes/independientes | Pausa durable, costes solo aplicados, decisión explícita | U/I / T5-07 |
| BOR-037 | P1 | Recoger objeto repetido, analizar mismo objeto, esperar cero | Resultado definido por expediente; no inventar multiplicación/tiempo ni bucle infinito | U / T5-07 |
| BOR-038 | P1 | Solicitud madura durante viaje retrasado | Evento ordenado antes del plazo; mismo retraso al replay | U / T5-07 |
| BOR-039 | P1 | Orden denegada, inocente detenido o recuperar sin posesión | Sin oráculo de culpa; reglas de acceso y resultado consistentes | U/E / T5-07 |
| BOR-040 | P1 | Cooperación mínima, prueba inadmisible, retirada definida | Rutas alternativas salvo pérdida legítima; sanción exige conocimiento plausible | U / T5-07 |
| BOR-041 | P1 | Cambiar ciudad y NPC, referencias «él/eso» ambiguas | Aclaración sin revelar referentes ocultos ni actuar parcialmente | U/E / T3-07 |
| BOR-042 | P1 | Dos casos activos, idioma/modo de exploración distintos | No compartir reloj, memoria, pistas ni pendientes | I/E / T5-07 |

## IA, consumo y conexiones

| ID | P | Disparador | Oráculo y recuperación | Tipo / tarea |
|---|---|---|---|---|
| BOR-043 | P1 | DNS/TLS/conexión/timeout o respuesta truncada | Código normalizado, deadline acotado, ningún efecto de interpretación | I / T3-08 |
| BOR-044 | P0 | Modelo devuelve hecho secreto, HTML o instrucción incrustada | Rechazo factual/texto seguro; nunca llega al estado ni DOM ejecutable | U/E / T3-08 |
| BOR-045 | P1 | JSON válido pero acción extra, tipos coaccionados o lote >8 | Rechazo completo sin truncar y ejecutar prefijo | U / T3-08 |
| BOR-046 | P1 | Narrador falla después del commit | Resultado factual usable y un único efecto | I/E / T3-08 |
| BOR-047 | P1 | Cancelación justo antes/después de envío externo | Corta incorporación; consumo desconocido conservado y conciliable | I / T3-08 |
| BOR-048 | P0 | Clave personal falla o conexión cambia en vuelo | No fallback a administrador; respuesta ligada a configuración capturada | I / T3-08 |
| BOR-049 | P0 | Borrar clave/cuenta con llamada pendiente | No nuevos envíos ni recreación por respuesta tardía | I / T7-06 |
| BOR-050 | P0 | DNS cambia o redirect apunta a destino prohibido | Verificar destino efectivo; ninguna petición a red no autorizada | I / T3-08 |
| BOR-051 | P1 | Contexto/salida enormes o stream nunca termina | Límites bytes/tokens/tiempo, abort y fallback; memoria acotada | I / T3-08 |
| BOR-052 | P0 | Dos reservas concurrentes rozan presupuesto | Reserva atómica; no exceder techo ni gastar reserva liberada por timeout | I / T4-07 |
| BOR-053 | P1 | SDK+adaptador+worker reintentan mismo fallo | Intentos totales bajo un presupuesto; no multiplicación exponencial | I / T3-08 |
| BOR-054 | P1 | Breaker abierto y muchas peticiones al vencer espera | Una sonda por ámbito; no tormenta ni bloqueo de otras conexiones | I / T3-08 |
| BOR-055 | P0 | Corte global activado entre etapas o retries | Cero nuevos envíos después del punto de corte confirmado | I / T7-05 |
| BOR-056 | P1 | Proveedor cambia capacidad/modelo sin cambiar nombre | Evaluación detecta incompatibilidad; no cambiar reglas ni asumir JSON seguro | I/M / T3-08 |

## Generación e intercambio

| ID | P | Disparador | Oráculo y recuperación | Tipo / tarea |
|---|---|---|---|---|
| BOR-057 | P0 | Lease A vence, B reclama y A termina tarde | Fencing impide checkpoint/publicación de A | I / T4-07 |
| BOR-058 | P0 | Cancelar y publicar simultáneamente | Un estado terminal; cancelación confirmada impide publicación | I / T4-07 |
| BOR-059 | P1 | Reinicio tras checkpoint, antes de liberar reserva | Retoma etapa compatible; concilia sin doble reserva/publicación | I / T4-07 |
| BOR-060 | P1 | Cambia pipeline/validador mientras job espera | No retomar checkpoint incompatible; fallo explícito conservando diagnóstico | I / T4-07 |
| BOR-061 | P1 | Cola llena, usuario monopoliza o no queda worker | Admisión finita y espera visible; partidas existentes siguen utilizables | I/O / T4-07 |
| BOR-062 | P0 | Importación profunda, claves duplicadas JSON o colisión de IDs | Rechazo explícito antes de persistir; parser/política de duplicados definida | U/I / T4-07 |
| BOR-063 | P0 | Archivo declara validated o incluye URL/operador ejecutable | Revalidar sin fetch/eval; no confiar en sello del archivo | U/I / T4-07 |
| BOR-064 | P1 | Dos rutas comparten única prueba frágil; ruta se rompe con retraso máximo | Validación detecta falsa independencia/insolvencia; no publicar | U / T4-07 |
| BOR-065 | P1 | Región vacía, modo Familiar incompatible o catálogo obsoleto | Pedir parámetros válidos/rechazar; no inventar ciudad/contenido | U / T4-07 |
| BOR-066 | P0 | Exportación ajena, sesión revocada o descarga interrumpida | Autorización actual y aviso de solución; sin claves/partidas ajenas | I/E / T4-07 |

## Interfaz y accesibilidad bajo fallos

| ID | P | Disparador | Oráculo y recuperación | Tipo / tarea |
|---|---|---|---|---|
| BOR-067 | P1 | Offline tras pulsar confirmar, recarga y reconexión | Estado incierto visible; sin cola de acciones ni nueva clave automática | E / T3-07 |
| BOR-068 | P1 | Doble clic/Enter sostenido, desmontaje del componente | Una intención; bloqueo accesible mientras se resuelve | E / T3-07 |
| BOR-069 | P1 | Resize/rotación/zoom 200%, ventana fuera de pantalla | Recuperar posición, consola y reloj alcanzables sin arrastre | E/M / T3-07 |
| BOR-070 | P1 | Modal falla, llega evento o se minimiza ventana con foco | Foco predecible/restaurable; avisos no secuestran teclado | E/M / T3-07 |
| BOR-071 | P1 | Preferencias inválidas o storage bloqueado/lleno | Defaults seguros sin perder estado del caso; sin CSS arbitrario | E / T3-07 |
| BOR-072 | P1 | Assets/versiones web distintas con pestaña abierta | Solicitar actualizar; recuperar operación antes de descartar contexto | E / T3-07 |
| BOR-073 | P1 | Nombre largo, texto RTL, traducción ausente, contenido hostil | Texto escapado, layout usable, fallback lingüístico sin filtrar IDs secretos | E/M / T5-07 |
| BOR-074 | P1 | TTS sigue hablando tras carga/logout; audio bloqueado | Parar cola antigua; texto equivalente disponible; no repetir spoilers | E/M / T5-07 |

## Operación, privacidad y fallos combinados

| ID | P | Disparador | Oráculo y recuperación | Tipo / tarea |
|---|---|---|---|---|
| BOR-075 | P0 | DB caída o pool saturado durante readiness repetida | 503 acotado; queries/esperas no crecen indefinidamente | I/O / T3-08 |
| BOR-076 | P1 | SIGTERM repetido durante commit y llamada IA | No admisión nueva; drenaje finito; cierre una vez; operación recuperable | I/O / T3-08 |
| BOR-077 | P0 | Disco lleno, permisos rotos o DB solo lectura | Sin falso éxito; original preservado; alerta sanitizada | O / T6-05 |
| BOR-078 | P0 | Migración parcial/checksum cambiado/app antigua | Readiness cerrada; no downgrade ciego ni reinterpretación de save | I/O / T6-05 |
| BOR-079 | P0 | Backup corrupto, incompleto o clave maestra ausente | Restauración falla aislada; instalación sana intacta; sin anunciar éxito | O / T6-05 |
| BOR-080 | P0 | Restore de copia anterior a borrado/rotación | Aplicar supresiones/revocaciones antes de red; no resucitar credenciales | O / T7-06 |
| BOR-081 | P0 | Secretos centinela en excepción, proxy, span y respuesta | Ausencia en todos los sumideros; no solo UI | I/O / T3-08 |
| BOR-082 | P1 | Collector caído o inundación de logs/labels | Buffer y cardinalidad acotados, contador de pérdidas; juego no se bloquea | I/O / T3-08 |
| BOR-083 | P2 | Alerta dispara, canal cae y luego servicio recupera | Entrega verificable, deduplicación/escalado y resolución; no falso «enviada» | O/M / T7-05 |
| BOR-084 | P2 | Cero tráfico, contadores reinician o mantenimiento silenciado | Sonda y denominadores correctos; silencio expira y queda auditado | O / T7-05 |
| BOR-085 | P0 | Restore con lease viejo y presupuesto previo | No llamadas reales automáticas; fencing/reconciliación antes de reabrir | O / T6-05 |
| BOR-086 | P0 | Borrado cuenta compite con exportar/generar/commit | Un orden durable, revocación efectiva, sin recreación por job tardío | I/O / T7-06 |
| BOR-087 | P1 | Partida enorme/historial largo y proveedor lento bajo carga | Lecturas/paginación siguen acotadas; latencia/capacidad medidas | I/O / T7-05 |
| BOR-088 | P0 | Timeout de commit + carga desde otra pestaña + retry | Un efecto original máximo; rama actual preservada y replay sin secretos | I/E / T3-06 |
| BOR-089 | P0 | Worker duplicado + corte global + respuesta tardía | Una publicación máxima, cero nuevos envíos tras corte; consumo desconocido conservado | I/O / T4-07 |
| BOR-090 | P0 | Restore + cliente antiguo + operación previamente confirmada | Invalidar sesión/preview según recuperación; no ejecutar ciegamente desde cliente viejo | O/E / T6-05 |

## Ampliación sistemática y límites

Cruzar cada mutación con: antes/después de commit, retry igual/distinto, A/B, misma/distinta rama, sesión vigente/revocada y DB disponible/caída. Cruzar cada llamada externa con: antes/después de envío, salida válida/inválida, timeout/cancelación, cambio de conexión y presupuesto. No ejecutar producto cartesiano sin propósito: cubrir pares y todas las combinaciones P0 listadas, conservar casos mínimos que reproduzcan cada fallo.

Propiedades para tests generativos: revisión nunca disminuye; minuto no disminuye dentro de rama; cargar conserva oficial; replay no cambia estado; PlayerView no contiene centinelas privados; estado/log/operación coinciden; contador de manuales <=10; suma de reservas y gasto conciliado no supera presupuesto admitido; terminal de job no retrocede. Generar únicamente datos sintéticos y semillas reproducibles. No confundir «dos rutas simuladas» con prueba de toda conversación.

Puertas: primer caso exige T3-06/07/08 y aceptación T3; generación exige T4-07; acabado exige T5-07; distribución exige T6-05; público exige T7-05/06. Un fallo P0 descubierto después bloquea el hito afectado aunque su prueba no estuviera enumerada. Evidencia por fila: versión, comando/procedimiento, tipo, resultado, estado durable observado, señal operativa y limitación. «Pendiente» es el estado inicial de las 90 filas.
