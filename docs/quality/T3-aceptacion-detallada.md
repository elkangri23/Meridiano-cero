# T3: escenarios de aceptación detallados

Revisión: 2026-10-28. Especificación de pruebas a implementar; no informe de ejecución. Desglosa los 40 escenarios ACC existentes, sin inflar su número ni declarar que estén cubiertos. Trazabilidad: SPEC-001/002/004/005/006/008/011; T3-01/T3-02/T3-03/T3-04/T3-05; carrera completa T5-04 y proveedores públicos T7-01/T7-02/T7-03.

Referencias: [API](../specs/API-juego.md), [guardados](../specs/GUARDADOS.md), [conversaciones](../specs/CONVERSACIONES.md) y [proveedores](../specs/IA-proveedores.md).

## Preparación y evidencia

Datos sintéticos: usuarios A/B, partidas distintas, un fixture validado, un hecho oculto centinela y proveedores dobles configurable/sin red externa. PostgreSQL de pruebas aislado con migración aplicada; nunca DB o volúmenes personales. Un servidor HTTP sintético no se presenta como proveedor real.

Cada escenario registra revisión de código, entorno/runtime, precondición, operación, esperado/observado, comando, estado (no ejecutado/correcto/fallido/bloqueado) y enlace a evidencia sin secretos. Los IDs locales de esta tabla identifican subcasos, no nuevos ACC.

La suite actual de 146 pruebas y los 17 escenarios mock se mantienen como evidencia del código anterior. Estas tablas incluyen contratos aún no implementados; hasta mapear un test y ejecutarlo, el escenario sigue no ejecutado. No deducir cobertura por similitud de nombres.

## API, autorización y ejecución

| Subcaso / ACC | Precondición y acción | Resultado comprobable | Tipo |
|---|---|---|---|
| API-01 / ACC-020 | Llamar a recurso de juego sin sesión | 401, sin crear identidad ni llamar a IA | HTTP |
| API-02 / ACC-015 | B intenta leer/mutar/consultar operaciones o saves de A | 404 uniforme; estado A idéntico | HTTP+DB |
| API-03 / ACC-020 | Mutación con cookie válida y CSRF/Origin incorrecto | 403; cero writes y llamadas IA | HTTP+DB |
| API-04 / ACC-021 | Campos extra ownerId, clock, role o solution | 400 sin eco de valores ni cambio de permisos | HTTP |
| API-05 / ACC-015 | Añadir centinelas en definición, payload y nombres ocultos | Ausentes de DTO, errores, atlas, alt, bundle y logs | Seguridad |
| API-06 / ACC-013 | Repetir commit idéntico tras perder respuesta | Misma operación/efectos; reloj y recompensa no se repiten | HTTP+DB |
| API-07 / ACC-013 | Misma clave con texto/token/cuerpo distinto | 409 IDEMPOTENCY_CONFLICT | HTTP+DB |
| API-08 / ACC-013 | Reintento idéntico con expectedVersion/token ya viejos | Recupera resultado antes de comprobar caducidad/revisión | HTTP+DB |
| API-09 / ACC-013 | Dos pestañas confirman una revisión | Solo una nueva transición; otra 409 | Concurrencia DB |
| API-10 / ACC-018 | Fallo antes del commit | Estado, token y log sin medio resultado | Fault injection DB |
| API-11 / ACC-018 | Fallo después del commit y antes de responder | Operación recuperable; no rollback ni doble acción | Fault injection HTTP/DB |
| API-12 / ACC-016 | Texto con parte clara y referente ambiguo | clarification sin token ejecutable ni efectos parciales | Servicio+HTTP |
| API-13 / ACC-011 | Lote de nueve pasos | Rechazo/pedir dividir; cero pasos aplicados | Servicio+HTTP |
| API-14 / ACC-011 | Paso imposible en lote confirmado | Solo previos persistidos; pausa y omitidos sin coste | Motor+DB |
| API-15 / ACC-011 | Cancelar/reanudar lote tras reinicio | Cursor estable, preview nuevo, sin duplicados | Integración |
| API-16 / ACC-007 | Acción alcanza el minuto exacto del plazo | Cierre domina; no efecto ni solicitud al empate | Motor+DB |
| API-17 / ACC-018 | Proveedor caído antes de interpretación | Error operativo sin plan; dossier sigue consultable | HTTP+doble |
| API-18 / ACC-018 | Narración falla tras confirmar acción | 200 de operación confirmada y hechos públicos completos | HTTP+doble |
| API-19 / ACC-013 | Consultar/reintentar operación de rama abandonada | replay histórico marcado; no aplicar a la rama actual | HTTP+DB |
| API-20 / ACC-024 | Excepción de DB/proveedor con secreto centinela | Error y logs redactados; requestId propio | Seguridad |

