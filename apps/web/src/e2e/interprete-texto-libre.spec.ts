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

/** Pulsa una oferta y espera el reloj en `minute`. Las acciones costosas o
 * irreversibles (viajar, detener, recuperar, pedir orden, cerrar) enseñan
 * el diálogo de confirmación; las baratas se ejecutan en el mismo clic. */
async function playOffer(page: Page, testId: string, minute: number) {
  const needsDialog = /offer-(travel|detain|recover|request_warrant|finish)/.test(testId);
  await page.getByTestId(testId).click();
  if (needsDialog) {
    await expect(page.getByTestId('preview-dialog')).toBeVisible();
    await page.getByTestId('preview-confirm').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
  }
  await expect(page.getByTestId('clock')).toContainText(`${minute} min`);
  if (!needsDialog) await expect(page.getByTestId('preview-dialog')).toBeHidden();
}

/** Viaja desde la ventana del mapa: abre Mapa, pulsa Viajar, confirma y cierra la ventana. */
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
  await page.keyboard.press('Escape');
  await expect(page.getByTestId(`travel-${cityId}`)).toBeHidden();
}

/** Escribe una orden libre y la envía. */
async function freeOrder(page: Page, text: string) {
  await page.getByTestId('order-input').fill(text);
  await page.getByTestId('order-submit').click();
}

/** La aclaración visible tras una orden libre bloqueada o ambigua. */
function clarification(page: Page) {
  const dialog = page.locator('.game-clarification');
  return dialog;
}

/** Cierra la aclaración con su botón «Entendido». */
async function dismissClarification(page: Page) {
  await page.locator('.game-clarification').getByRole('button', { name: 'Entendido, la reviso' }).click();
  await expect(page.locator('.game-clarification')).toBeHidden();
}

/** Juega hasta París y consulta HV-17: con EV-03+EV-04 la orden contra
 * Inés ya se puede pedir (la misma ruta del spec de detenciones). */
async function reachWarrantOffer(page: Page) {
  await playOffer(page, 'offer-inspect:MAD-SALA', 10);
  await playOffer(page, 'offer-inspect:MAD-SALA:cerradura', 30);
  await playOffer(page, 'offer-collect:EV-02', 30);
  await page.getByTestId('open-lab').click();
  await page.getByTestId('offer-analyze:EV-02').click();
  await expect(page.getByTestId('clock')).toContainText('30 min');
  await page.keyboard.press('Escape');
  await travelTo(page, 'paris', 210);
  await playOffer(page, 'offer-query:herramienta-hv17', 210);
}

/** Elige un idioma en Ajustes (el botón se busca por testid porque su texto
 * cambia con el idioma). */
async function chooseLanguage(page: Page, lang: 'es' | 'en' | 'fr') {
  await page.getByTestId('toolbar-settings').click();
  const selector = page.getByTestId('settings-language');
  await expect(selector).toBeVisible();
  await selector.selectOption(lang);
  await expect(selector).toHaveValue(lang);
  await page.keyboard.press('Escape');
}

test.describe('E2E - Intérprete de texto libre (lecturas raras)', () => {
  test('pedir orden o detener al principio aclara qué falta, sin cerrar el caso ni hablar (casos 3 y 4)', async ({ page }) => {
    await openGameScreen(page);
    await freeOrder(page, 'Solicitar orden de detención');
    const dialog = clarification(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Todavía no puedes pedir una orden');
    await expect(dialog).toContainText('Te faltan pruebas que autoricen la orden');
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    await dismissClarification(page);
    await freeOrder(page, 'Detener a Inés Valera');
    await expect(clarification(page)).toBeVisible();
    await expect(clarification(page)).toContainText('Todavía no puedes detener a Inés Valera');
    await expect(clarification(page)).toContainText('Primero necesitas una orden válida');
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
  });

  test('pedir orden tras HV-17 en París abre la oferta de solicitar orden, no cerrar el caso (caso grave 1)', async ({ page }) => {
    await openGameScreen(page);
    await reachWarrantOffer(page);
    await freeOrder(page, 'Solicitar orden de detención');
    const preview = page.getByTestId('preview-dialog');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('Solicitar orden contra Inés Valera');
    await expect(preview).not.toContainText('Cerrar el caso');
    await page.getByTestId('preview-cancel').click();
    await expect(preview).toBeHidden();
    await freeOrder(page, 'Quiero pedir una orden para detener a Inés');
    await expect(page.getByTestId('preview-dialog')).toBeVisible();
    await expect(page.getByTestId('preview-dialog')).toContainText('Solicitar orden contra Inés Valera');
    await page.getByTestId('preview-cancel').click();
  });

  test('con la orden en curso y concedida, pedir otra lo dice; coordinar la detención detiene de verdad (casos 1 y 2)', async ({ page }) => {
    await openGameScreen(page);
    await reachWarrantOffer(page);
    await playOffer(page, 'offer-query:traslado-ines', 210);
    await playOffer(page, 'offer-wait:30', 240);
    await playOffer(page, 'offer-request_warrant:ines', 240);
    await freeOrder(page, 'Solicitar una orden');
    await expect(clarification(page)).toBeVisible();
    await expect(clarification(page)).toContainText('La orden está en curso');
    await dismissClarification(page);
    await playOffer(page, 'offer-wait:30', 270);
    await freeOrder(page, 'Solicitar una orden');
    await expect(clarification(page)).toBeVisible();
    await expect(clarification(page)).toContainText('Ya tienes la orden');
    await dismissClarification(page);
    await freeOrder(page, 'Coordinar la detención de Inés Valera');
    const preview = page.getByTestId('preview-dialog');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('Coordinar la detención de Inés Valera con las autoridades');
    await expect(preview).not.toContainText('Solicitar orden');
    await page.getByTestId('preview-confirm').click();
    await expect(preview).toBeHidden();
    await expect(page.getByTestId('clock')).toContainText('300 min');
    const console = page.locator('.game-console');
    await expect(console).toContainText('Las autoridades han detenido a Inés Valera por orden de A.C.M.E. El caso sigue abierto.');
    await expect(page.getByTestId('objective-obj-detener')).toHaveAttribute('data-achieved', 'true');
  });

  test('cerrar el caso con texto libre sigue funcionando', async ({ page }) => {
    await openGameScreen(page);
    await freeOrder(page, 'Cerrar el caso');
    const preview = page.getByTestId('preview-dialog');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('Cerrar el caso y presentar el informe');
    await page.getByTestId('preview-cancel').click();
    await expect(preview).toBeHidden();
    await expect(page.getByTestId('clock')).toContainText('0 min');
  });

  test('en inglés, pedir orden al principio aclara en inglés qué falta', async ({ page }) => {
    await openGameScreen(page);
    await chooseLanguage(page, 'en');
    await freeOrder(page, 'Request a warrant');
    await expect(clarification(page)).toBeVisible();
    await expect(clarification(page)).toContainText('You cannot request a warrant yet');
    await expect(clarification(page)).toContainText('You still lack evidence authorizing the warrant');
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
  });
});
