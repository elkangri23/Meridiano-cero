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
- **Cerrar:** finalizar el caso tras confirmación.

## Lotes (secuencias)

Puedes agrupar acciones en lotes (secuencias) con pausa, continuación confirmada y cancelación.
El plazo interrumpe el lote sin aplicar el resto ni efecto terminal; reanudar no repite el prefijo ya aplicado.

## Guardados y carga

- Autoguardado continuo.
- Hasta 10 guardados manuales por partida.
- Cargar un guardado permite regresar a un punto anterior del mismo caso y probar otras decisiones.
- El primer resultado oficial no se sustituye por cargas posteriores.

## Errores y conexión

- Si pierdes la conexión, la UI muestra estado offline y permite reconectar manualmente.
- Las respuestas tardías se descartan para evitar inconsistencias.
- Los errores operativos se muestran sin sugerir pistas ni valorar tu investigación.

## Consejos

- No hay sugerencias de culpable: tú analizas las evidencias.
- El reloj es interno del caso, no el reloj de pared.
- Las pruebas excluyentes de cada ruta se mantienen sin inyectar conocimiento.
- Revisa el Glosario/FAQ para términos y reglas detalladas.
