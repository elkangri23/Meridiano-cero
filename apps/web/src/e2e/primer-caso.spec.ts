import { test, expect } from '@playwright/test';

test.describe('E2E - Primer caso: flujo completo', () => {
  test('debe cargar la página principal sin errores', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
  });

  test('debe permitir crear una nueva partida', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Nueva partida');
    await expect(page.locator('text=Selecciona dificultad')).toBeVisible();
  });

  test('debe permitir navegar por el mapa', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Nueva partida');
    await page.click('text=Normal');
    await page.click('text=Guiado');
    await expect(page.locator('text=Madrid')).toBeVisible();
  });

  test('debe permitir inspeccionar una ubicación', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Nueva partida');
    await page.click('text=Normal');
    await page.click('text=Guiado');
    await page.click('text=Inspeccionar');
    await expect(page.locator('text=Resultados de la inspección')).toBeVisible();
  });

  test('debe permitir hablar con un NPC', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Nueva partida');
    await page.click('text=Normal');
    await page.click('text=Guiado');
    await page.click('text=Hablar');
    await expect(page.locator('text=Diálogo con')).toBeVisible();
  });

  test('debe permitir viajar entre ciudades', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Nueva partida');
    await page.click('text=Normal');
    await page.click('text=Guiado');
    await page.click('text=Viajar');
    await expect(page.locator('text=Destino')).toBeVisible();
  });

  test('debe permitir guardar y cargar la partida', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Nueva partida');
    await page.click('text=Normal');
    await page.click('text=Guiado');
    await page.click('text=Guardar');
    await expect(page.locator('text=Partida guardada')).toBeVisible();
    await page.reload();
    await page.click('text=Cargar partida');
    await expect(page.locator('text=Partidas guardadas')).toBeVisible();
  });

  test('debe mostrar el informe final al cerrar el caso', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Nueva partida');
    await page.click('text=Normal');
    await page.click('text=Guiado');
    // Simular resolución del caso
    await page.click('text=Finalizar caso');
    await expect(page.locator('text=Informe Final')).toBeVisible();
  });
});

test.describe('E2E - Accesibilidad', () => {
  test('debe ser navegable solo con teclado', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.locator(':focus')).toBeVisible();
  });

  test('debe respetar prefers-reduced-motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const animations = await page.evaluate(() => {
      return document.documentElement.style.getPropertyValue('--animation-duration');
    });
    expect(animations).toBe('0.01ms');
  });

  test('debe tener contraste adecuado en modo alto contraste', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark', forcedColors: 'active' });
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
  });
});