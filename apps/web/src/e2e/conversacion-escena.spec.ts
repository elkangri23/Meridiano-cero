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

test.describe('E2E conversación integrada en la escena (sin ventana aparte)', () => {
  test('hablar abre la charla dentro de la escena, sin ventana ni botón de Conversación', async ({ page }) => {
    await openGameScreen(page);
    // La barra ya no ofrece la ventana de Conversación.
    await expect(page.getByTestId('toolbar-chat')).toHaveCount(0);
    await page.getByTestId('offer-talk:lucia:identidad').click();
    // La charla vive dentro de la escena: sin diálogo aparte.
    const chat = page.getByTestId('scene-chat');
    await expect(chat).toBeVisible();
    await expect(page.locator('.game-scene')).toContainText('Conversación con Lucía');
    await expect(page.getByRole('dialog', { name: 'Conversación' })).toHaveCount(0);
    // La escena sigue ahí: el personaje no «desaparece» al hablar.
    await expect(page.locator('.game-scene')).toContainText('Lucía · Asistente de investigación');
    await expect(page.locator('.game-scene')).toContainText('Tomás Ríos · Transportista');
    // Saludo, retrato y entrada de texto, en línea en la escena.
    const turns = page.getByTestId('chat-turns');
    await expect(turns).toBeVisible();
    await expect(turns).toContainText('Lucía');
    await expect(chat.getByRole('img', { name: 'Retrato de Lucía' })).toBeVisible();
    await expect(page.getByTestId('chat-input')).toBeVisible();
  });

  test('pregunta libre con respuesta y cierre con retorno del foco al botón de hablar', async ({ page }) => {
    await openGameScreen(page);
    await page.getByTestId('offer-talk:tomas:identidad').click();
    const chat = page.getByTestId('scene-chat');
    await expect(chat).toBeVisible();
    const turns = page.getByTestId('chat-turns');
    await expect(turns).toContainText('Soy Tomás Ríos, transportista');
    // Pregunta libre: la respuesta del personaje se ve como burbuja.
    await page.getByTestId('chat-input').fill('¿qué hiciste con la caja?');
    await page.getByTestId('chat-send').click();
    await expect(turns).toContainText('caja vacía', { timeout: 15000 });
    // Cerrar vuelve a la vista normal de la escena y el foco al botón.
    await page.getByTestId('chat-close').click();
    await expect(chat).toBeHidden();
    await expect(page.getByTestId('offer-talk:tomas:identidad')).toBeFocused();
  });

  test('Escape cierra la charla y devuelve el foco a la escena', async ({ page }) => {
    await openGameScreen(page);
    await page.getByTestId('offer-talk:lucia:identidad').click();
    const chat = page.getByTestId('scene-chat');
    await expect(chat).toBeVisible();
    // Al abrir, el foco entra en el título de la charla.
    await expect(page.getByRole('heading', { name: 'Conversación con Lucía' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(chat).toBeHidden();
    await expect(page.getByTestId('offer-talk:lucia:identidad')).toBeFocused();
  });

  test('cambiar de personaje cambia la charla sin abrir ventana', async ({ page }) => {
    await openGameScreen(page);
    await page.getByTestId('offer-talk:lucia:identidad').click();
    await expect(page.getByTestId('scene-chat')).toContainText('Conversación con Lucía');
    await page.getByTestId('offer-talk:tomas:identidad').click();
    const chat = page.getByTestId('scene-chat');
    await expect(chat).toContainText('Conversación con Tomás Ríos');
    await expect(page.getByTestId('chat-turns')).toContainText('Soy Tomás Ríos, transportista');
    await expect(page.getByRole('dialog', { name: 'Conversación' })).toHaveCount(0);
  });
});
