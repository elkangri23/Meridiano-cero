import { test, expect } from '@playwright/test';

/** Landing pública en `/` (fase 2 del rediseño A2): sin sesión se ve la
 * landing; con sesión se redirige al archivo en `/archivo`. El archivo
 * sigue en `/archivo` con su contenido y su entrada local de desarrollo. */
test.describe('Landing pública y archivo en /archivo', () => {
  test('sin sesión, / enseña la landing con hechos verificados', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#root > *', { timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Resuelve el caso. Ciudad a ciudad.' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Crear cuenta' }).first()).toBeVisible();
    await expect(page.locator('text=13 casos')).toBeVisible();
    await expect(page.locator('text=9 ciudades')).toBeVisible();
    await expect(page.locator('text=28 rutas')).toBeVisible();
    await expect(page.locator('text=Gratis. Sin planes ni pagos.')).toBeVisible();
    // Nada inventado: ni jugadores, ni porcentajes, ni testimonios.
    await expect(page.locator('body')).not.toContainText('detectives');
    await expect(page.locator('body')).not.toContainText('%');
  });

  test('con sesión, / redirige al archivo en /archivo', async ({ page }) => {
    await page.goto('/archivo');
    await page.waitForSelector('#root > *', { timeout: 10000 });
    await page.click('button:has-text("Entrar en desarrollo local")');
    await expect(page.getByRole('heading', { name: 'Nueva partida' })).toBeVisible();
    await page.goto('/');
    await expect(page).toHaveURL(/\/archivo$/);
    await expect(page.getByRole('heading', { name: 'Nueva partida' })).toBeVisible();
  });

  test('el archivo en /archivo conserva su título y su entrada local', async ({ page }) => {
    await page.goto('/archivo');
    await page.waitForSelector('#root > *', { timeout: 10000 });
    await expect(page.locator('h1')).toContainText('Archivo de partidas');
    await expect(page.getByRole('button', { name: 'Entrar en desarrollo local' })).toBeVisible();
  });
});
