import { test, expect } from '@playwright/test';

// Importar un expediente desde el archivo: un fichero inválido se rechaza
// con el motivo del servidor y no entra nada en el catálogo. El camino
// válido (exportar → importar → jugar) se cubre en la integración de la
// API (exchange.integration.test.ts) y en el smoke de producción; aquí solo
// se comprueba la UI con clics reales.
test.describe('Importar expediente en el archivo', () => {
  test('un fichero inválido muestra el motivo del servidor', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('#root > *', { timeout: 10000 });
    await page.click('button:has-text("Entrar en desarrollo local")');
    const archive = page.locator('.archive-create').first();
    await expect(archive.getByRole('heading', { name: 'Nueva partida' })).toBeVisible();
    const exchange = page.getByRole('heading', { name: 'Importar expediente' });
    await expect(exchange).toBeVisible();
    const input = page.locator('input[type="file"]');
    await input.setInputFiles({
      name: 'expediente-invalido.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({ version: '1.0.0' }), 'utf-8'),
    });
    await expect(page.locator('.archive-notice').first()).toContainText('Definición de caso requerida', { timeout: 10000 });
  });
});
