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

test.describe('E2E resumen al retomar (§13)', () => {
  test('al reentrar en una partida empezada el panel se abre con sus datos y se reabre desde la barra', async ({ page }) => {
    await openGameScreen(page);
    // Viajar avanza el reloj (Madrid → Lisboa, 120 min) y deja su marca
    // en el dossier (`travel:lisboa`): el panel la enseña como hallazgo.
    // El estado vacío («Sin hallazgos todavía.») NO se puede alcanzar
    // jugando: el panel exige minuto > 0 y cada acción que avanza el reloj
    // escribe en el dossier (viaje, charla, inspección, consulta); ese
    // estado solo lo cubre el unitario de `resume-summary` con `dossier: []`.
    await page.getByTestId('offer-travel:lisboa').click();
    await expect(page.getByTestId('preview-dialog')).toBeVisible();
    await page.getByTestId('preview-confirm').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    await expect(page.getByTestId('clock')).toContainText('120 min');
    // El resumen se abre solo al entrar en una partida empezada: al
    // recargar, la pantalla se monta con la partida en el minuto 120.
    await page.reload();
    await page.waitForSelector('[data-testid="game-screen"]', { timeout: 10000 });
    const panel = page.getByTestId('resume-panel');
    await expect(panel).toBeVisible();
    await expect(panel).toContainText('Resumen al retomar');
    await expect(panel).toContainText('Minuto 120 de 2880');
    await expect(panel).toContainText('Viajas a Lisboa.');
    // Descartar y reabrir desde la barra.
    await page.getByTestId('resume-panel').getByRole('button', { name: 'Seguir investigando' }).click();
    await expect(page.getByTestId('resume-panel')).toBeHidden();
    await page.getByRole('button', { name: 'Resumen', exact: true }).click();
    await expect(page.getByTestId('resume-panel')).toBeVisible();
  });
});
