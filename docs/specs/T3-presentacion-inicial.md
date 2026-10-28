# T3: contrato de presentación inicial

Estado: preparación parcial de SPEC-004/005/006. No sustituye sus reglas ni cierra la evaluación IA.

## Qué se puede adelantar

Componentes de solo presentación sobre PlayerView público, navegación de herramientas, accesibilidad de controles, borrador de texto y presentación de confirmaciones. El prototipo vive solo en desarrollo y utiliza datos sintéticos independientes del expediente secreto.

No se emula un motor en React. El tiempo mostrado se deriva de minute/deadlineMinutes; navegar, cambiar contraste o escribir no lo modifica. No hay indicadores de culpabilidad o rumbo ni pistas nuevas por abrir un panel.

## Frontera de integración futura

El servidor resuelve IDs a nombres/descripciones únicamente de objetos, lugares y contactos permitidos. El cliente no recibe el catálogo privado para poder traducir IDs. Un tipo importado no equivale a autorización.

Solicitudes públicas: ID, nombre visible de gestión, estado y minuto previsto; nunca payload interno ni resultados antes de vencimiento. El contrato PlayerView heredado necesita revisión de esa frontera antes de conectar HTTP.

Preview real: ID/token ligado a usuario/partida/versión, lista pública de pasos, coste y confirmación de efectos; rechazo de versión obsoleta. El prototipo muestra solicitud textual y duración desconocida, sin generar un token ficticio ni dar por ejecutada una acción.

## Evaluación IA pendiente

Mantener corpus de órdenes claras, ambiguas, lotes, referencias, imposibles e inyección. Hasta disponer de un modelo local probado y permiso de contexto no se cierra SPEC-005. Proveedor y motor quedan en servidor; no configurar endpoints/claves en navegador.

## Revisión del prototipo

Comprobar visualmente escritorio/móvil, navegación por teclado, entrada/confirmación/cancelación, retorno de foco, escala y contraste. Es una revisión pendiente por fallo de adjunto del navegador integrado, no sustituida por HTTP 200 ni build. No declarar AA ni E2E aprobado.

## Reglas visuales consultadas antes de modificar el prototipo

Fuentes: GDD original §2 y §15, TAD §12 y [SPEC-006](SPEC-006-interfaz.md). La estética MS-DOS y el pixel art son requisitos, junto con tipografía retro legible, fuente accesible alternativa, teclado y ausencia de búsqueda de píxeles diminutos.

Aplicación inicial: monoespaciada del sistema, títulos sin serif, marcos rectangulares, colores planos y escena original dibujada sobre una cuadrícula de 320 × 160 con coordenadas enteras y bordes sin suavizado. El atlas usa contorno escalonado. No usar degradados, desenfoques, esquinas redondeadas ni animación CRT intermitente. La paleta inspirada en EGA y esa resolución son decisiones provisionales del prototipo: los Word no fijan colores ni resolución exactos.

Lectura y contraste ofrece fuente alternativa sans serif, tamaño y contraste reforzado. El texto descriptivo permite comprender lo visible sin identificar píxeles. El arte es provisional; retratos definitivos, animaciones breves y ventanas movibles/minimizables siguen pendientes. Antes de cada cambio visual, revisar estas fuentes y comprobar coherencia en escritorio, móvil, zoom y ajustes.

Comprobación de esta corrección: revisión visual en navegador de la escena pixelada, marcos y tipografía monoespaciada. No equivale a auditoría WCAG ni a aceptación completa de T3.