## Guardados, ramas y carrera

| Subcaso / ACC | Precondición y acción | Resultado comprobable | Tipo |
|---|---|---|---|
| SAVE-01 / ACC-014 | Confirmar acción y reiniciar API | Autoguardado contiene transición íntegra y mismo reloj | DB real |
| SAVE-02 / ACC-014 | Crear manual con pendientes/memoria/lote pausado | Snapshot coherente; sin coste temporal ni ejecución de IA | Integración |
| SAVE-03 / ACC-014 | Esperar tiempo real y cargar al minuto 40 con gestión para 100 | Sigue pendiente hasta minuto 100 de juego | Motor+DB |
| SAVE-04 / ACC-014 | Crear diez manuales y pedir el undécimo | SAVE_LIMIT_REACHED; todos los anteriores intactos | HTTP+DB |
| SAVE-05 / ACC-013 | Dos creaciones compiten por la décima plaza | Solo una plaza nueva; nunca once | Concurrencia DB |
| SAVE-06 / ACC-014 | Reemplazar save seleccionado y simular error SQL | Se conserva anterior; no otro save parcial | Fault injection DB |
| SAVE-07 / ACC-013 | Reintentar creación/carga tras timeout | Mismo save/branch/operación, no duplicados | HTTP+DB |
| SAVE-08 / ACC-014 | Cargar snapshot antiguo con revisión pequeña | Estado narrativo antiguo, revisión HTTP nueva y branchId nuevo | Integración |
| SAVE-09 / ACC-015 | Intentar cargar save de otro run/usuario | 404, sin diferencias que revelen existencia | Seguridad |
| SAVE-10 / ACC-017 | Manipular hash, esquema o engineVersion | SAVE_INCOMPATIBLE; partida actual intacta | Esquema+DB |
| SAVE-11 / ACC-013 | Carga y acción de otra pestaña compiten | Orden serializable; solo una cumple versión | Concurrencia DB |
| SAVE-12 / ACC-018 | Llega respuesta IA de rama anterior | No cambia memoria, dossier ni conversación actuales | Servicio+DB |
| SAVE-13 / ACC-030 | Primer cierre incorrecto, cargar anterior y ganar | Oficial incorrecto; éxito posterior práctica sin recompensas | Motor+DB |
| SAVE-14 / ACC-030 | Primer cierre exitoso y repetición errónea | Carrera/reputación oficiales no empeoran de nuevo | Motor+DB |
| SAVE-15 / ACC-030 | Dos partidas del mismo contenido cierran simultáneamente | Un resultado oficial; otro de práctica | Concurrencia DB |
| SAVE-16 / ACC-030 | Duplicar ID de caso con mismo contenido y repetir | No elude la identidad canónica ni gana otra recompensa | Esquema+DB |
| SAVE-17 / ACC-014 | Borrar todos los manuales | Autoguardado actual sigue disponible | HTTP+DB |
| SAVE-18 / ACC-037 | Cargar manual activo de un caso ya cerrado | Rama activa de práctica, definición/hash intactos | Integración |

## Conversación y proveedores

