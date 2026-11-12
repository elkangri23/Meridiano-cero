import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Rediseño Norte, fase 1: el campo de órdenes en texto libre ya no
 * existe — las acciones se hacen solo con las tarjetas de la escena y
 * del equipo. Este archivo afirma esa ausencia y juega un flujo completo
 * por tarjetas hasta la orden por la vía alternativa (ruta B). La lógica
 * del intérprete sigue cubierta por los unitarios
 * (`interpret-clarification.test.ts`); el código del intérprete queda sin
 * uso en el cliente, por si vuelve algún día. */

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
 * irreversibles enseñan el diálogo de confirmación; las baratas se ejecutan
 * en el mismo clic. */
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
  await expect(page.getByTestId(`travel-${cityId}`)).toBeHidden();
}

test.describe('E2E - Sin texto libre: todo por tarjetas (rediseño Norte)', () => {
  test('no hay campo de órdenes en texto libre ni botón de enviar', async ({ page }) => {
    await openGameScreen(page);
    await expect(page.getByTestId('order-input')).toHaveCount(0);
    await expect(page.getByTestId('order-submit')).toHaveCount(0);
    // Las acciones de la escena siguen ahí, como tarjetas con su verbo.
    await expect(page.getByTestId('offer-inspect:MAD-SALA')).toBeVisible();
    await expect(page.getByTestId('offer-talk:tomas:identidad')).toBeVisible();
    await expect(page.getByTestId('offer-travel:paris')).toBeVisible();
  });

  test('flujo por tarjetas hasta la orden por la vía alternativa (ruta B): consulta, orden, detención', async ({ page }) => {
    await openGameScreen(page);
    await playOffer(page, 'offer-inspect:MAD-SALA', 10);
    await playOffer(page, 'offer-inspect:MAD-SALA:caja', 30);
    await playOffer(page, 'offer-collect:EV-06', 30);
    await travelTo(page, 'paris', 210);
    await playOffer(page, 'offer-query:firma-sello', 210);
    await playOffer(page, 'offer-wait:30', 240);
    await travelTo(page, 'lisboa', 390);
    await playOffer(page, 'offer-query:custodia-envio', 390);
    await playOffer(page, 'offer-wait:30', 420);
    await playOffer(page, 'offer-request_warrant:ines', 420);
    // La orden está en curso: la oferta de pedirla ya no aparece.
    await expect(page.getByTestId('offer-request_warrant:ines')).toHaveCount(0);
    await playOffer(page, 'offer-wait:30', 450);
    // La orden está concedida: hablar con Inés y coordinar la detención
    // detiene de verdad.
    await playOffer(page, 'offer-talk:ines:identidad', 450);
    await expect(page.getByTestId('offer-detain:ines')).toBeVisible();
    await playOffer(page, 'offer-detain:ines', 480);
    const console = page.locator('.game-console');
    await expect(console).toContainText('Las autoridades han detenido a Inés Valera por orden de A.C.M.E. El caso sigue abierto.');
    await expect(page.getByTestId('objective-obj-detener')).toHaveAttribute('data-achieved', 'true');
  });
});
