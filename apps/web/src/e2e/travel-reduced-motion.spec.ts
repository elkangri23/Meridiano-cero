import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Rediseño Norte, fase 3: con reducción de movimiento el viaje cambia
 * directo de escena, sin transición. */
test.use({ reducedMotion: 'reduce' });

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

test.describe('E2E viaje con reducción de movimiento', () => {
  test('viajar cambia directo de escena, sin animación', async ({ page }) => {
    await openGameScreen(page);
    await page.getByTestId('offer-travel:paris').click();
    await expect(page.getByTestId('preview-dialog')).toBeVisible();
    await page.getByTestId('preview-confirm').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    // Sin transición: el aviso no aparece nunca y la escena ya es París.
    await expect(page.getByTestId('travel-animation')).toHaveCount(0);
    await expect(page.getByTestId('scene-art')).toHaveAttribute('data-location', 'PAR-ARCH');
    await expect(page.getByTestId('clock')).toContainText('180 min');
  });
});
