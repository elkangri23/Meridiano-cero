# SPEC-003 El astrolabio de las tres ciudades

Estado: caso fijo parcialmente implementado; aceptación de hito pendiente. Revisión de ejecución v4: 2026-10-29.
Requisitos GDD §3–12. T2-02 y T2-06. Referencias ACC-001/008/009/010/012.

## Experiencia y verdad fijada

Robo Familiar, presente, dificultad normal, objetivo de 20–30 minutos reales, exploración guiada o libre sobre la misma definición. Ciudades investigables: Madrid, París y Lisboa. Instituciones y personas ficticias; no atribuir el delito a entidades reales. Direcciones y horarios son ficticios.

Un astrolabio de una exposición del Instituto Horizonte en Madrid desaparece durante un traslado. Inés Valera, restauradora contratada, lo sustituye por una réplica y lo transporta a un almacén de Lisboa. Tomás Ríos, auxiliar inocente, manipuló legítimamente la caja en Madrid. Inés reconoce su identidad, puede negarse a declarar sobre el robo y nunca inventa una coartada. El astrolabio permanece en la taquilla L-7 del almacén hasta la recuperación.

Cronología anterior al juego: Inés prepara la réplica, obtiene acceso autorizado, sustituye el objeto y sale con una caja de conservación; Tomás mueve la caja vacía según su trabajo; Inés registra el envío y queda en Lisboa. Inicio en sala de embalaje de Madrid. Plazo interno: 2.880 minutos (48 h), sin movimiento autónomo del sospechoso. Hora base narrativa: 09:00 de un día ficticio actual; el motor usa minutos relativos.

Objetivos: detener a Inés con orden válida y recuperar el original. Detenciones interactivas; confirmar identidad, presentar orden y coordinar intervención, sin violencia. Autoridad ficticia A.C.M.E.; no describir reglas procesales como derecho real.

## Lugares y conocimiento

| ID | Lugar | Acceso y contenido |
|---|---|---|
| MAD-SALA | Sala de embalaje, Madrid | Inicio; vitrina, caja, Tomás, conservadora Lucía |
| PAR-ARCH | Archivo de conservación, París | Registros de herramientas, firmas y exportación; archivero Émile |
| LIS-ALM | Almacén de depósito, Lisboa | Inés y encargada Marta; registro de custodia y taquilla L-7 |

Lucía conoce la lista de personas autorizadas y vio a Tomás mover la caja vacía. Émile conoce únicamente sus registros. Marta conoce depósitos, titular y taquilla; entrega registro por solicitud institucional. Tomás explica su tarea y permite verificarla. Inés conoce la verdad de su actuación; puede guardar silencio ante preguntas incriminatorias. NPC sin hechos adicionales generados en vivo.

En guiado se muestran las tres ciudades desde el principio, sin valoración. En libre: la etiqueta/registro inicial descubre París y los documentos de exportación descubren Lisboa. El buscador permite viajar a las tres desde el inicio, aunque aún no aparezcan como pistas. Los viajes equivocados entre ellas consumen tiempo. Catálogo turístico ampliado es fase 5.

## Evidencias y condiciones

Todas las evidencias se obtienen legalmente mediante inspección autorizada o solicitud institucional, salvo entrada forzada a L-7: permite recuperar pero invalida el objeto como prueba y reduce integridad. Solicitar orden no utiliza esa recuperación como requisito obligatorio.

| ID | Acción y requisito | Hecho revelado / efecto |
|---|---|---|
| EV-01 | inspect general de MAD-SALA, 10 min | Caja visible; etiqueta remite al archivo de París; no recoge nada |
| EV-02 | inspect cerradura de vitrina, 20 min | Residuo de herramienta; collect explícito, 0 min |
| EV-03 | analyze EV-02, resultado a +90 min | Huella técnica compatible con herramienta serie HV-17; no acusa |
| EV-04 | query herramienta HV-17 en PAR-ARCH, +30 min | Registro firmado de asignación a Inés |
| EV-05 | query traslado Inés en PAR-ARCH, +30 min | Envío a Lisboa y titular de depósito L-7; ubicación conocida |
| EV-06 | inspect caja en MAD-SALA, 20 min; collect, 0 min | Copia de manifiesto con sello y firma verificables |
| EV-07 | query firma/sello EV-06 en PAR-ARCH, +30 min | Firma y autorización de Inés verificadas; envío original, no copia |
| EV-08 | query custodia del envío en LIS-ALM, +30 min | Asiento independiente de recepción por Inés y depósito L-7 |
| EV-09 | talk Lucía sobre caja, 0 min | Testimonio veraz de que Tomás movió caja; no vio el contenido |
| EV-10 | query accesos de Tomás, desde Madrid, +30 min | Registro real de acceso de Tomás durante la preparación |
| EV-11 | recover original en L-7, 20 min | Original recuperado si orden de acceso válida o acción irregular explícita |

