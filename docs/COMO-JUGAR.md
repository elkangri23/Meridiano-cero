# Cómo se usa y se juega a Meridiano-cero

Fecha: 2026-10-31. Manual de uso para el jugador.

## Qué es Meridiano-cero

Meridiano-cero es un juego de investigación detectivesca en el que tú eres el detective.
Un caso te presenta un misterio con dos posibles rutas de investigación. Tienes un tiempo
limitado (reloj interno del caso) para reunir evidencias, hablar con testigos, viajar,
analizar y, al final, tomar una decisión: detener a un sospechoso o cerrar el caso.

No hay multijugador: cada partida pertenece a un único usuario propietario.

## Flujo básico de una partida

1. **Registro e inicio de sesión.** Te registras con tu cuenta y eliges un caso.
2. **Archivo de partidas.** Desde el archivo ves tus partidas activas y cerradas, con filtros y paginación.
3. **Creación de partida.** Eliges un caso del catálogo; la creación es recuperable: si pierdes la conexión, puedes reintentar con la misma clave sin duplicar.
4. **Ficha inicial.** Muestra reloj/plazo, ubicación actual y ciudades visibles.
5. **Investigación.** Viajas, inspeccionas, hablas con contactos, pides análisis al laboratorio, solicitas órdenes (mandamientos) y comunicas con el equipo.
6. **Cierre.** Confirmas el cierre del caso. El primer resultado oficial cuenta para carrera y reputación; las repeticiones son práctica sin duplicar recompensas.
7. **Guardados.** Autoguardado y hasta 10 guardados manuales por partida para probar otras decisiones.

## Ventanas y controles

- Las ventanas son movibles y minimizables desde el primer caso jugable.
- Todo es operable con teclado y ratón.
- Si una orden es ambigua, el sistema pide aclaración antes de actuar; no interpreta por ti.

## Acciones principales

- **Viajar:** moverse entre ciudades, con coste de tiempo.
- **Inspeccionar:** examinar lugares y objetos.
- **Hablar:** conversar con NPCs presentes; la revelación de información depende de conocimiento, tema y cooperación.
- **Retratos:** cada personaje tiene su retrato pixel-art junto a su nombre: en la escena, en la conversación, en el equipo y en tus contactos. Sirve para reconocerlo; no es una pista ni se puede clicar.
- **Consultar:** pedir análisis al laboratorio (coste de tiempo).
- **Ordenar:** solicitar mandamientos/órdenes con admisibilidad.
- **Comunicar:** enviar mensajes al equipo (copia privada, acuse a +30 del reloj interno).
- **Equipo A.C.M.E.:** pedir ayuda a Margaret, Richter, Elena, David o Clara. Pedir ayuda es gratis y queda registrado; lo que te responden es solo lo que ya consta en tu expediente (ver «Equipo A.C.M.E.» más abajo).
- **Detener/Recuperar:** intervenciones con confirmación. Cada expediente fija su tipo de detención: en persona (15 min, hay que estar en la ciudad del sospechoso) o automática (30 min de coordinación: actúan las autoridades y no hace falta viajar). En ambos casos hace falta una orden válida y conocer la ubicación del sospechoso; en persona hay que conocer además su identidad (ver «Detenciones automáticas» más abajo).
- **Acciones irregulares:** forzar un acceso, sobornar o suplantar. Cuestan 30 min cada una, siempre piden confirmación con los riesgos, y lo obtenido por esa vía no es admisible como prueba (ver «Acciones irregulares» más abajo).
- **Cerrar:** finalizar el caso tras confirmación.

## Lotes (secuencias)

Puedes agrupar acciones en lotes (secuencias) con pausa, continuación confirmada y cancelación.
El plazo interrumpe el lote sin aplicar el resto ni efecto terminal; reanudar no repite el prefijo ya aplicado.

## Guardados y carga

- Autoguardado continuo.
- Hasta 10 guardados manuales por partida.
- Cargar un guardado permite regresar a un punto anterior del mismo caso y probar otras decisiones.
- El primer resultado oficial no se sustituye por cargas posteriores.

## Acciones irregulares

