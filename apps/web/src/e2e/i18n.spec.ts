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

test.describe('E2E T5-05 - Infraestructura i18n', () => {
  test('Selector de idioma en Ajustes: elegir English deja el juego en español (fallback) y persiste tras recargar', async ({ page }) => {
    await openGameScreen(page);
    await page.click('button:has-text("Ajustes")');
    const selector = page.getByTestId('settings-language');
    await expect(selector).toBeVisible();
    await expect(selector).toHaveValue('es');
    // Las dos opciones existen, con sus etiquetas nativas.
    await expect(selector.locator('option[value="es"]')).toHaveText('Español');
    await expect(selector.locator('option[value="en"]')).toHaveText('English');

    await selector.selectOption('en');
    // Fallback completo: nada cambia a inglés, todo sigue en español.
    await expect(page.getByTestId('game-screen')).toContainText('Tu siguiente acción');
    await expect(page.getByTestId('game-screen')).toContainText('La investigación comienza.');
    await expect(page.getByTestId('objectives-panel')).toContainText('Detener a Inés con orden válida');
    await expect(page.getByTestId('toolbar-settings')).toContainText('Ajustes');
    await expect(page.getByTestId('toolbar-map')).toContainText('Mapa');
    await expect(page.getByTestId('toolbar-dossier')).toContainText('Dossier');
    await expect(page.getByTestId('toolbar-team')).toContainText('Equipo A.C.M.E.');
    // Ni una clave cruda visible ni texto de interfaz en inglés.
    const body = await page.getByTestId('game-screen').innerText();
    for (const raw of ['game.', 'settings.', 'windows.', 'labels.', 'common.', 'team.']) {
      expect(body).not.toContain(raw);
    }
    expect(body).not.toContain('Settings');
    expect(body).not.toContain('Objectives');
    // La preferencia queda guardada en localStorage.
    const stored = await page.evaluate(() => localStorage.getItem('meridiano-cero-preferences-v1'));
    expect(stored).toContain('"language":"en"');

    // Tras recargar, la elección persiste y el juego sigue en español.
    await page.reload();
    await page.waitForSelector('[data-testid="game-screen"]', { timeout: 10000 });
    await page.click('button:has-text("Ajustes")');
    await expect(page.getByTestId('settings-language')).toHaveValue('en');
    await expect(page.getByTestId('game-screen')).toContainText('Tu siguiente acción');
    await expect(page.getByTestId('game-screen')).toContainText('La investigación comienza.');
    // Volver a español deja todo como estaba.
    await page.getByTestId('settings-language').selectOption('es');
    await expect(page.getByTestId('settings-language')).toHaveValue('es');
    await expect(page.getByTestId('game-screen')).toContainText('Tu siguiente acción');
    await page.keyboard.press('Escape');
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
});
