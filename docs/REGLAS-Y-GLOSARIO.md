# Reglas del juego, glosario y FAQ de Meridiano-cero

Fecha: 2026-10-31. Documento para jugadores y para el apartado "Glosario" de la app.

## Glosario

- **Caso:** misterio a investigar, con dos rutas posibles de investigación.
- **Partida (run):** instancia de un caso para un usuario.
- **Detective:** el jugador; único por partida.
- **Reloj interno:** tiempo del caso, no el reloj de pared. Gobierna plazos y costes.
- **Plazo:** límite de tiempo del caso. Al vencer, no se aplican efectos terminales ni el resto del lote.
- **Evidencia:** prueba física o testimonial recogida durante la investigación.
- **NPC / contacto:** personaje con el que se puede hablar; la revelación depende de conocimiento, tema y cooperación.
- **Retrato:** cara pixel-art de un personaje, generada de forma determinista a partir de su identidad; sirve para reconocerlo y no es una pista.
- **Laboratorio:** servicio de análisis de evidencias con coste de tiempo.
- **Mandamiento / orden:** autorización para una acción con admisibilidad y costes.
- **Lote (secuencia):** agrupación de acciones con pausa, continuación confirmada y cancelación.
- **Autoguardado:** guardado automático continuo.
- **Guardado manual:** hasta 10 por partida; permite regresar a un punto anterior.
- **Detención automática:** detención coordinada con las autoridades por orden de A.C.M.E., sin que el detective viaje a detener en persona. Cuesta 30 min y exige orden válida y ubicación conocida (la orden identifica al sospechoso).
- **Detención en persona:** detención que hace el detective en la ciudad y el lugar del sospechoso. Cuesta 15 min y exige lo mismo que la automática, más conocer la identidad del sospechoso y la presencia.
- **Equipo A.C.M.E.:** equipo recurrente de la agencia (Margaret Sullivan, Dr. Samuel Richter, Elena Vázquez, David Nakamura y Clara Beaumont). Pedirles ayuda es gratis y queda registrado; solo responden con lo que ya consta en el expediente, sin indicar si se va bien ni señalar al culpable.
- **Primer resultado oficial:** primer cierre de caso que cuenta para carrera y reputación.
- **Carrera / reputación:** progreso del detective; idempotente, sin duplicación por repeticiones.
- **Archivo:** listado de partidas propias con filtros y paginación.
- **Localizador de creación:** mecanismo para recuperar una creación perdida por conexión sin duplicar partida.

## Reglas fundamentales

1. Una partida tiene un único usuario propietario y un detective jugador. Sin multijugador.
2. El primer resultado oficial de un caso cuenta para carrera y reputación; las cargas y repeticiones posteriores son práctica y no reemplazan el resultado ni duplican recompensas.
3. El reloj es interno del caso; nunca se usa el reloj de pared para decidir.
4. El plazo gana en caso de empate con una acción.
5. Las órdenes ambiguas piden aclaración antes de actuar; no se elige una interpretación ni se ejecuta parcialmente.
6. La detención no cierra el caso por sí misma.
7. No se filtra la verdad antes del informe final.8. Ningún compañero sugiere la siguiente pista.
9. Las pruebas excluyentes de cada ruta se mantienen sin inyectar conocimiento.
10. Hasta 10 guardados manuales por partida, además del autoguardado; no se borran automáticamente al alcanzar el límite.
11. Cargar un guardado manual permite regresar a un punto anterior del mismo caso y probar otras decisiones.
12. Los lotes admiten pausa, continuación confirmada y cancelación; el plazo interrumpe sin aplicar el resto ni efecto terminal.
13. Las acciones irregulares (forzar un acceso, sobornar, suplantar) cuestan 30 min, siempre piden confirmación con los riesgos, y lo obtenido por esa vía no es admisible como prueba. Solo te pueden ver los personajes de la misma ciudad; a la tercera vez que te ven, A.C.M.E. retira el caso. Cada acto descuenta 10 puntos en el informe final. Ninguna acción irregular revela la solución.
14. Ninguna consecuencia reescribe la verdad del caso.
15. Cada expediente fija su tipo de detención (en persona o automática) al generarse; la automática se coordina con las autoridades desde cualquier ciudad (30 min) y la en persona exige presencia (15 min). Ambas exigen orden válida y ubicación conocida; la en persona exige además conocer la identidad del sospechoso, y una detención errónea penaliza igual en el informe final. Ninguna detención ocurre sin que el jugador la pida.
16. Pedir ayuda al equipo A.C.M.E. es gratis (0 min) y queda registrado en la cronología y en el dossier; el equipo solo responde con hechos autorizados del expediente y nunca revela la solución ni valora si se va bien.