Las solicitudes tienen coste de envío 0 y resultados según el reloj interno. Esperar el resultado consume el intervalo faltante. Registros no se recogen físicamente; se incorporan al dossier con procedencia.

Orden de Inés: suficiente con EV-03 + EV-04 (ruta técnica), o EV-06 + EV-07 + EV-08 (ruta documental). No consultar culpabilidad para concederla. Orden de Tomás: EV-09 + EV-10 satisface el umbral ficticio de indicios, pero no acredita el robo. Esto permite ensayar una detención errónea basada en hechos veraces. La orden de acceso a L-7 se emite junto a orden de Inés una vez EV-05 o EV-08 vincula el depósito.

Inés se localiza mediante EV-05 o EV-08. Tomás permanece en Madrid. Detención en presencia: 15 minutos para cualquiera; request_warrant tarda 30 minutos como solicitud programada. Una vez orden y ubicación conocidas, nadie se fuga.

## Costes y rutas de aceptación

Viajes directos simétricos de prueba: Madrid–París 180 min; París–Lisboa 150 min; Madrid–Lisboa 120 min. No son horarios ni tarifas reales. Fixture base sin retraso; variantes seeded aplican +45 min a cada tramo para probar margen máximo. Inspección repetida ya resuelta no cobra de nuevo salvo nueva acción material distinta. No hay coste por leer o dialogar.

Ruta A, sin EV-06/07/08: general 10 + cerradura 20 + viaje París 180 (EV-03 madura en trayecto) + consulta herramienta y traslado paralelas, espera 30 + orden espera 30 + viaje Lisboa 150 + detención 15 + recuperación 20 = 455 min. Con retrasos máximos en dos tramos: 545 min.

Ruta B, sin EV-02/03/04/05: general 10 + caja 20 + viaje París 180 + verificación firma espera 30 + viaje Lisboa 150 + custodia espera 30 + orden espera 30 + detención 15 + recuperación 20 = 485 min; con retrasos máximos: 575 min.

Ambas rutas son independientes en pruebas decisivas, comparten ciudades/objetivo y terminan antes de 2.880. Consultas y orden se explicitan en guiones de prueba, no como ayuda al jugador. Un test elimina las evidencias exclusivas de la otra ruta y sigue completando el caso.

## Finales y variantes negativas

Complete: original recuperado e Inés detenida, sin inocentes detenidos. Partial: solo uno de esos objetivos. Incorrect: Tomás detenido, aunque luego se consigan otros objetivos. Unresolved: ningún objetivo. Cierre solo por finish confirmado o vencimiento; detener no finaliza.

Variante plazo: avanzar hasta 2.870 y ejecutar inspección pendiente de 20; cierre a 2.880 sin nueva evidencia. Variante orden denegada: solicitar con solo EV-09 no cierra. Variante presión: Lucía deja de colaborar; ambas rutas materiales siguen abiertas. Variante irregular: recuperar por fuerza exige preview de consecuencias, sin instrucciones reales de intrusión.

El informe muestra verdad, cronología y pruebas omitidas solo al cerrar. Los porcentajes globales de tipos de detención, carrera y catálogo cultural quedan para fase 5; no se consideran probados por este fixture.

## Contrato ejecutable v3 y aceptación pendiente

Los IDs de consulta estructurada son los siguientes; no se interpretan cadenas libres como permisos:

