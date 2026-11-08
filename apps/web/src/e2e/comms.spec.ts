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

/** Habla con Lucía en persona (abre su conversación en la escena, que se cierra). */
async function talkToLucia(page: Page) {
  await page.getByTestId('offer-talk:lucia:identidad').click();
  await expect(page.getByTestId('scene-chat')).toBeVisible();
  await page.keyboard.press('Escape');
}

/** Recoge EV-02 (la cerradura de la vitrina): inspeccionar la sala y la cerradura, recoger. */
async function collectLockEvidence(page: Page) {
  await page.getByTestId('offer-inspect:MAD-SALA').click();
  await expect(page.getByTestId('clock')).toContainText('10 min');
  await page.getByTestId('offer-inspect:MAD-SALA:cerradura').click();
  await expect(page.getByTestId('clock')).toContainText('30 min');
  await page.getByTestId('offer-collect:EV-02').click();
  await expect(page.getByTestId('clock')).toContainText('30 min');
}

/** Abre la central de comunicaciones desde la barra de herramientas. */
async function openComms(page: Page) {
  await page.click('button:has-text("Central de comunicaciones")');
  await expect(page.getByRole('dialog', { name: 'Central de comunicaciones' })).toBeVisible();
}

test.describe('E2E central de comunicaciones', () => {
  test('un mensaje es gratis, queda en el historial y el acuse llega a +30 min', async ({ page }) => {
    await openGameScreen(page);
    // Sin hablar con nadie, la central no ofrece contactos.
    await openComms(page);
    const comms = page.getByRole('dialog', { name: 'Central de comunicaciones' });
    await expect(comms).toContainText('Habla primero con alguien en persona');
    await page.keyboard.press('Escape');
    await talkToLucia(page);
    await openComms(page);
    // Lucía, con correo y fax; Tomás no aparece (aún no se ha hablado con él).
    await expect(comms).toContainText('Lucía');
    await expect(comms).toContainText('Correo, Fax');
    await expect(comms).not.toContainText('Tomás Ríos');
    // Solo se ofrecen los canales de Lucía: correo y fax, no llamada.
    await page.getByTestId('comms-recipient').selectOption('lucia');
    await expect(page.getByTestId('comms-channel')).toHaveValue('email');
    const channelOptions = await page.getByTestId('comms-channel').locator('option').allTextContents();
    expect(channelOptions).toEqual(['Correo', 'Fax']);
    // El mensaje no cuesta tiempo: va con un clic, sin diálogo.
    await page.getByTestId('comms-text').fill('¿Qué sabes de la caja?');
    await page.getByTestId('comms-send').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    await expect(page.getByTestId('clock')).toContainText('0 min');
    await expect(page.getByTestId('comms-history')).toContainText('A Lucía por Correo');
    await expect(page.getByTestId('comms-history')).toContainText('¿Qué sabes de la caja?');
    await expect(page.getByTestId('comms-history')).toContainText('Acuse sobre el min 30');
    // Esperar 30 min madura el acuse, incluso sin moverse.
    await page.getByTestId('offer-wait:30').click();
    await expect(page.getByTestId('clock')).toContainText('30 min');
    await expect(page.getByTestId('comms-history')).toContainText('Acuse recibido min 30');
    await expect(page.getByTestId('comms-ask-comm-1')).toBeVisible();
  });

  test('enviar un documento cuesta 30 min y solo se puede enviar lo recogido', async ({ page }) => {
    await openGameScreen(page);
    await collectLockEvidence(page);
    await talkToLucia(page);
    await openComms(page);
    const comms = page.getByRole('dialog', { name: 'Central de comunicaciones' });
    // El documento solo ofrece lo recogido: la cerradura sí, lo demás no.
    await page.getByTestId('comms-recipient').selectOption('lucia');
    const docOptions = await page.getByTestId('comms-document').locator('option').allTextContents();
    expect(docOptions).toEqual(['Sin documento', 'La cerradura de la vitrina tiene residuo de herramienta.']);
    await page.getByTestId('comms-text').fill('Te envío la cerradura.');
    await page.getByTestId('comms-document').selectOption('EV-02');
    // Enviar un documento es un trámite de 30 min: va con un clic (como
    // esperar 30 min) y el reloj avanza al enviarlo.
    await page.getByTestId('comms-send').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    await expect(page.getByTestId('clock')).toContainText('60 min');
    await expect(comms).toContainText('Enviado min 60');
    await expect(page.getByTestId('comms-history')).toContainText('Documento: La cerradura de la vitrina tiene residuo de herramienta.');
    await expect(page.getByTestId('comms-history')).toContainText('Acuse sobre el min 90');
    // El documento sigue en poder del jugador (se envía una copia).
    await page.keyboard.press('Escape');
    await page.click('button:has-text("Dossier")');
    await expect(page.getByRole('dialog', { name: 'Dossier' })).toContainText('La cerradura de la vitrina tiene residuo de herramienta.');
  });
});