## Costes y tiempos

- Viajar tiene coste de tiempo (seeded, determinista por semilla).
- Consultas al laboratorio tienen coste de tiempo.
- Comunicaciones al equipo: envío gratuito, acuse a +30 del reloj interno.
- Laboratorio programado: +90 al reloj interno.
- Consultas paralelas: +30 al reloj interno.
- Acciones irregulares: +30 al reloj interno cada una.
- Detención en persona: +15 al reloj interno; detención automática (coordinación con las autoridades): +30.
- Pedir ayuda al equipo A.C.M.E.: gratis; las gestiones que ya existen (análisis, coordinar una detención, enviar un documento) mantienen su coste.

## FAQ

**¿Qué pasa si me ven en una acción irregular?**
A.C.M.E. te advierte y los testigos dejan de cooperar contigo. A la tercera vez que te ven, retiran el caso y la partida se cierra. El informe final descuenta 10 puntos por acto.

**¿Qué es una detención automática?**
En algunos expedientes (unas tres de cada diez, y en el caso fijo siempre), la detención no la haces tú en persona: la coordinas con las autoridades. Hace falta una orden válida y conocer la ubicación del sospechoso —la orden es la que lo identifica; en persona hay que conocer además su identidad— pero no tienes que viajar a la ciudad del sospechoso; cuesta 30 min de coordinación. La consola dice que actúan las autoridades, y una detención errónea penaliza igual que una manual.

**¿Qué puedo pedirle al equipo A.C.M.E.?**
A Margaret, que te recuerde el encargo y tus objetivos; a Richter, que te explique un análisis ya completado; a Elena, que consulte los registros de la partida; a David, las rutas de viaje y coordinar una detención; a Clara, que organice tu expediente. Pedir ayuda es gratis y queda registrado en el dossier.

**¿El equipo me dice si voy bien?**
No. Nunca indica si vas bien, ni señala al culpable ni sugiere la siguiente pista: solo resume lo que ya consta en tu expediente. Si preguntas por algo sin registro, te dice que no consta.

**¿Puede una acción irregular resolver el caso?**
No. Nunca revela la solución ni sustituye las pruebas: lo obtenido por esa vía no es admisible y no puede sostener una orden.

**¿Puedo jugar el mismo caso varias veces?**
Sí. El primer resultado es el oficial; las repeticiones son práctica y no duplican recompensas.

**¿Puedo volver atrás en una partida?**
Sí, cargando un guardado manual anterior. No sustituye el primer resultado oficial.

**¿Qué pasa si se me cae la conexión al crear una partida?**
La creación es recuperable: reintenta con la misma clave. Un 404 puede ser provisional y nunca autoriza una nueva clave.

**¿El sistema me da pistas?**
No. Los errores operativos se muestran sin sugerir pistas ni valorar tu investigación.

**¿Cómo se decide el culpable?**
Tú analizas las evidencias. El motor no consulta la solución para conceder órdenes.

**¿Qué son los lotes?**
Agrupaciones de acciones con pausa, continuación confirmada y cancelación. El plazo interrumpe sin aplicar el resto.

**¿Cuántos guardados manuales puedo tener?**
10 por partida, además del autoguardado.

**¿Funciona sin internet?**
El motor es puro y no requiere red; la IA y la persistencia requieren conexión.

**¿Qué proveedores de IA soporta?**
Ollama (doméstico), FreeLLMAPI (trabajo/VPS) y endpoints configurables en instalaciones propias. El contrato es independiente del proveedor.

**¿Hay multijugador?**
No. Cada partida pertenece a un único usuario.

## Funcionamiento de la web

- **Archivo:** listado de partidas propias con filtro active/closed, paginación por cursor.
- **Catálogo:** casos públicos para elegir.
- **Creación recuperable:** POST + lookup por clave original; reintentos seguros.
- **Ficha inicial:** reloj/plazo, ubicación y ciudades visibles (solo lectura).
- **Estados UI:** offline/online con reconexión manual; respuestas tardías descartadas.
- **Seguridad:** sesión validada en cada petición, CSRF en memoria, allowlist de DTO sin datos privados.

## Apartado en la app: Glosario, reglas y ayuda

La aplicación incluye (o incluirá) un apartado "Glosario" con:
- Glosario de términos.
- Reglas fundamentales.
- FAQ.
- Explicación de cómo se juega y cómo funciona la web y el programa.

Este documento es la fuente de verdad para ese apartado. Actualizar ambos a la vez.
