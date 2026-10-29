# T2: cierre individual con confirmación separada v14

Fecha: 2026-10-29. Continuación de T2-05 y coherencia con SPEC-001, SPEC-002, API-juego, ADR-007 y SPEC-012. Sin commits, merges, push ni despliegue.

## Defecto corregido

El lote exigía params vacío para finish, pero el resolutor individual aceptaba confirmed=true dentro de params y cerraba desde resolveAction. Eso confundía datos de una acción con la aceptación explícita del jugador y contradecía el contrato público previsto. ConfirmAction tampoco cerraba finish con params vacío porque delegaba en el mismo resolutor.

## Comportamiento

finish admite exclusivamente un objeto params vacío. resolveAction devuelve confirmation_required con estimación cero y hora actual, sin informe, eventos, cambios de reloj o revisión. confirmed, result, ownerId y cualquier otro campo se rechazan como parámetros inválidos tanto al consultar como al confirmar; no se eliminan silenciosamente ni se copian al mensaje de error.

confirmAction valida ese mismo objeto vacío y ejecuta el cierre sobre el estado recibido. Usa buildFinalReport como antes; no inventa objetivos, altera costes o decide culpa nueva. Produce el evento finish, incrementa revisión y ordinal mediante la frontera existente y mantiene el minuto. Un segundo intento después del cierre se rechaza sin eventos. Un lote pendiente conserva su bloqueo y una partida de motor anterior no se reinterpreta.

El ejecutor de lotes llama al mismo cierre de dominio para un paso ya validado. Deja de fabricar confirmed=true internamente. El preview de un lote con cierre sigue sin entregar informe prospectivo y exige confirmación aunque no consuma minutos; confirmar el lote termina la secuencia al cerrar. No se implementa aquí el token de preview HTTP, que sigue siendo responsabilidad pendiente de la API.

## Versionado y persistencia

Motor v14, validador 1.5.0, esquema 1 y engineCompatibility=1. Fixture, seed y hash originales sin cambios. GET inicial conserva lectura sin escritura de inicios v1–v13, con la igualdad completa de forma histórica que ya existía. Progreso anterior incompatible sigue preservado/rechazado, sin migración automática. La integración HTTP amplía su recorrido histórico para incluir el inicio v13.

No se habilita cierre HTTP, carrera o primer resultado oficial en DB. No se cambia almacenamiento de sesiones, secretos, permisos, proveedor IA o frontend.

## Pruebas

Siete escenarios nuevos: preview sin efectos, confirmación única sin coste, cuatro intentos de inyectar campos de control y preservación de estado v13 rechazado por ejecución. Se mantienen las comprobaciones de lotes, rutas A/B, resultados parcial/error/vencimiento y plazos exactos.

Las pruebas históricas que cerraban mediante confirmed=true ahora usan params vacío y confirmAction, o el driver de escenario que ya confirmaba explícitamente previews. Nueve escenarios de event-clock-regressions fallaron inicialmente por conservar el helper que excluye finish de su confirmación automática; se corrigieron sus llamadas de cierre a confirmAction manteniendo las aserciones. No se cambió el driver para aceptar cierres inadvertidos ni se eliminaron escenarios.

## Límites

T2-05 continúa en curso por aceptación y reglas generales; T2 mantiene política NPC, DSL y solvencia pendientes. T3 conserva acciones, proyección de progreso y guardados pendientes. La validación cerrada de finish no acredita validación uniforme de todas las acciones internas. La autorización, rama/revisión HTTP e idempotencia deben implementarse antes de exponer el cierre a red. Siguen ocho incidencias históricas de formato y no se declara cumplimiento OWASP/ASVS.


## Verificación ejecutada

- Suite general: 603 pruebas en 40 archivos; siete escenarios nuevos del cierre individual y rutas/lotes anteriores conservados.
- Integración PostgreSQL/HTTP: 60 pruebas en seis archivos; inicio v13 añadido al recorrido histórico. La primera ejecución detectó una aserción de versión actual todavía fijada en 13; se actualizó a 14 antes de repetir, manteniendo las comprobaciones de no reescritura.
- Lint/imports: correctos, 172 módulos y 494 relaciones; tipos y compilación correctos.
- Smoke web/proxy/API con HTTP loopback y escaneo local de secretos correctos. No proveedor real o llamadas IA externas.
- Integridad documental: 99 Markdown, referencias válidas, grafo acíclico y hashes de los Word originales intactos. No demuestra controles del producto.
- git diff --check correcto. check:format sigue señalando los mismos ocho archivos históricos; no se considera superado.

Solo se utilizó la base sintética de 15434 y se conserva su volumen. No se alteran credenciales, base de 15433, originales o WSL. No se realizaron cambios visuales ni se atribuye una nueva prueba manual de navegador a esta entrega.
