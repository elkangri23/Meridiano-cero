import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Crea una partida desde la UI del archivo; la creación confirmada navega sola a su pantalla de juego. */
async function openGameScreen(page: Page) {
  await page.goto('/archivo');
  await page.waitForSelector('#root > *', { timeout: 10000 });
  await page.click('button:has-text("Entrar en desarrollo local")');
  const creation = page.locator('.archive-create').first();
  await expect(creation.getByRole('heading', { name: 'Nueva partida' })).toBeVisible();
  await creation.getByRole('radio', { name: 'Robo internacional', exact: true }).check();
  await creation.getByRole('button', { name: 'Empezar partida' }).click();
  await page.waitForSelector('[data-testid="game-screen"]', { timeout: 10000 });
  await expect(page.getByTestId('clock')).toContainText('0 min');
  // La dificultad se ve en la cabecera junto al reloj, sin desplazar
  // (la partida se crea con la dificultad por defecto, Normal · 48 h).
  await expect(page.getByTestId('difficulty')).toBeVisible();
  await expect(page.getByTestId('difficulty')).toContainText('Normal · 48 horas');
}

/** Pulsa una oferta y espera el reloj en `minute`. Las acciones costosas o
 * irreversibles (viajar, detener, recuperar, pedir orden) enseñan el
 * diálogo de confirmación; las baratas (inspeccionar, hablar, recoger,
 * consultar, esperar) se ejecutan en el mismo clic (lote 2). El cierre ya
 * no es una oferta de escena: se hace desde la cabecera con `closeCase`. */
async function playOffer(page: Page, testId: string, minute: number) {
  const needsDialog = /offer-(travel|detain|recover|request_warrant)/.test(testId);
  await page.getByTestId(testId).click();
  if (needsDialog) {
    await expect(page.getByTestId('preview-dialog')).toBeVisible();
    await page.getByTestId('preview-confirm').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
  }
  await expect(page.getByTestId('clock')).toContainText(`${minute} min`);
  // Sin diálogo para lo barato: el reloj avanza sin pedir confirmación.
  if (!needsDialog) await expect(page.getByTestId('preview-dialog')).toBeHidden();
}

/** Cierra el caso desde la cabecera (rediseño Norte): botón «Cerrar el
 * caso», pestaña Informe, «Iniciar el cierre del caso», confirmación en
 * línea y el informe final a pantalla entera. */
async function closeCase(page: Page) {
  await page.getByTestId('close-case-header').click();
  await expect(page.getByRole('tabpanel', { name: 'Informe' })).toBeVisible();
  await page.getByTestId('dock-close-start').click();
  await page.getByTestId('dock-close-yes').click();
  await expect(page.getByTestId('report-full')).toBeVisible();
  await expect(page.getByTestId('run-state')).toContainText('Partida cerrada');
}

/** Viaja desde la pestaña Mapa del dock: abre Mapa, pulsa Viajar y
 * confirma. La ciudad de destino deja de listarse como destino. */
async function travelTo(page: Page, cityId: string, minute: number) {
  await page.click('button:has-text("Mapa")');
  await page.getByTestId(`travel-${cityId}`).click();
  await expect(page.getByTestId('preview-dialog')).toBeVisible();
  await page.getByTestId('preview-confirm').click();
  await expect(page.getByTestId('preview-dialog')).toBeHidden();
  await expect(page.getByTestId('clock')).toContainText(`${minute} min`);
  await expect(page.getByTestId(`travel-${cityId}`)).toBeHidden();
}

