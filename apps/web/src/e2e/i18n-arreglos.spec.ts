import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Arreglos tras la verificación de la traducción i18n (2026-11-09):
 * nota de idioma falsa, residuos en español en Ajustes, «clos un dossier»
 * y la tarjeta de hallazgo vacía. El archivo tiene una entrada local por
 * prueba: la API de desarrollo limita la entrada local a 10 intentos por
 * IP y minuto. */

/** Crea una partida desde la UI del archivo; la creación confirmada navega
 * sola a su pantalla de juego. */
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
  await page.getByRole('button', { name: 'Entendido, a investigar' }).click();
}

/** Pulsa una oferta y espera el reloj en `minute`. Las acciones costosas o
 * irreversibles enseñan el diálogo de confirmación; las baratas se ejecutan
 * en el mismo clic. */
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

/** Ninguna tarjeta de hallazgo del dossier está vacía: cada una lleva
 * texto legible (no solo el título «Hallazgo» y el botón Leer). */
async function expectAllCardsWithText(page: Page) {
  const cards = await dossierCards(page);
  const count = await cards.count();
  expect(count).toBeGreaterThan(0);
  const texts = await cards.allInnerTexts();
  for (const [index, text] of texts.entries()) {
    const body = text.replace(/^(Hallazgo|Finding|Découverte)\s*/u, '').replace(/\s*(Leer|Read|Lire)\s*$/u, '').trim();
    expect(body.length, `tarjeta ${index}: «${text}»`).toBeGreaterThan(10);
  }
  await page.keyboard.press('Escape');
}

/** Abre el dossier y devuelve sus tarjetas de hallazgo. */
async function dossierCards(page: Page) {
  await page.getByTestId('toolbar-dossier').click();
  const dossier = page.getByRole('dialog', { name: 'Dossier' });
  await expect(dossier).toBeVisible();
  return dossier.locator('.game-evidence-card');
}

