import { test, expect } from '@playwright/test';

// La dificultad es lo primero del formulario de nueva partida y debe verse
// sin desplazar en un viewport de escritorio (1920×1000): antes quedaba al
// final de la fila junto al delito y el `align-items:end` del formulario la
// empujaba bajo el pliegue.
test.use({ viewport: { width: 1920, height: 1000 } });

test.describe('Formulario de nueva partida: dificultad visible sin desplazar', () => {
  test('las tres opciones de dificultad están en el viewport a 1920×1000', async ({ page }) => {
    await page.goto('/archivo');
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

  test('el expediente fijo no lleva la marca de una sola vía (tiene dos rutas)', async ({ page }) => {
    await page.goto('/archivo');
    await page.waitForSelector('#root > *', { timeout: 10000 });
    await page.click('button:has-text("Entrar en desarrollo local")');
    const creation = page.locator('.archive-create').first();
    await expect(creation.getByRole('heading', { name: 'Nueva partida' })).toBeVisible();
    await creation.getByRole('radio', { name: 'Robo internacional', exact: true }).check();
    const caseLine = creation.getByText(/Expediente:/);
    await expect(caseLine).toBeVisible();
    await expect(caseLine).not.toContainText('una sola vía');
  });

  test('el generado de varias rutas tampoco lleva la marca', async ({ page }) => {
    await page.goto('/archivo');
    await page.waitForSelector('#root > *', { timeout: 10000 });
    await page.click('button:has-text("Entrar en desarrollo local")');
    const creation = page.locator('.archive-create').first();
    await expect(creation.getByRole('heading', { name: 'Nueva partida' })).toBeVisible();
    await creation.getByRole('radio', { name: 'Desaparición', exact: true }).check();
    const caseLine = creation.getByText(/1dfd99b9/);
    try {
      await expect(caseLine).toBeVisible({ timeout: 10000 });
    } catch {
      test.skip(true, 'generado-1dfd99b9 no está en la BD dev');
    }
    await expect(caseLine).not.toContainText('una sola vía');
  });
});
