# SPEC-006 Interfaz, mapa y accesibilidad

Estado: detallada propuesta; T3-01 fija wireframes para primer caso, T5-05 amplía acabado.
Fuentes: GDD §1–3,5,6,8–15; TAD §12. ACC-003/019/031.

## Pantalla y navegación

Pantalla principal: cabecera con detective, caso, ciudad, reloj/plazo; escenario central con descripción accesible; herramientas laterales; consola narrativa y campo de órdenes inferior. Diseño retro MS-DOS legible, sin depender de una fuente pixelada para textos largos.

Paneles: mapa, dossier/maletín, laboratorio, comunicaciones, inteligencia, perfil/carrera, configuración y archivo. Ventanas movibles/minimizables en escritorio; en móvil se convierten en panel de ancho disponible con navegación clara. No reproducir ventanas fuera de pantalla; recuperar posición o restablecer distribución. Posición visual no determina acceso a datos.

Primer caso usa escenas/avatares provisionales identificados como tales en documentación del hito, no carteles técnicos en el flujo de juego. No exigir assets definitivos para validar motor.

## Órdenes y confirmaciones

Texto libre con historial; comandos no se ejecutan al escribir. Enviar produce interpretación/preview. Confirmaciones muestran acción, destino, tiempo estimado y hora prevista, más consecuencias conocidas. Botones confirmar/cancelar accesibles; evitar doble envío; un timeout permite recuperar el resultado, no repetir con nueva clave.

Lotes muestran orden de pasos. Una imposibilidad explica qué decisión falta y ofrece cancelar restantes o continuar independientes. No resaltar un hallazgo como señal de que el jugador va bien. Mensajes técnicos de error describen recuperación sin añadir pistas.

La inspección general describe lo visible; ningún objeto interactivo debe exigir ver un píxel minúsculo. Una descripción accesible no revela prueba que el jugador aún no descubrió.

## Herramientas

Mapa con ciudades admitidas y buscador textual equivalente; guiado muestra investigables sin importancia relativa, libre incorpora descubrimientos sin prohibir buscar otros destinos admitidos. Separar atlas informativo sin coste de visita física. Mostrar origen/destino/duración antes del viaje. No inventar ciudades disponibles ni rutas reales en el fixture.

Dossier agrupa evidencias por tipo, procedencia, minuto, legalidad/corroboración visible sin calificar culpabilidad. No mostrar porcentajes secretos de resolución. Maletín sin cuadrícula limitada ni puzzles de combinaciones absurdas.

Laboratorio y comunicaciones muestran solicitudes pendientes y hora de respuesta del juego; no confundir espera real con progreso interno. Registrar documentos, testimonios y análisis. Canales disponibles según expediente: llamada, WhatsApp, SMS, correo y fax; son simulaciones internas, no mensajes a terceros.

Órdenes requieren sospechoso y pruebas elegidas. Detención presenta identificación y coordinación, sin combate. Finalizar pide confirmación; informe final explica verdad y omisiones solo tras cierre.

## Accesibilidad

Objetivo WCAG 2.2 AA para interfaz. Teclado completo, orden de foco estable, foco visible y sin trampas; cerrar panel devuelve foco a quien lo abrió. Ventanas accesibles con nombres/roles; diálogos de confirmación controlan y devuelven foco.

Contraste y tamaño de texto ajustables; fuente legible, escala, alto contraste y paletas de protanopia/deuteranopia/tritanopia. Ningún estado depende solo de color. Respetar reducción de movimiento. Narrativa nueva anunciada de forma moderada para lectores, sin releer todo ni anunciar secretos.

Texto alternativo de escenas limitado a información visible; mapa dispone de alternativa lista/buscador. Evitar arrastrar como única forma de mover/cerrar paneles. Información persistente de reloj sin anuncios continuos.

## Audio, TTS e idiomas

Música retro MIDI/sintetizada y ambiente, con volumen general y controles independientes de música, efectos y narración. Nada relevante solo por sonido. TTS opcional del navegador/sistema: voz, velocidad, lectura manual/automática, repetir, pausar; aplicable a diálogo, documentos y narración. Si no hay voz compatible, texto disponible y opción deshabilitada explicada.

Interfaz preparada para traducciones desde primer hito; español inicial. El idioma de juego no depende de nacionalidad del NPC. Traductor A.C.M.E. explica la convención narrativa; no cambia pistas ni identidades.

Preferencias persisten por usuario; aplicar al inicio sin parpadeos que impidan lectura. Móvil, zoom, teclado y lector se revisan manualmente además de herramientas automáticas.

## Estados y errores

Carga inicial, solicitud en curso, proveedor caído, conexión perdida, conflicto de versión, partida cerrada y reanudación tienen pantallas/mensajes recuperables. No bloquear el acceso al dossier porque la IA esté caída. Acciones no enviadas se conservan localmente como borrador de texto sin guardar secretos.

La UI no calcula resultados de investigación: recibe PlayerView y eventos. Reproducir una animación o cambiar panel no ejecuta acción de motor.
