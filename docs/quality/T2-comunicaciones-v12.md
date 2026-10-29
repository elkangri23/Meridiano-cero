# T2: comunicaciones simuladas v12

Fecha: 2026-10-29. Continuación autorizada en worktree, sin commit, merge, push o despliegue. Conserva los cambios v9–v11 aún sin commit. Referencias: SPEC-001/002, API-juego, CONVERSACIONES, SPEC-012 y estándares de 7962014ec7031c3694f2378d3983a5e488499239.

## Entrega y alcance funcional

Communicate ya se admite como acción individual y paso de lote con el mismo contrato cerrado: channel, recipientId y requestText. Canales simulados call/whatsapp/sms/email/fax. Para el caso fijo solo NPC presentes en la definición con relación propia previamente creada al conversar. Contacto desconocido, no conocido y dirección externa comparten rechazo genérico; no se envía nada fuera del motor.

Texto no vacío, máximo 4000 unidades UTF-16. Se rechazan aliases recipient/content, campos extra, fecha, permiso o resultado suministrados. Este vocabulario sustituye el envío heredado abierto; no se conserva como atajo. La configuración general de canales/contactos por definición todavía necesita ampliación del esquema; esta política del caso fijo no se presenta como implementación de todos los expedientes.

Enviar cuesta cero minutos y crea solicitud a +30 del reloj interno. Payload privado copiado, evento con requestId únicamente; no se incluyen texto/contacto/canal en el evento. Duplicado exacto pendiente no crea otra solicitud. Cupo máximo 32 y límites de contadores conservados. Al madurar se añade un registro neutral communication_received:requestId@minute, no una respuesta libre ni una pista. Texto con instrucciones maliciosas permanece como dato, sin producir orden, evidencia, detención o conocimiento.

Esta entrega implementa envío simulado y acuse, no conversación remota factual ni todas las consultas al equipo A.C.M.E. Sus respuestas deben salir de reglas autorizadas futuras. No inferir éxito de una solicitud por recibir un acuse. No proveedor IA o servicio externo para esta transición.

## Lotes, persistibilidad y reloj

Validación completa antes de cualquier prefijo. Dependencias, pausa, cancelación y reanudación comparten coordinador; continuar no reenvía pasos aplicados. Envío no añade espera implícita: solo acciones que avanzan reloj pueden entregar el acuse. Resultado exactamente al plazo no madura. Payload inválido al madurar produce REQUEST_STATE_INVALID operativo, sin diálogo ficticio.

El límite por registro serializado aumenta de 4096 a 32768 unidades UTF-16, antes de JSON.parse, conservando máximo ocho pasos y reason máximo 512. Se justifica por texto válido de 4000 caracteres que al escapar controles JSON ocupa cerca de 24000 más metadatos. No se elimina la cota ni se permite un lote HTTP de ese tamaño por anticipación. El transporte y snapshot público futuros necesitan sus propios límites en bytes.

ENGINE_VERSION=12 por cambiar parámetros, payload y comportamiento de solicitudes persistidas. Formato engineCompatibility=1, seed y hash del expediente original conservados. Creación v12; lectura estricta de inicios v1–v11 sin escritura, progreso anterior conservado/rechazado. No migración silenciosa del formato recipient/content.

## Pruebas y límites de la evidencia

communications.test.ts cubre cinco canales con envío gratuito/acuse +30; contacto oculto/desconocido/externo; copia de payload y texto de instrucciones sin efectos; equivalencia individual/lote; espera explícita; duplicado pendiente; continuación sin reenviar; texto máximo escapado en snapshot; rechazo de registro excesivo; empate del plazo; cupo/desbordamiento; seis cuerpos inválidos; payload corrupto y versión anterior. Son pruebas puras con datos sintéticos.

La prueba de saturación anterior se adapta al contrato vigente y prepara un contacto conocido para alcanzar realmente el cupo. No se cambia el límite ni se trata un rechazo de forma como evidencia de saturación. Las rutas A/B mantienen sus pruebas independientes; comunicaciones no conceden pruebas ni sustituyen pasos de investigación.

PostgreSQL/HTTP verifica creación v12 y lectura sin reescritura de inicios hasta v11. No es E2E de comunicaciones ni ejercicio real de proveedor, envío o navegador.

## Verificación ejecutada

- pnpm lint e imports correctos: 141 módulos y 385 relaciones, sin infracciones. Complejidad máxima diez; helper de validación de texto usado por el contrato compartido. Motor sin I/O y sin dependencias nuevas.
- pnpm test: 461 pruebas correctas en 31 archivos; diecinueve escenarios nuevos respecto a v11.
- pnpm typecheck y pnpm build completos correctos.
- pnpm smoke: página/TSX y proxy web/API correctos con HTTP real en loopback; no equivale a E2E del juego.
- pnpm scan:secrets sin hallazgos por patrones, sin garantía exhaustiva.
- pnpm test:integration: 45 pruebas correctas en cinco archivos, proyecto PostgreSQL/HTTP sintético aislado meridiano-cero-t3-persistence-test, puerto 15434.
- scripts/verify_docs.py: 89 Markdown, referencias/grafo válidos y hashes originales DOCX intactos. Integridad documental, no certificación funcional o OWASP/ASVS.
- git diff --check correcto. pnpm check:format conserva las mismas nueve incidencias históricas, sin relajar el control.

La base sintética se detuvo conservando volumen. Servicio preexistente de 15433 y WSL sin cambios.

## Pendiente

T2/T3 no se cierran: faltan contactos/canales/resultados factuales declarativos, reglas/vocabularios generales, aceptación completa, DTO de progreso, acciones HTTP, autoguardados/manuales, primer resultado oficial y UI conectada. No certificación integral OWASP/ASVS, CI remota, instalación o restauración. Persisten las nueve incidencias históricas de formato.