| Subcaso / ACC | Precondición y acción | Resultado comprobable | Tipo |
|---|---|---|---|
| NPC-01 / ACC-005 | NPC conoce un secreto, pero regla impide revelarlo | No aparece en contexto ni respuesta ni memoria nueva | Servicio+doble adversarial |
| NPC-02 / ACC-005 | NPC no conoce hecho de otro personaje | No lo deduce de la solución o historial ajeno | Servicio+doble |
| NPC-03 / ACC-016 | Modelo devuelve hecho oculto, prosa extra o acto desconocido | Salida rechazada; respaldo permitido sin prueba nueva | Servicio |
| NPC-04 / ACC-005 | Solo se permite silencio y el modelo falla | Silencio autorizado; no afirmación/negativa inventada | Servicio |
| NPC-05 / ACC-014 | Persistir, reiniciar y referirse al turno previo | Misma memoria/relación y referencia coherente | DB+modelo real |
| NPC-06 / ACC-016 | Referente ambiguo o petición de acusación no sustentada | Aclaración sin pistas, cambios ni acciones parciales | Modelo real+HTTP |
| NPC-07 / ACC-005 | Presión confirmada con regla explícita | Efecto del motor una vez; alternativa viable conservada | Motor+simulación |
| NPC-08 / ACC-005 | Cobertura improvisada sin regla aplicable | No crea permisos, identidades, documentos o hechos | Servicio+modelo real |
| NPC-09 / ACC-018 | Cancelación y respuesta/error tardío coinciden | Sin turno ni memoria nueva antes del commit | Servicio+HTTP |
| NPC-10 / ACC-014 | Cargar anterior y preguntar por la rama abandonada | No mezcla conocimientos/memoria posteriores | Servicio+DB |
| NPC-11 / ACC-016 | Proveedor intenta cambiar treatment, usar herramientas o atribuir culpa | No modifica motor, relaciones ni autoridad | Servicio+doble |
| NPC-12 / ACC-038 | Modelo devuelve solo aclaraciones o todas las llamadas fallan | Evaluación falla aunque haya fallback seguro | Evaluador |
| AI-01 / ACC-032 | Casa con Ollama y trabajo con otro adaptador probado | Mismo contrato de dominio, sin cambios al motor | Contrato+proveedor real |
| AI-02 / ACC-033 | Usuario VPS no aporta claves | Selecciona conexión común autorizada | HTTP+doble |
| AI-03 / ACC-015 | Dos cuentas configuran claves personales | No pueden leer/usar/borrar conexión ajena | HTTP+DB |
| AI-04 / ACC-027 | Clave personal falla o agota cuota | No invoca conexión común ni otra clave automáticamente | Servicio+doble |
| AI-05 / ACC-022 | Usuario público remite URL privada/redirect/DNS cambiante | Rechazo antes de destino no autorizado | Seguridad de red aislada |
| AI-06 / ACC-024 | Crear/cambiar/borrar claves y exportar caso | Claves ausentes de DTO de lectura/logs/prompt/export | Seguridad |
| AI-07 / ACC-027 | Conexión personal tiene clave válida, pero VPS supera concurrencia | Sigue rechazando por recursos del servicio | Integración |
| AI-08 / ACC-038 | Cambiar modelo entre turnos con mismo caso | Definición/hash intactos; corpus real revalidado | Proveedor real |

## UI, accesibilidad y demostración

| Subcaso / ACC | Procedimiento | Resultado comprobable | Tipo |
|---|---|---|---|
| UI-01 / ACC-019 | Abrir/mover/minimizar/restaurar ventanas con teclado | Ninguna queda inaccesible; foco estable y acción alternativa al arrastre | Manual+E2E |
| UI-02 / ACC-019 | Móvil, zoom y fuente ampliada | Paneles adaptados, reloj/orden accesibles, sin controles fuera de alcance | Manual+E2E |
| UI-03 / ACC-019 | Cerrar diálogo, cancelar y recuperar conexión | Foco vuelve al origen y borrador seguro no se pierde | Manual+E2E |
| UI-04 / ACC-003 | Inspeccionar arte y equivalentes textuales | Pixel art/MS-DOS y descripción sin píxeles minúsculos ni spoilers | Revisión humana |
| UI-05 / ACC-014 | Fallo al guardar/cargar | No anuncia éxito; presenta reintento/revisión segura | E2E |
| UI-06 / ACC-030 | Volver a un save tras primer cierre | Se distingue práctica de resultado oficial | E2E |
| UI-07 / ACC-006 | Navegar atlas/dossier/ventanas o dejar abierto | No avanza el reloj | E2E |
| E2E-01 / ACC-008 | Ruta A sin evidencias exclusivas B | Cierre completo y costes de SPEC-003, con guardado/reanudación | E2E+modelo real |
| E2E-02 / ACC-009 | Ruta B sin evidencias exclusivas A | Misma solvencia independiente; sin pistas automáticas | E2E+modelo real |
| E2E-03 / ACC-012 | Error, parcial y vencimiento | Informes correctos sin alterar primer resultado previo | E2E |

Los casos de proveedor público se ejecutan en su fase T7; no bloquean crear mocks o el primer caso privado por falta de claves reales. UI móvil completa, lector de pantalla y evaluación de modelos no se sustituyen por un DOM snapshot ni por HTTP 200.

## Puertas para implementar y aceptar

T3-01 puede cerrar contratos de DTO, guardado y diálogo una vez revisadas sus discrepancias; mantiene aparte evaluación real y wireframes. T3-02 requiere API/SAVE y seguridad aplicables con DB real. T3-03 requiere UI y flujo conectado, incluidas ventanas desde el primer caso. T3-04 requiere NPC/AI aplicables y un proveedor real disponible. T3-05 demuestra ambas rutas y recuperación en navegador.

El registro de ejecución señalará exactamente qué subcasos se cubren y qué ACC compuestos siguen parciales. No se marca un ACC completo por ejecutar solo una fila. Ni esta ampliación documental ni el verificador de enlaces cierran esas tareas.
