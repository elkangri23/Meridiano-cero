import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Crea una partida desde la UI del archivo; la creación confirmada navega sola a su pantalla de juego. */
async function openGameScreen(page: Page) {
  await page.goto('/');
  await page.waitForSelector('#root > *', { timeout: 10000 });
  await page.click('button:has-text("Entrar en desarrollo local")');
  const creation = page.locator('.archive-create').first();
  await expect(creation.getByRole('heading', { name: 'Nueva partida' })).toBeVisible();
  await creation.getByRole('radio', { name: 'Robo internacional', exact: true }).check();
  await creation.getByRole('button', { name: 'Empezar partida' }).click();
  await page.waitForSelector('[data-testid="game-screen"]', { timeout: 10000 });
  await expect(page.getByTestId('clock')).toContainText('0 min');
}

/** Pulsa una oferta, confirma el diálogo de preview y espera el reloj en `minute`. */
async function playOffer(page: Page, testId: string, minute: number) {
  await page.getByTestId(testId).click();
  await expect(page.getByTestId('preview-dialog')).toBeVisible();
  await page.getByTestId('preview-confirm').click();
  await expect(page.getByTestId('preview-dialog')).toBeHidden();
  await expect(page.getByTestId('clock')).toContainText(`${minute} min`);
}

/** Viaja desde la ventana del mapa: abre Mapa, pulsa Viajar, confirma y cierra la ventana. */
async function travelTo(page: Page, cityId: string, minute: number) {
  await page.click('button:has-text("Mapa")');
  await page.getByTestId(`travel-${cityId}`).click();
  await expect(page.getByTestId('preview-dialog')).toBeVisible();
  await page.getByTestId('preview-confirm').click();
  await expect(page.getByTestId('preview-dialog')).toBeHidden();
  await expect(page.getByTestId('clock')).toContainText(`${minute} min`);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId(`travel-${cityId}`)).toBeHidden();
}

test.describe('E2E T3-05 - Pantalla de juego', () => {
  test('Ruta A completa (455 min): inspeccionar, recoger, analizar, viajar, consultar, orden, detener, recuperar y cerrar', async ({ page }) => {
    await openGameScreen(page);
    await playOffer(page, 'offer-inspect:MAD-SALA', 10);
    await playOffer(page, 'offer-inspect:MAD-SALA:cerradura', 30);
    await playOffer(page, 'offer-collect:EV-02', 30);
    await playOffer(page, 'offer-analyze:EV-02', 30);
    await travelTo(page, 'paris', 210);
    await playOffer(page, 'offer-query:herramienta-hv17', 210);
    await playOffer(page, 'offer-query:traslado-ines', 210);
    await playOffer(page, 'offer-wait:30', 240);
    await playOffer(page, 'offer-request_warrant:ines', 240);
    await playOffer(page, 'offer-wait:30', 270);
    await travelTo(page, 'lisboa', 420);
    await playOffer(page, 'offer-talk:ines:identidad', 420);
    await playOffer(page, 'offer-detain:ines', 435);
    await playOffer(page, 'offer-recover:astrolabio-original', 455);
    await playOffer(page, 'offer-finish', 455);
    await expect(page.getByTestId('clock')).toContainText('Cerrada');
    // Partida cerrada: Guardados explica por qué no se puede guardar ni cargar.
    await page.click('button:has-text("Guardados")');
    await expect(page.getByTestId('save-closed-notice')).toBeVisible();
    await expect(page.getByTestId('save-closed-notice')).toContainText('No se pueden crear guardados nuevos ni cargar uno anterior');
    await expect(page.getByTestId('save-create')).toBeDisabled();
    await expect(page.locator('text=Manuales: 0 / 10')).toBeVisible();
    await page.keyboard.press('Escape');
    // Informe final disponible en la ventana correspondiente.
    await page.click('button:has-text("Informe final")');
    await expect(page.locator('text=Resultado:')).toBeVisible();
  });

  test('Ruta B completa (485 min) con guardar y reanudar a mitad de ruta', async ({ page }) => {
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
    await playOffer(page, 'offer-detain:ines', 465);
    await playOffer(page, 'offer-recover:astrolabio-original', 485);
    await playOffer(page, 'offer-finish', 485);
    await expect(page.getByTestId('clock')).toContainText('Cerrada');
  });

  test('Teclado: Enter en una oferta, Escape cierra el diálogo y Ctrl+Enter envía la orden en texto libre', async ({ page }) => {
    await openGameScreen(page);
    // Tab/Enter: enfocar la primera oferta y confirmar con Enter.
    await page.getByTestId('offer-inspect:MAD-SALA').focus();
    await expect(page.getByTestId('offer-inspect:MAD-SALA')).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('preview-dialog')).toBeVisible();
    // Escape cancela el diálogo y devuelve el foco a la oferta.
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    await expect(page.getByTestId('offer-inspect:MAD-SALA')).toBeFocused();
    // Ctrl+Enter en la orden en texto libre: el mock interpreta la primera oferta.
    await page.getByTestId('order-input').fill('inspecciona la sala con cuidado');
    await page.keyboard.press('Control+Enter');
    await expect(page.getByTestId('preview-dialog')).toBeVisible();
    await expect(page.getByTestId('preview-dialog')).toContainText('Inspeccionar');
    await page.getByTestId('preview-confirm').click();
    await expect(page.getByTestId('clock')).toContainText('10 min');
  });

  test('Feedback visible: hablar abre el chat con respuesta e inspeccionar muestra el hallazgo', async ({ page }) => {
    await openGameScreen(page);
    // La pista de cómo se juega está visible al empezar.
    await expect(page.locator('text=Tras cada acción el resultado aparece en la consola.')).toBeVisible();
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
    // El dossier muestra los hallazgos con texto legible, no IDs crudos.
    await page.click('button:has-text("Dossier")');
    const dossier = page.locator('.game-window-body');
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
    // Viajar desde la escena: animación de viaje, fondo de París y reloj de arena.
    await page.getByTestId('offer-travel:paris').click();
    await expect(page.getByTestId('preview-dialog')).toBeVisible();
    await page.getByTestId('preview-confirm').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    await expect(page.getByTestId('travel-animation')).toBeVisible();
    await expect(page.getByTestId('travel-animation')).toContainText('De Madrid a París');
    await expect(page.getByTestId('hourglass')).toBeVisible();
    await expect(page.getByTestId('hourglass')).toContainText('+180 min');
    await expect(page.getByTestId('scene-art')).toHaveAttribute('data-location', 'PAR-ARCH');
    await expect(page.getByTestId('clock')).toContainText('180 min');
    await expect(page.getByTestId('travel-animation')).toBeHidden({ timeout: 10000 });
    // En París, la escena muestra a Émile y el archivo.
    await expect(page.locator('.game-scene')).toContainText('Émile · Archivo de conservación');
    await expect(page.getByTestId('offer-inspect:PAR-ARCH')).toBeVisible();
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
