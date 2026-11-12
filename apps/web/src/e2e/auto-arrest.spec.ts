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
}

/** Pulsa una oferta y espera el reloj en `minute`. Las acciones costosas o
 * irreversibles (viajar, detener, recuperar, pedir orden, cerrar) enseñan
 * el diálogo de confirmación; las baratas se ejecutan en el mismo clic. */
async function playOffer(page: Page, testId: string, minute: number) {
  const needsDialog = /offer-(travel|detain|recover|request_warrant)/.test(testId);
  await page.getByTestId(testId).click();
  if (needsDialog) {
    await expect(page.getByTestId('preview-dialog')).toBeVisible();
    await page.getByTestId('preview-confirm').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
  }
  await expect(page.getByTestId('clock')).toContainText(`${minute} min`);
  if (!needsDialog) await expect(page.getByTestId('preview-dialog')).toBeHidden();
}

/** Viaja desde la pestaña Mapa del dock: abre Mapa, pulsa Viajar y confirma. */
async function travelTo(page: Page, cityId: string, minute: number) {
  await page.click('button:has-text("Mapa")');
  await page.getByTestId(`travel-${cityId}`).click();
  await expect(page.getByTestId('preview-dialog')).toBeVisible();
  await page.getByTestId('preview-confirm').click();
  await expect(page.getByTestId('preview-dialog')).toBeHidden();
  await expect(page.getByTestId('clock')).toContainText(`${minute} min`);
  // El aviso de viaje no se cierra solo: hay que pulsar «Seguir».
  await page.getByTestId('travel-animation').getByRole('button', { name: 'Seguir' }).click();
  await expect(page.getByTestId('travel-animation')).toBeHidden();
  await expect(page.getByTestId(`travel-${cityId}`)).toBeHidden();
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

test.describe('E2E - Detenciones automáticas (GDD §12)', () => {
  // Rediseño Norte, fase 2: la vía EV-03 vuelve a existir — el análisis
  // de EV-02 vive en su ficha del Dossier — y el cierre es el informe a
  // pantalla entera (el diálogo «Informe final» ya no existe).
  test('coordinar la detención desde París sin viajar a Lisboa: aviso, objetivo e informe', async ({ page }) => {
    await openGameScreen(page);
    await playOffer(page, 'offer-inspect:MAD-SALA', 10);
    await playOffer(page, 'offer-inspect:MAD-SALA:cerradura', 30);
    await playOffer(page, 'offer-collect:EV-02', 30);
    // El análisis de EV-02 vive en su ficha del Dossier: cuesta 0 y
    // madura al viajar a París.
    await page.click('button:has-text("Dossier")');
    await expect(page.getByTestId('offer-analyze:EV-02')).toContainText('Analizar huellas y marcas · 90 min');
    await page.getByTestId('offer-analyze:EV-02').click();
    await expect(page.getByTestId('clock')).toContainText('30 min');
    await travelTo(page, 'paris', 210);
    await playOffer(page, 'offer-query:herramienta-hv17', 210);
    await playOffer(page, 'offer-query:traslado-ines', 210);
    await playOffer(page, 'offer-wait:30', 240);
    await playOffer(page, 'offer-request_warrant:ines', 240);
    await playOffer(page, 'offer-wait:30', 270);
    // La orden ha madurado en París y la ubicación de Inés ya se conoce
    // (EV-05, el traslado): la orden es la que la identifica, así que la
    // oferta de coordinar la detención está disponible SIN viajar a
    // Lisboa ni hablar con ella.
    // (Fase 4 del rediseño A2: la etiqueta vive en la tarjeta; el botón
    // lleva solo el verbo «Detener →».)
    const detainCard = page.getByTestId('offer-card-detain:ines');
    await expect(detainCard).toBeVisible();
    await expect(detainCard).toContainText('Coordinar la detención de Inés Valera con las autoridades');
    // El diálogo de confirmación explica el modo: 30 min de coordinación,
    // actúan las autoridades.
    const detain = page.getByTestId('offer-detain:ines');
    await detain.click();
    const preview = page.getByTestId('preview-dialog');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('Coordinar la detención de Inés Valera con las autoridades');
    await expect(preview).toContainText('30 minutos estimados');
    await page.getByTestId('preview-confirm').click();
    await expect(preview).toBeHidden();
    await expect(page.getByTestId('clock')).toContainText('300 min');
    // Aviso claro en la consola y objetivo logrado sin moverse de París.
    // Los objetivos viven en la pestaña Dossier del dock.
    const console = page.locator('.game-console');
    await expect(console).toContainText('Las autoridades han detenido a Inés Valera por orden de A.C.M.E. El caso sigue abierto.');
    await page.click('button:has-text("Dossier")');
    await expect(page.getByTestId('objective-obj-detener')).toHaveAttribute('data-achieved', 'true');
    // Viajar a Lisboa a recuperar el astrolabio y cerrar: 470 min en total.
    await travelTo(page, 'lisboa', 450);
    await playOffer(page, 'offer-recover:astrolabio-original', 470);
    await page.click('button:has-text("Dossier")');
    await expect(page.getByTestId('objective-obj-recuperar')).toHaveAttribute('data-achieved', 'true');
    await closeCase(page);
    const report = page.getByTestId('report-full');
    await expect(report).toContainText('Resultado: completado');
    await expect(report).toContainText('Inés Valera — correcta · con orden');
    await expect(report).toContainText('Detención correcta: +15');
    await expect(report).toContainText('Total: 87 / 100');
  });
});
