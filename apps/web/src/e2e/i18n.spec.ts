import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Abre la pantalla de juego del caso fijo desde el archivo local. */
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

/** Abre la pantalla de juego de un caso generado ya presente en la BD dev,
 * buscándolo por su referencia corta (independiente del idioma). Si el caso
 * no está en la BD dev, el test se salta: el mecanismo ya está cubierto por
 * los unitarios de player-view en francés. */
async function openGeneratedGameScreen(page: Page) {
  await page.goto('/');
  await page.waitForSelector('#root > *', { timeout: 10000 });
  await page.click('button:has-text("Entrar en desarrollo local")');
  const creation = page.locator('.archive-create').first();
  await expect(creation.getByRole('heading', { name: 'Nueva partida' })).toBeVisible();
  await creation.getByRole('radio', { name: 'Desaparición', exact: true }).check();
  // Con un solo expediente coincidente no se dibuja la lista de radios: el
  // caso se auto-selecciona y solo se enseña su referencia en la línea.
  const generated = creation.getByRole('radio', { name: /1dfd99b9/ });
  const caseLine = creation.getByText(/1dfd99b9/);
  try {
    await expect(generated.or(caseLine)).toBeVisible({ timeout: 10000 });
  } catch {
    test.skip(true, 'generado-1dfd99b9 no está en la BD dev');
  }
  if (await generated.count() > 0) await generated.check();
  await creation.getByRole('button', { name: 'Empezar partida' }).click();
  await page.waitForSelector('[data-testid="game-screen"]', { timeout: 10000 });
  await expect(page.getByTestId('clock')).toContainText('0 min');
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

/** Ninguna clave cruda visible en el texto de la pantalla de juego. */
async function expectNoRawKeys(page: Page) {
  const body = await page.getByTestId('game-screen').innerText();
  for (const raw of ['game.', 'settings.', 'windows.', 'labels.', 'common.', 'team.', 'archive.', 'auth.', 'engine.', 'career.', 'prototype.']) {
    expect(body).not.toContain(raw);
  }
}

/** Ningún resto de español en la interfaz ya migrada (los nombres propios
 * —Inés, Madrid, París, Lucía— se quedan en todos los idiomas). */
function expectNoSpanish(page: Page) {
  return page.getByTestId('game-screen').innerText().then(body => {
    for (const spanish of ['Tu siguiente acción', 'La investigación comienza.', 'Detener a Inés con orden válida',
      'Recuperar el astrolabio original', 'Ajustes', 'Mapa', 'Equipo A.C.M.E.', 'Informe final', 'Guardados']) {
      expect(body).not.toContain(spanish);
    }
  });
}

test.describe('E2E T5-05 - Traducción i18n (inglés y francés)', () => {
  test('English: partida, dossier, informe y ajustes en inglés, sin claves crudas ni español residual', async ({ page }) => {
    await openGameScreen(page);
    await page.getByTestId('toolbar-settings').click();
    const selector = page.getByTestId('settings-language');
    await expect(selector).toBeVisible();
    await expect(selector).toHaveValue('es');
    // Las tres opciones existen, con sus etiquetas nativas.
    await expect(selector.locator('option[value="es"]')).toHaveText('Español');
    await expect(selector.locator('option[value="en"]')).toHaveText('English');
    await expect(selector.locator('option[value="fr"]')).toHaveText('Français');

    await selector.selectOption('en');
    await expect(selector).toHaveValue('en');
    // La barra de herramientas se traduce al instante.
    await expect(page.getByTestId('toolbar-settings')).toContainText('Settings');
    await expect(page.getByTestId('toolbar-map')).toContainText('Map');
    await expect(page.getByTestId('toolbar-dossier')).toContainText('Dossier');
    await expect(page.getByTestId('toolbar-team')).toContainText('A.C.M.E. Team');
    await page.keyboard.press('Escape');

    // La vista se vuelve a pedir en inglés: narración, objetivos y reloj.
    await expect(page.getByTestId('game-screen')).toContainText('Your next action');
    await expect(page.getByTestId('game-screen')).toContainText('The investigation begins.');
    await expect(page.getByTestId('objectives-panel')).toContainText('Arrest Inés with a valid warrant');
    await expect(page.getByTestId('difficulty')).toContainText('Normal · 48 hours');

    // El dossier enseña la ficha y la introducción en inglés (los objetivos
    // ya se afirmaron en el panel de objetivos).
    await page.getByTestId('toolbar-dossier').click();
    const dossier = page.getByRole('dialog', { name: 'Dossier' });
    await expect(dossier).toBeVisible();
    await expect(dossier).toContainText('Case file sheet');
    await expect(dossier).toContainText('Margaret Sullivan brings you up to speed:');
    await expect(dossier).toContainText('No evidence collected.');
    await page.keyboard.press('Escape');

    // El informe final, con su título en inglés.
    await page.getByTestId('toolbar-report').click();
    await expect(page.getByRole('dialog', { name: 'Final report' })).toBeVisible();
    await page.keyboard.press('Escape');

    await expectNoRawKeys(page);
    await expectNoSpanish(page);
    // La preferencia queda guardada en localStorage.
    const stored = await page.evaluate(() => localStorage.getItem('meridiano-cero-preferences-v1'));
    expect(stored).toContain('"language":"en"');
  });

  test('Français: partida, dossier, informe y ajustes en francés, sin claves crudas ni español residual', async ({ page }) => {
    await openGameScreen(page);
    await chooseLanguage(page, 'fr');

    await expect(page.getByTestId('toolbar-settings')).toContainText('Réglages');
    await expect(page.getByTestId('toolbar-map')).toContainText('Carte');
    await expect(page.getByTestId('toolbar-team')).toContainText('Équipe A.C.M.E.');
    await expect(page.getByTestId('game-screen')).toContainText('Ta prochaine action');
    await expect(page.getByTestId('game-screen')).toContainText('L\'enquête commence.');
    await expect(page.getByTestId('objectives-panel')).toContainText('Arrêter Inés avec un mandat valide');
    await expect(page.getByTestId('difficulty')).toContainText('Normal · 48 heures');

    await page.getByTestId('toolbar-dossier').click();
    const dossier = page.getByRole('dialog', { name: 'Dossier' });
    await expect(dossier).toBeVisible();
    await expect(dossier).toContainText('Fiche du dossier');
    await expect(dossier).toContainText('Margaret Sullivan te met dans l\'ambiance :');
    await expect(dossier).toContainText('Aucune preuve recueillie.');
    await page.keyboard.press('Escape');

    await page.getByTestId('toolbar-report').click();
    await expect(page.getByRole('dialog', { name: 'Rapport final' })).toBeVisible();
    await page.keyboard.press('Escape');

    await expectNoRawKeys(page);
    await expectNoSpanish(page);
    const stored = await page.evaluate(() => localStorage.getItem('meridiano-cero-preferences-v1'));
    expect(stored).toContain('"language":"fr"');
  });

  test('La preferencia persiste tras recargar y volver a Español deja todo idéntico', async ({ page }) => {
    await openGameScreen(page);
    await chooseLanguage(page, 'en');
    await expect(page.getByTestId('game-screen')).toContainText('Your next action');

    await page.reload();
    await page.waitForSelector('[data-testid="game-screen"]', { timeout: 10000 });
    await expect(page.getByTestId('game-screen')).toContainText('Your next action');
    await expect(page.getByTestId('game-screen')).toContainText('The investigation begins.');
    await expect(page.getByTestId('objectives-panel')).toContainText('Arrest Inés with a valid warrant');
    await page.getByTestId('toolbar-settings').click();
    await expect(page.getByTestId('settings-language')).toHaveValue('en');
    await page.keyboard.press('Escape');

    // Volver a español deja todo como estaba.
    await chooseLanguage(page, 'es');
    await expect(page.getByTestId('game-screen')).toContainText('Tu siguiente acción');
    await expect(page.getByTestId('game-screen')).toContainText('La investigación comienza.');
    await expect(page.getByTestId('objectives-panel')).toContainText('Detener a Inés con orden válida');
    await expect(page.getByTestId('toolbar-settings')).toContainText('Ajustes');
    await expect(page.getByTestId('difficulty')).toContainText('Normal · 48 horas');
    await expectNoRawKeys(page);
  });

  test('La interfaz en español no cambia: cabecera, escena, consola y ventanas sin claves crudas', async ({ page }) => {
    await openGameScreen(page);
    const screen = page.getByTestId('game-screen');
    await expect(screen).toContainText('La investigación comienza.');
    await expect(screen).toContainText('Tu siguiente acción');
    await expect(page.getByTestId('difficulty')).toContainText('Normal · 48 horas');
    // Ventanas principales con su título en español y sin claves crudas.
    for (const [button, title] of [
      ['Mapa', 'Mapa'],
      ['Dossier', 'Dossier'],
      ['Laboratorio', 'Laboratorio'],
      ['Central de comunicaciones', 'Central de comunicaciones'],
      ['Equipo A.C.M.E.', 'Equipo A.C.M.E.'],
      ['Guardados', 'Guardados'],
      ['Ajustes', 'Ajustes'],
      ['Informe final', 'Informe final'],
    ] as const) {
      await page.click(`button:has-text("${button}")`);
      await expect(page.getByRole('dialog', { name: title })).toBeVisible();
      await page.keyboard.press('Escape');
    }
    const body = await screen.innerText();
    for (const raw of ['game.', 'settings.', 'windows.', 'labels.', 'common.', 'team.', 'archive.', 'auth.']) {
      expect(body).not.toContain(raw);
    }
  });

  test('Caso generado en inglés y francés: sus textos se traducen (generado-1dfd99b9)', async ({ page }) => {
    await openGeneratedGameScreen(page);
    await expect(page.getByTestId('objectives-panel')).toContainText('Detener al responsable de la desaparición');
    await expect(page.getByTestId('objectives-panel')).toContainText('Recuperar el cuaderno de campo desaparecido');

    await chooseLanguage(page, 'en');
    await expect(page.getByTestId('objectives-panel')).toContainText('Arrest the culprit behind the disappearance');
    await expect(page.getByTestId('objectives-panel')).toContainText('Recover the missing field notebook');
    await expect(page.getByTestId('game-screen')).not.toContainText('Detener al responsable de la desaparición');

    await chooseLanguage(page, 'fr');
    await expect(page.getByTestId('objectives-panel')).toContainText('Arrêter le responsable de la disparition');
    await expect(page.getByTestId('objectives-panel')).toContainText('Récupérer le carnet de terrain disparu');
    await expect(page.getByTestId('game-screen')).not.toContainText('Detener al responsable de la desaparición');

    await chooseLanguage(page, 'es');
    await expect(page.getByTestId('objectives-panel')).toContainText('Detener al responsable de la desaparición');
  });
});
