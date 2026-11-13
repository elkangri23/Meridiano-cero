import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Accesibilidad completa (GDD §15, WCAG 2.2 AA): la pantalla de juego
 * usable solo con teclado, con foco que no se pierde, anuncios para
 * lectores de pantalla, descripciones de escenas y escala 200% sin roturas.
 * No se prueba con un lector de pantalla real ni con usuarios reales
 * (Antonio confirmó que no dispone de ellos): se prueba el comportamiento
 * observable en el navegador (atributos ARIA, foco, clases, anuncios).
 * El archivo tiene 7 pruebas (7 entradas locales): la API de desarrollo
 * limita la entrada local a 10 intentos por IP y minuto. */

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

async function openSettings(page: Page) {
  await page.click('button:has-text("Ajustes")');
  const settings = page.getByTestId('dock-panel-settings');
  await expect(settings).toBeVisible();
  return settings;
}

/** Cierra la introducción del caso nuevo (minuto 0) para dejar el orden de
 * tabulación limpio: su botón es enfocable y está antes de la barra. */
async function dismissIntro(page: Page) {
  await page.getByRole('button', { name: 'Entendido, a investigar' }).click();
}

async function activeElement(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el ? { tag: el.tagName, testid: el.dataset?.testid ?? null, text: (el.textContent ?? '').trim(), id: el.id } : null;
  });
}

async function expectFocusTestId(page: Page, testid: string) {
  await expect.poll(async () => (await activeElement(page))?.testid, { timeout: 5000 }).toBe(testid);
}