test.describe('E2E arreglos i18n', () => {
  test('la tarjeta de hallazgo de la evidencia recogida muestra su texto (no vacía)', async ({ page }) => {
    await openGameScreen(page);
    await playOffer(page, 'offer-inspect:MAD-SALA', 10);
    await playOffer(page, 'offer-inspect:MAD-SALA:caja', 30);
    await playOffer(page, 'offer-collect:EV-06', 30);
    const cards = await dossierCards(page);
    // Hallazgos en orden: sala, caja a la vista, París conocida, EV-06.
    await expect(cards).toHaveCount(4);
    const texts = await cards.allInnerTexts();
    for (const text of texts) {
      expect(text.trim()).not.toBe('Hallazgo');
      expect(text.trim().length).toBeGreaterThan('Hallazgo'.length);
    }
    await expect(cards.nth(3)).toContainText('La caja guarda una copia del manifiesto, con sello y firma verificables.');
    await page.keyboard.press('Escape');
  });

  test('flujo completo con cambios de idioma: ninguna tarjeta del dossier queda vacía en ES, EN ni FR', async ({ page }) => {
    await openGameScreen(page);
    await playOffer(page, 'offer-inspect:MAD-SALA', 10);
    await playOffer(page, 'offer-inspect:MAD-SALA:caja', 30);
    await playOffer(page, 'offer-collect:EV-06', 30);
    // Hablar con Lucía (identidad) añade marcadores identity:/location: al dossier.
    await page.getByTestId('offer-talk:lucia:identidad').click();
    await expect(page.getByTestId('scene-chat')).toBeVisible();
    await expect(page.getByTestId('clock')).toContainText('30 min');
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('scene-chat')).toBeHidden();
    // Viajar a París añade travel:paris al dossier.
    await travelTo(page, 'paris', 210);
    // Dossier en español: 7 hallazgos, todos con texto.
    let cards = await dossierCards(page);
    await expect(cards).toHaveCount(7);
    await page.keyboard.press('Escape');
    // En inglés y en francés, tras cambiar el idioma, tampoco hay tarjetas vacías.
    await chooseLanguage(page, 'en');
    await expectAllCardsWithText(page);
    await chooseLanguage(page, 'fr');
    await expectAllCardsWithText(page);
    // Y al volver a español, la del manifiesto sigue con su texto.
    await chooseLanguage(page, 'es');
    cards = await dossierCards(page);
    await expect(cards.nth(3)).toContainText('La caja guarda una copia del manifiesto, con sello y firma verificables.');
    await page.keyboard.press('Escape');
  });

  test('la nota de idioma es correcta y Ajustes no deja residuos en español en EN ni FR', async ({ page }) => {
    await openGameScreen(page);
    await page.getByTestId('toolbar-settings').click();
    const settings = page.getByRole('dialog', { name: 'Ajustes' });
    await expect(settings).toBeVisible();
    const selector = page.getByTestId('settings-language');
    const palette = page.locator('select:has(option[value="protanopia"])');
    const providerForm = page.locator('form:has([data-testid="ai-connection-adapter"])');
    // Español: nota correcta y paletas en español.
    await expect(settings).toContainText('El idioma de la interfaz y del contenido del juego. Al cambiarlo, la partida se vuelve a cargar en ese idioma.');
    await expect(palette.locator('option[value="default"]')).toHaveText('Predeterminada');
    await expect(palette.locator('option[value="protanopia"]')).toHaveText('Protanopia (rojo-verde)');
    // Inglés: la nota ya no afirma que solo el español está traducido.
    await selector.selectOption('en');
    await expect(selector).toHaveValue('en');
    await expect(settings).toContainText('The language of the interface and the game content. Changing it reloads the run in that language.');
    await expect(settings).not.toContainText('only the Spanish interface is translated');
    await expect(palette.locator('option[value="default"]')).toHaveText('Default');
    await expect(palette.locator('option[value="protanopia"]')).toHaveText('Protanopia (red-green)');
    await expect(palette.locator('option[value="deuteranopia"]')).toHaveText('Deuteranopia (red-green)');
    await expect(palette.locator('option[value="tritanopia"]')).toHaveText('Tritanopia (blue-yellow)');
    await expect(page.getByTestId('ai-connection-adapter').locator('option[value="openai-compatible"]'))
      .toHaveText('OpenAI-compatible (LM Studio or other)');
    await page.getByTestId('ai-connection-adapter').selectOption('ollama');
    await expect(providerForm).toContainText('Only works on a home setup with Ollama on this machine.');
    await expect(providerForm).not.toContainText('Solo funciona en una instalación');
    // Francés: nota correcta, paletas y proveedor en francés.
    await selector.selectOption('fr');
    await expect(selector).toHaveValue('fr');
    await expect(settings).toContainText('La langue de l\'interface et du contenu du jeu. En la changeant, la partie se recharge dans cette langue.');
    await expect(settings).not.toContainText('seule l\'interface en espagnol est traduite');
    await expect(palette.locator('option[value="default"]')).toHaveText('Par défaut');
    await expect(palette.locator('option[value="protanopia"]')).toHaveText('Protanopie (rouge-vert)');
    await expect(page.getByTestId('ai-connection-adapter').locator('option[value="openai-compatible"]'))
      .toHaveText('OpenAI-compatible (LM Studio ou autre)');
    await page.getByTestId('ai-connection-adapter').selectOption('ollama');
    await expect(providerForm).toContainText('Fonctionne uniquement sur une installation à domicile avec Ollama sur cet ordinateur.');
    await expect(providerForm).not.toContainText('Solo funciona en una instalación');
    await page.keyboard.press('Escape');
  });

  test('la evaluación de carrera en francés dice «clôture un dossier», no «clos un dossier»', async ({ page }) => {
    await openGameScreen(page);
    await chooseLanguage(page, 'fr');
    await page.getByTestId('toolbar-team').click();
    await expect(page.getByRole('dialog', { name: 'Équipe A.C.M.E.' })).toBeVisible();
    await page.getByTestId('team-evaluate').click();
    await expect(page.getByTestId('team-turns')).toContainText('clôture un dossier');
    await expect(page.getByTestId('team-turns')).not.toContainText('clos un dossier');
    await page.keyboard.press('Escape');
  });

  test('la prosa de los casos usa la grafía española de las ciudades en EN y FR', async ({ page }) => {
    await openGameScreen(page);
    await chooseLanguage(page, 'en');
    await playOffer(page, 'offer-inspect:MAD-SALA', 10);
    const screen = page.getByTestId('game-screen');
    await expect(screen).toContainText('the París archive');
    await expect(screen).not.toContainText('the Paris archive');
    await expect(screen).toContainText('Known city: París.');
    await dossierCards(page);
    const dossierEn = page.getByRole('dialog', { name: 'Dossier' });
    await expect(dossierEn).toContainText('París and Lisboa');
    await expect(dossierEn).not.toContainText('Paris and Lisbon');
    await page.keyboard.press('Escape');
    await chooseLanguage(page, 'fr');
    await dossierCards(page);
    const dossierFr = page.getByRole('dialog', { name: 'Dossier' });
    await expect(dossierFr).toContainText('à París et à Lisboa');
    await expect(dossierFr).not.toContainText('Lisbonne');
    await page.keyboard.press('Escape');
  });
});
