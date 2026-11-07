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
- **Consultar:** pedir análisis al laboratorio (coste de tiempo).
- **Ordenar:** solicitar mandamientos/órdenes con admisibilidad.
- **Comunicar:** enviar mensajes al equipo (copia privada, acuse a +30 del reloj interno).
- **Detener/Recuperar:** intervenciones con confirmación.
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

## Errores y conexión

- Si pierdes la conexión, la UI muestra estado offline y permite reconectar manualmente.
- Las respuestas tardías se descartan para evitar inconsistencias.
- Los errores operativos se muestran sin sugerir pistas ni valorar tu investigación.

## Consejos

- No hay sugerencias de culpable: tú analizas las evidencias.
- El reloj es interno del caso, no el reloj de pared.
- Las pruebas excluyentes de cada ruta se mantienen sin inyectar conocimiento.
- Revisa el Glosario/FAQ para términos y reglas detalladas.
