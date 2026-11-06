import { test, expect } from '@playwright/test';

// La dificultad es lo primero del formulario de nueva partida y debe verse
// sin desplazar en un viewport de escritorio (1920×1000): antes quedaba al
// final de la fila junto al delito y el `align-items:end` del formulario la
// empujaba bajo el pliegue.
test.use({ viewport: { width: 1920, height: 1000 } });

test.describe('Formulario de nueva partida: dificultad visible sin desplazar', () => {
  test('las tres opciones de dificultad están en el viewport a 1920×1000', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#root > *', { timeout: 10000 });
    await page.click('button:has-text("Entrar en desarrollo local")');
    const creation = page.locator('.archive-create').first();
    await expect(creation.getByRole('heading', { name: 'Nueva partida' })).toBeVisible();
    for (const name of [/Fácil · plazo/, /Normal · plazo/, /Difícil · plazo/]) {
      const option = creation.getByRole('radio', { name });
      await expect(option).toBeVisible();
      await expect(option).toBeInViewport();
    }
  });
});