Puedes intentar forzar el acceso al lugar de recuperación cuando exige orden y no la tienes, o sobornar o suplantar a un personaje presente que aún tenga algo que contar. No son un atajo: nunca revelan la solución ni sustituyen las pruebas.

- Cada acto cuesta **30 min** y siempre pide **confirmación**: antes de actuar verás quién puede verte y qué está en juego.
- **Testigos:** solo te pueden ver los personajes que están en esa ciudad. Forzar un acceso lo ven los de la ciudad; sobornar lo ven los demás personajes de la ciudad; suplantar lo acaba descubriendo además la propia víctima.
- **Si te ven:** A.C.M.E. te advierte (queda en el dossier) y los testigos dejan de cooperar contigo. A la **tercera vez que te ven, A.C.M.E. retira el caso** y la partida se cierra.
- **Lo obtenido no es admisible:** lo que recuperes tras forzar el acceso y lo que te cuenten sobornado o suplantado no puede sostener una orden. El informe final descuenta **10 puntos por acto** y lista cada acto con su minuto y si te vieron.
- Sobornar o suplantar revela exactamente lo que revelaría una conversación normal con ese personaje; si ya no coopera contigo, es la única vía para que te cuente lo que sabe (sin restaurar la cooperación).
- «Entrar sin permiso» no tiene acción propia: no hay ubicaciones inaccesibles en los expedientes; el acceso restringido es el del lugar de recuperación y se fuerza con «Forzar el acceso».

## Detenciones automáticas

Cada expediente fija su tipo de detención al generarse (en el caso fijo, automática): unas tres de cada diez son automáticas y el resto, en persona. El tipo no se elige ni se cambia durante la partida.

- **Automática:** cuando tienes la orden válida y conoces la ubicación del sospechoso, puedes coordinar la detención con las autoridades **desde cualquier ciudad**, sin viajar a detener en persona y sin haber hablado con él: la orden es la que lo identifica. Cuesta **30 min** de coordinación y siempre pide confirmación. La consola lo dice claro: «Las autoridades han detenido a X por orden de A.C.M.E.».
- **En persona:** cuesta **15 min** y exige conocer la identidad y la ubicación del sospechoso y estar en la ciudad y en el lugar exactos del sospechoso.
- **Nunca es una sorpresa:** la detención solo ocurre cuando tú la pides (con la orden ya concedida); nadie detiene por ti sin que lo ordenes, y el sospechoso no se fuga mientras tienes orden y ubicación conocidas.
- **Los testigos reaccionan:** los personajes de la ciudad del detenido —y el propio detenido— saben que ocurrió y pueden hablar de ello si les preguntas.
- **Una detención errónea penaliza igual en ambos modos:** el informe final la valora como incorrecta (−20 puntos) y el resultado es «incorrecto».
- **Las pruebas inadmisibles no sirven:** una orden pedida con pruebas obtenidas por una acción irregular se deniega al madurar, así que nunca puede sostener una detención, ni automática ni en persona.

## Equipo A.C.M.E.

Tu equipo recurrente (GDD §8) está en su propia ventana, «Equipo A.C.M.E.», desde la barra de herramientas. Son cinco: **Margaret Sullivan** (directora), **Dr. Samuel Richter** (laboratorio forense), **Elena Vázquez** (inteligencia), **David Nakamura** (viajes y detenciones) y **Clara Beaumont** (expedientes).

- **Pedir ayuda no cuesta tiempo:** conversar y leer no avanzan el reloj. Lo que cuesta tiempo son las gestiones que ya existen: un análisis (90 min de espera), coordinar una detención (30 min) o enviar un documento (30 min).
- **Margaret** te recuerda el encargo y tus objetivos con su estado, y evalúa tu carrera («Evaluar mi carrera»: rango, puntos, casos, reputación y suspensiones; nunca valora el caso en curso). **Richter** te explica un análisis ya completado, solo con lo que la prueba permite decir. **Elena** consulta los registros de la partida como la terminal de inteligencia: sospechosos, pruebas, lugares; sin registro, lo dice y no inventa nada. **David** te enseña las rutas de viaje desde tu ciudad y coordina las detenciones (la detención en sí se pide desde aquí, con la misma oferta y confirmación que en la escena). **Clara** organiza tu expediente: pruebas con su admisibilidad, solicitudes pendientes, órdenes, detenciones y objetivos.
- **El equipo nunca te dice si vas bien, ni señala al culpable ni sugiere la siguiente pista.** Sus respuestas son resúmenes de lo que ya consta en tu expediente: nada nuevo, solo ordenado. Si una pregunta no tiene respaldo en los registros, la respuesta es que no consta.
- **Cada petición queda registrada** en la cronología y en el dossier (quién, qué servicio y en qué minuto), pero el texto libre de tu pregunta a Elena no se guarda.