test.describe('E2E accesibilidad (GDD §15)', () => {
  test('los ajustes de accesibilidad se ven, se aplican y persisten tras recargar', async ({ page }) => {
    await openGameScreen(page);
    const settings = await openSettings(page);
    await expect(settings.getByTestId('a11y-reduced-motion')).toBeVisible();
    await expect(settings.getByTestId('a11y-focus-visible')).toBeVisible();
    await expect(settings.getByTestId('a11y-skip-nav')).toBeVisible();
    await expect(settings.getByTestId('a11y-announce-narration')).toBeVisible();
    await expect(settings.getByTestId('a11y-font-mode')).toBeVisible();
    // Valores por defecto: foco marcado y salto sí, movimiento reducido no.
    await expect(settings.getByTestId('a11y-focus-visible')).toBeChecked();
    await expect(settings.getByTestId('a11y-skip-nav')).toBeChecked();
    await expect(settings.getByTestId('a11y-announce-narration')).toBeChecked();
    await expect(settings.getByTestId('a11y-reduced-motion')).not.toBeChecked();
    await settings.getByTestId('a11y-reduced-motion').check();
    await settings.getByTestId('a11y-font-mode').selectOption('accessible');
    await expect.poll(async () => page.evaluate(() => document.documentElement.className)).toContain('game-reduced-motion');
    await expect.poll(async () => page.evaluate(() => document.documentElement.className)).toContain('game-font-accessible');
    await page.reload();
    await page.waitForSelector('[data-testid="game-screen"]', { timeout: 10000 });
    const again = await openSettings(page);
    await expect(again.getByTestId('a11y-reduced-motion')).toBeChecked();
    await expect(again.getByTestId('a11y-font-mode')).toHaveValue('accessible');
    await expect.poll(async () => page.evaluate(() => document.documentElement.className)).toContain('game-reduced-motion');
  });

  test('el enlace de salto lleva a la escena con el teclado', async ({ page }) => {
    await openGameScreen(page);
    await page.keyboard.press('Tab');
    const focused = await activeElement(page);
    expect(focused?.text).toBe('Saltar a la escena');
    await page.keyboard.press('Enter');
    await expect.poll(async () => (await activeElement(page))?.id, { timeout: 5000 }).toBe('game-scene');
  });

  test('el dossier con teclado: foco dorado, título al abrir y pestaña activa marcada', async ({ page }) => {
    await openGameScreen(page);
    await dismissIntro(page);
    // Un Tab pone al navegador en modalidad teclado: el foco por script
    // después sí muestra :focus-visible.
    await page.keyboard.press('Tab');
    await page.getByTestId('toolbar-dossier').focus();
    const outline = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as HTMLElement);
      return { width: style.outlineWidth, color: style.outlineColor };
    });
    expect(outline.width).toBe('3px');
    expect(outline.color).toBe('rgb(255, 255, 85)');
    await page.keyboard.press('Enter');
    const dossier = page.getByRole('tabpanel', { name: 'Dossier' });
    await expect(dossier).toBeVisible();
    await expect.poll(async () => activeElement(page), { timeout: 5000 }).toEqual(
      expect.objectContaining({ tag: 'H2', text: 'Dossier' }));
    const active = await page.evaluate(() => {
      const button = document.querySelector('[data-testid="toolbar-dossier"]') as HTMLElement;
      const style = getComputedStyle(button);
      return { boxShadow: style.boxShadow, weight: style.fontWeight, selected: button.getAttribute('aria-selected') };
    });
    expect(active.selected).toBe('true');
    expect(active.weight).toBe('700');
    expect(active.boxShadow).toContain('rgb(201, 162, 39)');
    // Sin ventanas ya no hay cierre: cambiar a otra pestaña oculta el
    // dossier y el foco va al encabezado del panel nuevo.
    await page.getByTestId('toolbar-map').focus();
    await page.keyboard.press('Enter');
    await expect(dossier).toBeHidden();
    await expect.poll(async () => activeElement(page), { timeout: 5000 }).toEqual(
      expect.objectContaining({ tag: 'H2', text: 'Mapa' }));
  });

  test('el diálogo de confirmación atrapa el foco y lo devuelve al cancelar', async ({ page }) => {
    await openGameScreen(page);
    await dismissIntro(page);
    // Viajar a París (180 min) pide confirmación; inspeccionar no.
    await page.getByTestId('offer-travel:paris').focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByTestId('preview-dialog');
    await expect(dialog).toBeVisible();
    await expectFocusTestId(page, 'preview-confirm');
    await page.keyboard.press('Tab');
    await expectFocusTestId(page, 'preview-cancel');
    await page.keyboard.press('Tab');
    await expectFocusTestId(page, 'preview-confirm');
    await page.keyboard.press('Shift+Tab');
    await expectFocusTestId(page, 'preview-cancel');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expectFocusTestId(page, 'offer-travel:paris');
  });

  test('movimiento reducido y anuncios de narración', async ({ page }) => {
    await openGameScreen(page);
    // La consola no es aria-live (el tipeo anunciaría el texto a trozos).
    await expect(page.locator('.game-console ol')).not.toHaveAttribute('aria-live');
    await page.getByTestId('offer-inspect:MAD-SALA').click();
    await expect(page.getByTestId('clock')).toContainText('10 min');
    // Con los anuncios activos, la narración se anuncia al terminar de escribirse.
    const announcer = page.getByTestId('narration-announcer');
    await expect.poll(async () => announcer.textContent(), { timeout: 5000 }).not.toBe('');
    const announced = (await announcer.textContent()) ?? '';
    expect(announced.length).toBeGreaterThan(10);
    const lastItem = await page.locator('.game-console ol > li').last().textContent();
    expect(lastItem).toContain(announced.slice(0, 20));
    // Con el movimiento reducido, las animaciones se apagan.
    const settings = await openSettings(page);
    await settings.getByTestId('a11y-reduced-motion').check();
    await expect.poll(async () => page.evaluate(() => document.documentElement.className)).toContain('game-reduced-motion');
    await page.getByTestId('offer-inspect:MAD-SALA:cerradura').click();
    await expect(page.getByTestId('clock')).toContainText('20 min');
    const hourglass = page.locator('.game-hourglass svg').first();
    await expect(hourglass).toBeVisible();
    const animationName = await hourglass.evaluate(el => getComputedStyle(el).animationName);
    expect(animationName).toBe('none');
    // Sin anuncios, la región queda vacía aunque haya narración nueva.
    const settingsAgain = await openSettings(page);
    await settingsAgain.getByTestId('a11y-announce-narration').uncheck();
    await page.getByTestId('offer-collect:EV-02').click();
    await expect(page.getByTestId('clock')).toContainText('30 min');
    await page.waitForTimeout(2000);
    await expect(page.getByTestId('narration-announcer')).toBeEmpty();
  });

  test('objetivos, arte de escena y atlas con equivalentes accesibles', async ({ page }) => {
    await openGameScreen(page);
    // Los objetivos dicen su estado con palabras, no solo con ✓/○.
    const first = page.locator('[data-testid^="objective-"] .game-sr-only').first();
    await expect(first).toHaveText('Pendiente:');
    // El arte de escena y el atlas tienen descripción (sin spoilers).
    const art = page.getByTestId('scene-art');
    await expect(art).toHaveAttribute('role', 'img');
    await expect(art).toHaveAttribute('aria-label', /sala de embalaje/);
    await dismissIntro(page);
    await page.getByTestId('toolbar-map').focus();
    await page.keyboard.press('Enter');
    const map = page.getByRole('tabpanel', { name: 'Mapa' });
    await expect(map).toBeVisible();
    const atlas = map.locator('.game-atlas');
    await expect(atlas).toHaveAttribute('role', 'img');
    // El atlas mundial nombra las ciudades admitidas del catálogo, con las
    // tres del expediente entre ellas (GDD §5).
    await expect(atlas).toHaveAttribute('aria-label', /Mapa mundial con las ciudades admitidas: Madrid, Barcelona, .*París, Lisboa\./);
  });

  test('a escala 200% no hay desbordamiento horizontal ni paneles fuera de la pantalla', async ({ page }) => {
    await openGameScreen(page);
    const settings = await openSettings(page);
    await settings.getByLabel('Tamaño de texto').selectOption('200');
    await expect.poll(async () => page.evaluate(() => getComputedStyle(document.querySelector('main') as HTMLElement).fontSize)).toBe('32px');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(overflow).toBe(true);
    await dismissIntro(page);
    await page.getByTestId('toolbar-team').focus();
    await page.keyboard.press('Enter');
    const team = page.getByRole('tabpanel', { name: 'Equipo' });
    await expect(team).toBeVisible();
    const box = await team.boundingBox();
    expect(box).not.toBeNull();
    if (!box) return;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(1280);
  });
});