| topicId | Presencia | Condición adicional | Resultado |
|---|---|---|---|
| herramienta-hv17 | PAR-ARCH | EV-03 conocida | EV-04 |
| traslado-ines | PAR-ARCH | Ninguna adicional | EV-05 |
| firma-sello | PAR-ARCH | EV-06 conocida | EV-07 |
| custodia-envio | LIS-ALM | EV-05 o EV-07 conocida | EV-08 |
| accesos-tomas | MAD-SALA | Ninguna adicional | EV-10 |

Todos maduran a +30 minutos. Hablar con Lucía sobre topicId=caja revela EV-09 si coopera; topicId=identidad confirma identidad y ubicación del interlocutor presente. No se entrega el conocimiento privado completo del NPC. La traducción de lenguaje natural a estos IDs pertenece al adaptador, sin ampliar sus permisos.

Solicitar orden requiere evidenceIds explícitos. Inés: EV-03/04 o EV-06/07/08; Tomás: EV-09/10. La orden de acceso exige además EV-05 u EV-08 incluida en esa selección, conocida y admisible. Se distingue prueba poseída de prueba ofrecida al juzgado.

Las simulaciones actuales encadenan ambas rutas sin insertar pistas en CaseRun, incluso eliminando las evidencias exclusivas de la otra ruta. Esto verifica obtención, solicitudes, autoridad y desenlace, **no cierra ACC-008/009**: todavía faltan los costes materiales y confirmaciones de esta spec. Los 455/485 minutos y máximos de retraso anteriores siguen siendo objetivos, no duraciones acreditadas por v3. Las semillas sintéticas ensayadas no sustituyen el ensayo de todos los extremos del retraso. [Resultados y límites](../quality/T2-evidencias-ordenes-v3.md).

## Verificación de costes en ejecución v4

Las rutas encadenadas ahora cobran las inspecciones, detención y recuperación de esta spec y solicitan aprobación antes del coste. Sin pruebas exclusivas de la otra ruta, semilla sintética 1: A=455 minutos, B=485; semilla original 42: A=482, B=512 por retraso determinista. El laboratorio madura a minuto 120 en la ruta A: se envía después de los primeros 30 minutos de inspección, con demora de 90. No cambia la semilla del expediente existente.

Esto acredita los tiempos base y las variantes ensayadas, pero no cierra por sí solo ACC-008/009 ni la fase: faltan los extremos de retraso, validador y demás puertas de calidad. El generador seeded heredado no acredita la variante máxima de +45 por tramo; no se redefine el equilibrio silenciosamente para hacer pasar ese objetivo. [Registro v4](../quality/T2-costes-confirmaciones-v4.md).

## Rutas con lotes programados v6

Se ejecutan ambas rutas agrupando inspección/recogida/laboratorio y consultas/esperas/órdenes, manteniendo viajes/detención/recuperación/cierre como acciones individuales. Variantes de semillas 1/42 sin pruebas exclusivas de la otra ruta: mismos minutos, evidencias/procedencia, admisibilidad, órdenes y desenlace que la secuencia individual. Los controles de lote agregan eventos/revisión internos propios; no se igualan artificialmente esos contadores. Esto no acredita aún lotes de viaje, máximos de retraso ni E2E. [Verificación](../quality/T2-lotes-solicitudes-v6.md).

## Aceptación temporal de motor v8

La variante sintética seed=14194 produce +45 minutos reales en cada uno de los dos tramos mediante el mezclador normal; no se altera travelDurations ni se usa un resolver simulado. Ruta A sin pruebas exclusivas B completa en 545; B sin pruebas exclusivas A, en 575. Semillas 1 y original 42 completan ahora en 455/485, por la política v8 versionada; las cifras previas de seed=42 son evidencia histórica de otros motores.

Las rutas agrupadas y las individuales coinciden en hechos, procedencia y desenlace. Con deadline=545/575, recuperar empata con el plazo y no materializa el original: resultado partial con Inés detenida. Con Lucía a cooperación cero, su conversación no revela EV-09 y ambas rutas materiales siguen resolviéndose incluso con los dos máximos.

Esto verifica el componente de motor ACC-008/009 y los escenarios temporales indicados; E2E, integración completa y aceptación de hito siguen pendientes. La variante es entrada sintética de pruebas, no nuevo caso publicado ni alteración del fixture original. [Resultados](../quality/T2-retrasos-maximos-v8.md).