## Carrera y reputación

Tu progreso como detective vive en el **archivo**: rango, puntos, casos cerrados y resueltos, medallas, países y lugares descubiertos, y tu reputación (prestigio, integridad y confianza institucional, con etiquetas como Sólida o Dudosa, nunca con barras secretas).

- **Primer resultado oficial:** el primer cierre de un expediente fija tu resultado oficial para ese caso (puntos, medalla y rango). Las repeticiones del mismo caso son **práctica**: puedes jugarlas y cerrarlas, pero no cambian tu carrera ni vuelven a dar puntos o medallas. Cargar un guardado antes del primer cierre sí permite cambiar decisiones, porque aún no hay resultado oficial.
- **Rangos:** Aspirante, Detective, Sargento e Inspector, por los puntos acumulados. El rango es honorífico: **todas las herramientas están disponibles desde el primer caso**, con independencia del rango.
- **Reputación:** una detención errónea daña la confianza; la conducta irregular (forzar, sobornar, suplantar) daña la integridad; recuperar el objeto y actuar con legalidad (sin actos irregulares y con órdenes para todo) la mejoran. La reputación **se recupera** con casos limpios posteriores.
- **Suspensión:** si A.C.M.E. te retira un caso por conducta irregular (a la tercera vez que te ven), tu carrera queda con una suspensión activa. No destruye tus guardados ni bloquea herramientas, y se resuelve con el primer caso limpio que cierres después.
- **Dónde se ve:** el informe final de cada partida muestra sus consecuencias de carrera (puntos, medalla, cambio de rango o, si es práctica, el resultado oficial que ya tenías), y Margaret te evalúa la carrera desde el equipo.

Las cifras (puntos por resultado, deltas y umbrales de rango) son valores iniciales para playtest, documentados en SPEC-008; no son un equilibrio definitivo y se afinarán tras jugar.

## Audio y voz

El juego tiene **música retro sintetizada** (melodía y bajo en bucle, generados en tu navegador, sin archivos de audio) y **efectos discretos** al confirmar acciones, viajar o fallar. Todo es decorativo: **nada importante se comunica solo por sonido**.

- **Dónde se ajusta:** en la ventana **Ajustes** de la pantalla de juego: silenciar todo, música (interruptor y volumen), efectos (interruptor y volumen) y volumen de narración. Los ajustes se guardan en tu navegador y se mantienen al cargar un guardado.
- **La música no suena sola:** por la política de autoplay del navegador, empieza tras tu primer clic o tecla en la página, nunca al cargar.
- **Lectura en voz alta (TTS):** en Ajustes puedes activar la lectura con la voz de tu sistema o navegador. Elige voz (automática en español si la hay) y velocidad, y si quieres lectura automática de la narración y los diálogos. En la consola tienes **Leer**, **Repetir**, **Pausar** y **Detener**; en el chat y en los hallazgos del dossier, un botón **Leer** en cada texto. Si tu navegador no ofrece síntesis de voz, la opción queda deshabilitada y explicada, y todo el texto sigue disponible.

## Errores y conexión

- Si pierdes la conexión, la UI muestra estado offline y permite reconectar manualmente.
- Las respuestas tardías se descartan para evitar inconsistencias.
- Los errores operativos se muestran sin sugerir pistas ni valorar tu investigación.

## Consejos

- No hay sugerencias de culpable: tú analizas las evidencias.
- El reloj es interno del caso, no el reloj de pared.
- Las pruebas excluyentes de cada ruta se mantienen sin inyectar conocimiento.
- Revisa el Glosario/FAQ para términos y reglas detalladas.
