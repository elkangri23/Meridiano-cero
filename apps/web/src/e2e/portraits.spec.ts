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

/** Los retratos de una lista de localizadores son distintos entre sí (su SVG no coincide). */
async function expectPortraitsDistinct(locator: ReturnType<Page['locator']>) {
  const count = await locator.count();
  expect(count).toBeGreaterThan(1);
  const svgs: string[] = [];
  for (let i = 0; i < count; i++) svgs.push(await locator.nth(i).innerHTML());
  expect(new Set(svgs).size).toBe(svgs.length);
}

test.describe('E2E retratos de personajes (GDD §2)', () => {
  test('la escena enseña el retrato de cada personaje presente, distintos entre sí', async ({ page }) => {
    await openGameScreen(page);
    const scenePortraits = page.locator('.game-scene-npc [data-testid="portrait"]');
    await expect(scenePortraits.first()).toBeVisible();
    await expect(scenePortraits).toHaveCount(2);
    await expect(page.getByRole('img', { name: 'Retrato de Lucía' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Retrato de Tomás Ríos' })).toBeVisible();
    await expectPortraitsDistinct(scenePortraits);
  });

  test('la conversación enseña el retrato del personaje, en grande', async ({ page }) => {
    await openGameScreen(page);
    await page.getByTestId('offer-talk:tomas:identidad').click();
    const chat = page.getByTestId('scene-chat');
    await expect(chat).toBeVisible();
    const portrait = chat.getByRole('img', { name: 'Retrato de Tomás Ríos' });
    await expect(portrait).toBeVisible();
    await expect(portrait).toHaveAttribute('width', '48');
    await expect(chat).toContainText('Tomás Ríos');
  });

  test('el equipo enseña los cinco retratos, distintos entre sí', async ({ page }) => {
    await openGameScreen(page);
    await page.click('button:has-text("Equipo A.C.M.E.")');
    const team = page.getByRole('dialog', { name: 'Equipo A.C.M.E.' });
    await expect(team).toBeVisible();
    const portraits = team.locator('[data-testid="portrait"]');
    await expect(portraits).toHaveCount(5);
    for (const name of ['Margaret Sullivan', 'Dr. Samuel Richter', 'Elena Vázquez', 'David Nakamura', 'Clara Beaumont']) {
      await expect(team.getByRole('img', { name: `Retrato de ${name}` })).toBeVisible();
    }
    await expectPortraitsDistinct(portraits);
  });

  test('la central enseña el retrato del contacto tras hablar en persona', async ({ page }) => {
    await openGameScreen(page);
    await page.getByTestId('offer-talk:lucia:identidad').click();
    await expect(page.getByTestId('scene-chat')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.click('button:has-text("Central de comunicaciones")');
    const comms = page.getByRole('dialog', { name: 'Central de comunicaciones' });
    await expect(comms).toBeVisible();
    await expect(comms.getByRole('img', { name: 'Retrato de Lucía' })).toBeVisible();
    await expect(comms).toContainText('Lucía');
  });

  for (const palette of ['protanopia', 'deuteranopia', 'tritanopia', 'high-contrast'] as const) {
    test(`con la paleta ${palette}, los retratos del equipo se siguen viendo y distinguiendo`, async ({ page }) => {
      await page.addInitScript(value => {
        window.localStorage.setItem('meridiano-cero-preferences-v1', JSON.stringify({ palette: value }));
      }, palette);
      await openGameScreen(page);
      await page.click('button:has-text("Equipo A.C.M.E.")');
      const team = page.getByRole('dialog', { name: 'Equipo A.C.M.E.' });
      await expect(team).toBeVisible();
      const portraits = team.locator('[data-testid="portrait"]');
      await expect(portraits).toHaveCount(5);
      await expectPortraitsDistinct(portraits);
    });
  }
});
