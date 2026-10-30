import { test, expect } from '@playwright/test';

test.describe('E2E - Archive y Prototype', () => {
  test('debe cargar la página principal (Archive)', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Archivo de partidas');
  });

  test('debe permitir navegar a /prototype y cargar Prototype', async ({ page }) => {
    await page.goto('/prototype');
    await expect(page.locator('h1')).toContainText('MERIDIANO CERO');
    // Usar localizadores específicos para evitar ambigüedad
    await expect(page.locator('.sample-banner >> text=VISTA DE MUESTRA')).toBeVisible();
  });

  test('debe mostrar la cabecera de la agencia en Prototype', async ({ page }) => {
    await page.goto('/prototype');
    await expect(page.locator('text=AGENCIA DE INVESTIGACIÓN INTERNACIONAL')).toBeVisible();
  });

  test('debe mostrar la tira del caso en Prototype', async ({ page }) => {
    await page.goto('/prototype');
    // Usar :first para evitar ambigüedad con el encabezado de herramienta
    await expect(page.locator('.case-strip >> p.overline:has-text("EXPEDIENTE 001")')).toBeVisible();
    await expect(page.locator('.case-strip >> strong:has-text("El astrolabio ausente")')).toBeVisible();
  });

  test('debe mostrar el reloj del caso en Prototype', async ({ page }) => {
    await page.goto('/prototype');
    await expect(page.locator('text=TIEMPO TRANSCURRIDO / PLAZO')).toBeVisible();
  });

  test('debe permitir cambiar de herramienta en Prototype', async ({ page }) => {
    await page.goto('/prototype');
    // Label en sample.ts es "Atlas y viajes"
    await expect(page.locator('button:has-text("Atlas y viajes")')).toBeVisible();
    await page.click('button:has-text("Atlas y viajes")');
    await expect(page.locator('button[aria-pressed="true"]:has-text("Atlas y viajes")')).toBeVisible();
  });

  test('debe permitir escribir una orden en Prototype', async ({ page }) => {
    await page.goto('/prototype');
    await page.fill('input[placeholder="¿Qué quieres hacer o preguntar?"]', 'Examinar la sala');
    await expect(page.locator('button:has-text("Revisar orden")')).toBeEnabled();
  });

  test('debe mostrar el panel de confirmación al enviar orden', async ({ page }) => {
    await page.goto('/prototype');
    await page.fill('input[placeholder="¿Qué quieres hacer o preguntar?"]', 'Examinar la sala');
    await page.click('button:has-text("Revisar orden")');
    // Confirmation.tsx muestra "REVISAR SOLICITUD" y "Antes de actuar"
    await expect(page.locator('text=REVISAR SOLICITUD')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Antes de actuar')).toBeVisible();
  });
});

test.describe('E2E - Accesibilidad básica', () => {
  test('Archive debe tener skip link y ser navegable con teclado', async ({ page }) => {
    await page.goto('/');
    // Verificar skip link
    const skipLink = page.locator('a.skip-link');
    await expect(skipLink).toBeVisible();
    await skipLink.focus();
    await expect(skipLink).toBeFocused();
  });

  test('Prototype debe tener skip link', async ({ page }) => {
    await page.goto('/prototype');
    const skipLink = page.locator('a.skip-link');
    await expect(skipLink).toBeVisible();
    await skipLink.focus();
    await expect(skipLink).toBeFocused();
  });

  test('Prototype debe tener ajustes de accesibilidad', async ({ page }) => {
    await page.goto('/prototype');
    // Label en sample.ts es "Lectura y contraste"
    await page.click('button:has-text("Lectura y contraste")');
    await expect(page.locator('h2:has-text("Lectura y contraste")')).toBeVisible();
    
    // Probar contraste
    const highContrastCheckbox = page.locator('label:has-text("Contraste reforzado") input');
    await highContrastCheckbox.check();
    await expect(page.locator('main.prototype')).toHaveAttribute('data-contrast', 'high');
  });
});