import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Crea una partida desde la UI del archivo en el modo elegido; la
 * creación confirmada navega sola a su pantalla de juego. */
async function openGameScreen(page: Page, mode: 'guided' | 'free') {
  await page.goto('/');
  await page.waitForSelector('#root > *', { timeout: 10000 });
  await page.click('button:has-text("Entrar en desarrollo local")');
  const creation = page.locator('.archive-create').first();
  await expect(creation.getByRole('heading', { name: 'Nueva partida' })).toBeVisible();
  await creation.getByRole('radio', { name: 'Robo internacional', exact: true }).check();
  if (mode === 'free') await creation.locator('input[name="exploration"][value="free"]').check();
  await creation.getByRole('button', { name: 'Empezar partida' }).click();
  await page.waitForSelector('[data-testid="game-screen"]', { timeout: 10000 });
  await expect(page.getByTestId('clock')).toContainText('0 min');
}

/** Abre la ventana del mapa (Atlas A.C.M.E.). */
async function openMap(page: Page) {
  await page.click('button:has-text("Mapa")');
  await expect(page.getByRole('dialog', { name: 'Mapa' })).toBeVisible();
}

test.describe('E2E exploración libre y mapa mundial (GDD §5)', () => {
  test('en libre las ciudades del caso están ocultas; el buscador permite viajar a Barcelona y la visita no da pruebas', async ({ page }) => {
    await openGameScreen(page, 'free');
    await expect(page.getByTestId('exploration-mode')).toContainText('Libre');
    await openMap(page);
    const map = page.getByRole('dialog', { name: 'Mapa' });
    // París y Lisboa, ciudades del expediente, no se listan sin descubrir.
    await expect(page.getByTestId('travel-paris')).toHaveCount(0);
    await expect(page.getByTestId('travel-lisboa')).toHaveCount(0);
    // Barcelona, destino turístico, sí se lista con su ruta del catálogo.
    await expect(page.getByTestId('travel-barcelona')).toBeVisible();
    // Ciudad no admitida: respuesta honesta, sin fingir cobertura.
    await map.getByTestId('map-search').fill('Roma');
    await expect(map.getByTestId('map-search-results')).toContainText('Ninguna ciudad admitida coincide con «Roma»');
    // Viaje erróneo desde el buscador: 300 min del catálogo, sin avisos.
    await map.getByTestId('map-search').fill('Barcelona');
    await map.getByTestId('travel-search-barcelona').click();
    await expect(page.getByTestId('preview-dialog')).toBeVisible();
    await expect(page.getByTestId('preview-dialog')).toContainText('300 min');
    await page.getByTestId('preview-confirm').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    await expect(page.getByTestId('clock')).toContainText('300 min');
    // Destino turístico: información determinista, sin pruebas nuevas.
    await expect(map).toContainText('Lugares de interés');
    await expect(map).toContainText('Sagrada Familia');
    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid^="offer-inspect"], [data-testid^="offer-talk"], [data-testid^="offer-collect"]')).toHaveCount(0);
  });

  test('en guiado las tres ciudades del expediente se conocen desde el principio', async ({ page }) => {
    await openGameScreen(page, 'guided');
    await expect(page.getByTestId('exploration-mode')).toContainText('Guiada');
    await openMap(page);
    await expect(page.getByTestId('travel-paris')).toBeVisible();
    await expect(page.getByTestId('travel-lisboa')).toBeVisible();
    await expect(page.getByTestId('travel-barcelona')).toBeVisible();
  });
});