test.describe('E2E T3-05 - Pantalla de juego', () => {
  // Rediseño Norte, fase 2: la ruta A vuelve a ser jugable — el análisis
  // de EV-02 vive ahora en su propia ficha del Dossier, y el hallazgo se
  // anuncia en la escena con su distintivo en la pestaña Dossier.
  test('Ruta A completa (470 min): hallazgo en escena, re-inspección sin coste, análisis en el Dossier, orden, detención y cierre', async ({ page }) => {
    await openGameScreen(page);
    // Objetivos siempre visibles (lote 2): los dos pendientes al empezar.
    const objectives = page.getByTestId('objectives-panel');
    await expect(objectives).toBeVisible();
    await expect(objectives).toContainText('Detener a Inés con orden válida');
    await expect(objectives).toContainText('Recuperar el astrolabio original');
    await expect(page.getByTestId('objective-obj-detener')).toHaveAttribute('data-achieved', 'false');
    await expect(page.getByTestId('objective-obj-recuperar')).toHaveAttribute('data-achieved', 'false');
    // Inspeccionar el lugar: hallazgo anunciado en la escena y distintivo
    // del Dossier en 1; el lugar queda marcado «Revisado ✓».
    await playOffer(page, 'offer-inspect:MAD-SALA', 10);
    const finding = page.getByTestId('finding-card');
    await expect(finding).toBeVisible();
    await expect(finding).toContainText('Has descubierto:');
    await expect(page.getByTestId('dossier-evidence-count')).toHaveText('1');
    await expect(page.getByTestId('offer-card-inspect:MAD-SALA')).toContainText('Revisado ✓');
    // Re-inspeccionar el lugar: sin coste y sin duplicar — solo la nota.
    await page.getByTestId('offer-inspect:MAD-SALA').click();
    await expect(page.getByTestId('revisit-note-inspect:MAD-SALA')).toBeVisible();
    await expect(page.getByTestId('revisit-note-inspect:MAD-SALA')).toContainText('Ya revisaste esto: no hay nada nuevo. Sin coste.');
    await expect(page.getByTestId('clock')).toContainText('10 min');
    await expect(page.getByTestId('dossier-evidence-count')).toHaveText('1');
    // Inspeccionar la cerradura: el hallazgo pasa a ser EV-02, distintivo
    // en 2, y la cerradura queda marcada «Revisado ✓».
    await playOffer(page, 'offer-inspect:MAD-SALA:cerradura', 30);
    await expect(finding).toContainText('Has descubierto: La cerradura de la vitrina tiene residuo de herramienta.');
    await expect(page.getByTestId('dossier-evidence-count')).toHaveText('2');
    await expect(page.getByTestId('offer-card-inspect:MAD-SALA:cerradura')).toContainText('Revisado ✓');
    // Re-inspeccionar la cerradura: sin coste y sin duplicar.
    await page.getByTestId('offer-inspect:MAD-SALA:cerradura').click();
    await expect(page.getByTestId('revisit-note-inspect:MAD-SALA:cerradura')).toBeVisible();
    await expect(page.getByTestId('clock')).toContainText('30 min');
    await expect(page.getByTestId('dossier-evidence-count')).toHaveText('2');
    await playOffer(page, 'offer-collect:EV-02', 30);
    // Sin laboratorio en el dock ni en la escena, pero el análisis de
    // EV-02 vive en su ficha del Dossier, con su demora visible.
    await expect(page.getByTestId('open-lab')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Laboratorio', exact: true })).toHaveCount(0);
    await page.click('button:has-text("Dossier")');
    const dossier = page.getByTestId('dock-panel-dossier');
    await expect(dossier).toContainText('Solicitudes en curso');
    await expect(dossier).toContainText('Sin solicitudes pendientes.');
    const evidence = page.getByTestId('evidence-EV-02');
    await expect(evidence).toContainText('La cerradura de la vitrina tiene residuo de herramienta.');
    const analyze = page.getByTestId('offer-analyze:EV-02');
    await expect(analyze).toBeVisible();
    await expect(analyze).toContainText('Analizar huellas y marcas · 90 min');
    // Pedir el análisis: cuesta 0, queda en curso con su cuenta atrás y
    // en el bloque de solicitudes; el Informe ya refleja el pendiente.
    await analyze.click();
    await expect(page.getByTestId('clock')).toContainText('30 min');
    await expect(evidence).toContainText('En análisis · listo en 90 min (minuto 120)');
    await expect(page.getByTestId('dossier-pending')).toContainText('Análisis · La cerradura de la vitrina tiene residuo de herramienta.');
    await expect(page.getByTestId('dossier-pending')).toContainText('Responde en el minuto 120 (ahora 30)');
    await page.click('button:has-text("Informe")');
    await expect(page.getByTestId('dock-panel-informe')).toContainText('Solicitudes pendientes al cerrar: Análisis · Responde en el minuto 120 (ahora 30).');
    // Viajar a París madura el análisis: EV-03 vuelve vinculada a EV-02,
    // con su texto, sin salir del Dossier; el distintivo sube a 3.
    await travelTo(page, 'paris', 210);
    await page.click('button:has-text("Dossier")');
    await expect(page.getByTestId('dossier-evidence-count')).toHaveText('3');
    await expect(evidence).toContainText('Resultado del análisis · EV-03 vinculada a esta evidencia');
    await expect(evidence).toContainText('La huella técnica es compatible con una herramienta de la serie HV-17.');
    await expect(dossier).toContainText('Sin solicitudes pendientes.');
    // Con EV-03 + EV-04 se pide la orden contra Inés: consultas en París,
    // espera a que maduren, orden y detención coordinada sin moverse.
    await playOffer(page, 'offer-query:herramienta-hv17', 210);
    await playOffer(page, 'offer-query:traslado-ines', 210);
    await playOffer(page, 'offer-wait:30', 240);
    await playOffer(page, 'offer-request_warrant:ines', 240);
    await playOffer(page, 'offer-wait:30', 270);
    const detainCard = page.getByTestId('offer-card-detain:ines');
    await expect(detainCard).toBeVisible();
    await expect(detainCard).toContainText('Coordinar la detención de Inés Valera con las autoridades');
    await playOffer(page, 'offer-detain:ines', 300);
    const console = page.locator('.game-console');
    await expect(console).toContainText('Las autoridades han detenido a Inés Valera por orden de A.C.M.E. El caso sigue abierto.');
    // Los objetivos viven en la pestaña Dossier del dock.
    await page.click('button:has-text("Dossier")');
    await expect(page.getByTestId('objective-obj-detener')).toHaveAttribute('data-achieved', 'true');
    // Viajar a Lisboa a recuperar el astrolabio y cerrar: 470 min.
    await travelTo(page, 'lisboa', 450);
    await playOffer(page, 'offer-recover:astrolabio-original', 470);
    await page.click('button:has-text("Dossier")');
    await expect(page.getByTestId('objective-obj-recuperar')).toHaveAttribute('data-achieved', 'true');
    await closeCase(page);
    await expect(page.getByTestId('report-full')).toContainText('Total: 87 / 100');
  });

  test('Ruta B completa (500 min) con guardar y reanudar a mitad de ruta', async ({ page }) => {
    await openGameScreen(page);
    await playOffer(page, 'offer-inspect:MAD-SALA', 10);
    await playOffer(page, 'offer-inspect:MAD-SALA:caja', 30);
    await playOffer(page, 'offer-collect:EV-06', 30);
    // Guardar en el minuto 30.
    await page.click('button:has-text("Guardados")');
    await page.getByTestId('save-name-input').fill('Punto E2E ruta B');
    await page.getByTestId('save-create').click();
    await expect(page.locator('text=Guardado confirmado por el servidor.')).toBeVisible();
    await expect(page.getByTestId('save-list')).toContainText('Punto E2E ruta B');
    // El contador se actualiza al guardar (antes quedaba obsoleto en 0 / 10).
    await expect(page.locator('text=Manuales: 1 / 10')).toBeVisible();
    await page.keyboard.press('Escape');
    // Avanzar y reanudar: el reloj vuelve a 30.
    await travelTo(page, 'paris', 210);
    await page.click('button:has-text("Guardados")');
    await page.locator('[data-testid^="load-"]').first().click();
    await expect(page.getByTestId('load-confirm')).toBeVisible();
    await page.getByTestId('load-confirm-button').click();
    await expect(page.getByTestId('clock')).toContainText('30 min');
    // Borrar el guardado: el contador vuelve a 0 / 10.
    await page.getByRole('button', { name: 'Borrar' }).click();
    await expect(page.locator('text=Manuales: 0 / 10')).toBeVisible();
    await expect(page.locator('text=Sin guardados manuales.')).toBeVisible();
    await page.keyboard.press('Escape');
    // Continuar la ruta B desde el punto guardado.
    await travelTo(page, 'paris', 210);
    await playOffer(page, 'offer-query:firma-sello', 210);
    await playOffer(page, 'offer-wait:30', 240);
    await travelTo(page, 'lisboa', 390);
    await playOffer(page, 'offer-query:custodia-envio', 390);
    await playOffer(page, 'offer-wait:30', 420);
    await playOffer(page, 'offer-request_warrant:ines', 420);
    await playOffer(page, 'offer-wait:30', 450);
    await playOffer(page, 'offer-talk:ines:identidad', 450);
    await playOffer(page, 'offer-detain:ines', 480);
    await playOffer(page, 'offer-recover:astrolabio-original', 500);
    await closeCase(page);
    // Informe final a pantalla entera, en español: resultado y motivo
    // traducidos, objetivos como frases (antes: `complete`, `finished`,
    // `obj-detener`…).
    const report = page.getByTestId('report-full');
    await expect(report).toContainText('Resultado: completado');
    await expect(report).toContainText('Motivo: finalizado');
    await expect(report).toContainText('Detener a Inés con orden válida');
    await expect(report).toContainText('Recuperar el astrolabio original');
    await expect(report).not.toContainText('obj-detener');
    await expect(report).not.toContainText('obj-recuperar');
    await expect(report).not.toContainText('complete ·');
    await expect(report).not.toContainText('finished');
    await expect(report).toContainText('La verdad del caso');
    await expect(report).toContainText('Responsable: Inés Valera');
    await expect(report).toContainText('Inés Valera — correcta · con orden');
    // «Ver la partida» vuelve al layout en modo solo lectura.
    await page.getByTestId('report-view-run').click();
    await expect(page.getByTestId('game-screen')).toBeVisible();
    await expect(page.getByTestId('run-state')).toContainText('Partida cerrada');
  });

  test('Teclado: Enter en una oferta ejecuta en un clic y Escape cierra el diálogo', async ({ page }) => {
    await openGameScreen(page);
    // Tab/Enter: enfocar una oferta barata y ejecutar con Enter, sin diálogo.
    await page.getByTestId('offer-inspect:MAD-SALA').focus();
    await expect(page.getByTestId('offer-inspect:MAD-SALA')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('clock')).toContainText('10 min');
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    await page.getByTestId('offer-inspect:MAD-SALA:cerradura').focus();
    await expect(page.getByTestId('offer-inspect:MAD-SALA:cerradura')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('clock')).toContainText('30 min');
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    // Enter en un viaje (caro) abre el diálogo; Escape lo cancela y devuelve
    // el foco a la oferta.
    await page.getByTestId('offer-travel:paris').focus();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('preview-dialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    await expect(page.getByTestId('offer-travel:paris')).toBeFocused();
  });

  test('Feedback visible: hablar abre el chat con respuesta e inspeccionar muestra el hallazgo', async ({ page }) => {
    await openGameScreen(page);
    // La pista de cómo se juega está visible al empezar, en la consola.
    await expect(page.locator('.game-console')).toContainText('La investigación comienza. Inspecciona la escena o elige una acción.');
    // Hablar con Tomás: la conversación se abre sola con su saludo.
    await playOffer(page, 'offer-talk:tomas:identidad', 0);
    const chat = page.getByTestId('chat-turns');
    await expect(chat).toBeVisible();
    await expect(chat).toContainText('Soy Tomás Ríos, transportista');
    // Preguntar en el chat: la respuesta del personaje se ve como burbuja.
    await page.getByTestId('chat-input').fill('¿qué hiciste con la caja?');
    await page.getByTestId('chat-send').click();
    await expect(chat).toContainText('caja vacía', { timeout: 15000 });
    await page.keyboard.press('Escape');
    // Inspeccionar: el resultado se ve en la consola, no solo en el dossier.
    await playOffer(page, 'offer-inspect:MAD-SALA', 10);
    await expect(page.locator('.game-console')).toContainText('La caja está a la vista. Su etiqueta remite al archivo de París.');
    // Recoger: la consola narra el hallazgo con su texto, nunca el ID crudo.
    await playOffer(page, 'offer-inspect:MAD-SALA:cerradura', 30);
    await playOffer(page, 'offer-collect:EV-02', 30);
    await expect(page.locator('.game-console')).toContainText('Recogido: La cerradura de la vitrina tiene residuo de herramienta.');
    await expect(page.locator('.game-console')).not.toContainText('Objeto EV-02 recogido.');
    // El dossier muestra los hallazgos con texto legible, no IDs crudos.
    await page.click('button:has-text("Dossier")');
    const dossier = page.getByTestId('dock-panel-dossier');
    await expect(dossier).toContainText('La caja está a la vista');
    await expect(dossier).not.toContainText('EV-01');
    await expect(dossier).toContainText('Hablaste con Tomás Ríos (min 0).');
  });

  test('Jugabilidad lote 1: acciones en la escena, fondo por ciudad, animación de viaje y reloj de arena', async ({ page }) => {
    await openGameScreen(page);
    // Acciones visibles en la escena: los NPC presentes con su rol y lo inspeccionable.
    await expect(page.locator('.game-scene')).toContainText('Tomás Ríos · Transportista');
    await expect(page.locator('.game-scene')).toContainText('Lucía · Asistente de investigación');
    await expect(page.getByTestId('offer-talk:tomas:identidad')).toBeVisible();
    await expect(page.getByTestId('offer-inspect:MAD-SALA')).toBeVisible();
    // Fondo de Madrid al empezar.
    await expect(page.getByTestId('scene-art')).toHaveAttribute('data-location', 'MAD-SALA');
    // Inspeccionar: el reloj de arena se ve de verdad, en la cabecera y en
    // la escena (arreglo: antes era un icono de 18 px de una sola pasada).
    // Inspeccionar es barato (lote 2): un clic, sin diálogo de confirmación.
    await page.getByTestId('offer-inspect:MAD-SALA').click();
    await expect(page.getByTestId('clock')).toContainText('10 min');
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    await expect(page.getByTestId('hourglass')).toBeVisible();
    await expect(page.getByTestId('hourglass')).toContainText('+10 min');
    await expect(page.getByTestId('hourglass-scene')).toBeVisible();
    await expect(page.getByTestId('hourglass-scene')).toContainText('El reloj avanza 10 min');
    // Viajar desde la escena (rediseño Norte, fase 3): la transición
    // precede al cambio de escena — primero se ve «Viajando a París» con
    // la ruta y los minutos descontando, y la escena sigue en Madrid
    // hasta que termina.
    await page.getByTestId('offer-travel:paris').click();
    await expect(page.getByTestId('preview-dialog')).toBeVisible();
    await expect(page.getByTestId('preview-dialog')).toContainText('Viaje a París');
    await page.getByTestId('preview-confirm').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    await expect(page.getByTestId('travel-animation')).toBeVisible();
    await expect(page.getByTestId('travel-animation')).toContainText('Viajando a París');
    await expect(page.getByTestId('travel-animation')).toContainText('Madrid → París · 180 min');
    // Sin botones: la transición es solo visual y se cierra sola.
    await expect(page.getByTestId('travel-animation').getByRole('button')).toHaveCount(0);
    // La ruta se dibuja también en el mapa del dock.
    await page.click('button:has-text("Mapa")');
    await expect(page.locator('.game-atlas-route-live')).toBeVisible();
    await expect(page.locator('.game-atlas-travel-dot')).toBeVisible();
    // Al terminar, la escena ya es París y el reloj descontó el viaje.
    await expect(page.getByTestId('travel-animation')).toBeHidden();
    await expect(page.getByTestId('hourglass')).toBeVisible();
    await expect(page.getByTestId('hourglass')).toContainText('+180 min');
    await expect(page.getByTestId('scene-art')).toHaveAttribute('data-location', 'PAR-ARCH');
    await expect(page.getByTestId('clock')).toContainText('190 min');
    // La consola narra el viaje con frase (origen → destino), nunca con la
    // clave cruda del motor (arreglo: antes enseñaba `travel:paris`).
    await expect(page.locator('.game-console')).toContainText('Sales de Madrid y llegas a París.');
    await expect(page.locator('.game-console')).not.toContainText('travel:paris');
    // En París, la escena muestra a Émile y el archivo.
    await expect(page.locator('.game-scene')).toContainText('Émile · Archivo de conservación');
    await expect(page.getByTestId('offer-inspect:PAR-ARCH')).toBeVisible();
  });

  test('Jugabilidad lote 2: objetivos visibles y un clic para lo barato, diálogo para viajar', async ({ page }) => {
    await openGameScreen(page);
    // Objetivos siempre visibles, los dos pendientes al empezar.
    const objectives = page.getByTestId('objectives-panel');
    await expect(objectives).toBeVisible();
    await expect(objectives).toContainText('Detener a Inés con orden válida');
    await expect(objectives).toContainText('Recuperar el astrolabio original');
    await expect(page.getByTestId('objective-obj-detener')).toHaveAttribute('data-achieved', 'false');
    await expect(page.getByTestId('objective-obj-recuperar')).toHaveAttribute('data-achieved', 'false');
    // Inspeccionar es barato: un clic, sin diálogo, y el reloj avanza.
    await page.getByTestId('offer-inspect:MAD-SALA').click();
    await expect(page.getByTestId('clock')).toContainText('10 min');
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    // Hablar también va en un clic y abre la conversación.
    await page.getByTestId('offer-talk:tomas:identidad').click();
    await expect(page.getByTestId('chat-turns')).toBeVisible();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    await page.keyboard.press('Escape');
    // Viajar es caro (180 min): sigue pidiendo confirmación.
    await page.getByTestId('offer-travel:paris').click();
    await expect(page.getByTestId('preview-dialog')).toBeVisible();
    await expect(page.getByTestId('preview-dialog')).toContainText('Viaje a París');
    await page.getByTestId('preview-confirm').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    await expect(page.getByTestId('clock')).toContainText('190 min');
    // El panel sigue visible en la otra ciudad, con los objetivos pendientes.
    await expect(objectives).toBeVisible();
    await expect(page.getByTestId('objective-obj-detener')).toHaveAttribute('data-achieved', 'false');
    await expect(page.getByTestId('objective-obj-recuperar')).toHaveAttribute('data-achieved', 'false');
  });

  // Los dos tests de Ajustes comparten el perfil local de desarrollo y el
  // proveedor efectivo: en serie para que uno no vea activa la conexión del
  // otro (ni deje una conexión activa que cambie la interpretación en el
  // resto de tests).
  test.describe('Ajustes de IA', () => {
    test.describe.configure({ mode: 'serial' });

    test('Ajustes de IA: crear conexión Ollama, verla como efectiva y borrarla', async ({ page }) => {
    await openGameScreen(page);
    await page.click('button:has-text("Ajustes")');
    await expect(page.getByTestId('settings-ai-effective')).toContainText('Mock determinista');
    await page.getByTestId('ai-connection-adapter').selectOption('ollama');
    await page.getByTestId('ai-connection-name').fill('Ollama E2E');
    await page.getByTestId('ai-connection-model').fill('llama3.1:8b');
    await page.getByTestId('ai-connection-save').click();
    await expect(page.locator('text=Conexión guardada y activada.')).toBeVisible();
    await expect(page.getByTestId('ai-connections-list')).toContainText('Ollama E2E');
    await expect(page.getByTestId('settings-ai-effective')).toContainText('Ollama E2E');
    await page.getByRole('button', { name: 'Borrar Ollama E2E' }).click();
    await expect(page.getByTestId('ai-connections-list')).not.toContainText('Ollama E2E');
    await expect(page.getByTestId('settings-ai-effective')).toContainText('Mock determinista');
    await page.keyboard.press('Escape');
  });

  test('Ajustes de IA: el formulario trae valores prerrellenados y borrar limpia el mensaje', async ({ page }) => {
    await openGameScreen(page);
    await page.click('button:has-text("Ajustes")');
    await expect(page.getByTestId('settings-ai-effective')).toContainText('Mock determinista');
    // Sin teclear nada: nombre, URL y modelo ya están en el formulario.
    await expect(page.getByTestId('ai-connection-name')).toHaveValue('Mi Ollama');
    await expect(page.getByTestId('ai-connection-base-url')).toHaveValue('http://127.0.0.1:11434');
    await expect(page.getByTestId('ai-connection-model')).toHaveValue('llama3.1:8b');
    await page.getByTestId('ai-connection-save').click();
    await expect(page.locator('text=Conexión guardada y activada.')).toBeVisible();
    await expect(page.getByTestId('ai-connections-list')).toContainText('Mi Ollama');
    await expect(page.getByTestId('settings-ai-effective')).toContainText('Mi Ollama');
    await page.getByRole('button', { name: 'Borrar Mi Ollama' }).click();
    await expect(page.getByTestId('ai-connections-list')).not.toContainText('Mi Ollama');
    await expect(page.getByTestId('settings-ai-effective')).toContainText('Mock determinista');
    // El mensaje de éxito no queda obsoleto tras borrar.
    await expect(page.locator('text=Conexión guardada y activada.')).toBeHidden();
    await page.keyboard.press('Escape');
  });
  });
});
