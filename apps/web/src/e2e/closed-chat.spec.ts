import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

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

/** Cierra el caso desde la cabecera (rediseño Norte): botón «Cerrar el
 * caso», pestaña Informe, «Iniciar el cierre del caso», confirmación en
 * línea y el informe final a pantalla entera. */
async function closeCase(page: Page) {
  await page.getByTestId('close-case-header').click();
  await expect(page.getByRole('tabpanel', { name: 'Informe' })).toBeVisible();
  await page.getByTestId('dock-close-start').click();
  await page.getByTestId('dock-close-yes').click();
  await expect(page.getByTestId('report-full')).toBeVisible();
  await expect(page.getByTestId('run-state')).toContainText('Partida cerrada');
}

test.describe('E2E chat tras el cierre (fase 5: agujero del north review)', () => {
  test('al cerrar, la charla se cierra y en la partida cerrada nada permite seguir hablando', async ({ page }) => {
    await openGameScreen(page);
    // Charla abierta con Tomás antes del cierre.
    await page.getByTestId('offer-talk:tomas:identidad').click();
    const chat = page.getByTestId('scene-chat');
    await expect(chat).toBeVisible();
    await expect(page.getByTestId('chat-turns')).toContainText('Soy Tomás Ríos, transportista');

    // Cerrar el caso: la charla se cierra con él y se abre el informe.
    await closeCase(page);
    await expect(chat).toBeHidden();

    // Volver a la partida en solo lectura: la nota de cerrada explica el motivo.
    await page.getByTestId('report-view-run').click();
    await expect(page.getByTestId('report-full')).toBeHidden();
    await expect(page.locator('.game-scene')).toContainText('La partida está cerrada. Consulta el informe final.');
    await expect(page.getByTestId('scene-chat')).toHaveCount(0);
    await expect(page.getByTestId('offer-talk:tomas:identidad')).toHaveCount(0);

    // Equipo: la consulta a Elena y su consejo están deshabilitados.
    await page.getByTestId('toolbar-team').click();
    await expect(page.getByRole('tabpanel', { name: 'Equipo' })).toBeVisible();
    await expect(page.getByTestId('team-elena-input')).toBeDisabled();
    await expect(page.getByTestId('team-elena-send')).toBeDisabled();
    await expect(page.getByTestId('team-advice')).toBeDisabled();

    // Central: el envío está deshabilitado (el servidor ya lo rechazaba con 409).
    await page.getByTestId('toolbar-comms').click();
    await expect(page.getByRole('tabpanel', { name: 'Central' })).toBeVisible();
    await expect(page.getByTestId('comms-send')).toBeDisabled();
  });

  test('recargar una partida cerrada no reabre la charla guardada en esta pestaña', async ({ page }) => {
    await openGameScreen(page);
    await page.getByTestId('offer-talk:lucia:identidad').click();
    await expect(page.getByTestId('scene-chat')).toBeVisible();
    await closeCase(page);
    await page.getByTestId('report-view-run').click();
    // El historial sigue guardado en sessionStorage, pero no se reabre solo.
    await page.reload();
    await page.waitForSelector('[data-testid="game-screen"]', { timeout: 10000 });
    await expect(page.getByTestId('run-state')).toContainText('Partida cerrada');
    await expect(page.getByTestId('scene-chat')).toHaveCount(0);
    await expect(page.getByTestId('chat-input')).toHaveCount(0);
  });
});
