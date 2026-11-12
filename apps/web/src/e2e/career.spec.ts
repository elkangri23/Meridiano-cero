import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Entra en desarrollo local y espera el formulario de nueva partida.
 * El perfil de desarrollo es COMPARTIDO entre specs y la BD dev persiste
 * entre pasadas: las aserciones son relativas (antes/después), nunca
 * absolutas sobre el conteo de casos o los puntos. */
async function loginDev(page: Page) {
  await page.goto('/archivo');
  await page.waitForSelector('#root > *', { timeout: 10000 });
  await page.click('button:has-text("Entrar en desarrollo local")');
  const creation = page.locator('.archive-create').first();
  await expect(creation.getByRole('heading', { name: 'Nueva partida' })).toBeVisible();
  return creation;
}

/** Crea una partida desde la UI del archivo; la creación confirmada navega sola a su pantalla de juego. */
async function openGameScreen(page: Page) {
  const creation = await loginDev(page);
  await creation.getByRole('radio', { name: 'Robo internacional', exact: true }).check();
  await creation.getByRole('button', { name: 'Empezar partida' }).click();
  await page.waitForSelector('[data-testid="game-screen"]', { timeout: 10000 });
  await expect(page.getByTestId('clock')).toContainText('0 min');
}

/** Cierra la partida sin actuar: cabecera, pestaña Informe, confirmación
 * en línea y el informe final a pantalla entera. */
async function closeCase(page: Page) {
  await page.getByTestId('close-case-header').click();
  await expect(page.getByRole('tabpanel', { name: 'Informe' })).toBeVisible();
  await page.getByTestId('dock-close-start').click();
  await page.getByTestId('dock-close-yes').click();
  await expect(page.getByTestId('report-full')).toBeVisible();
  await expect(page.getByTestId('run-state')).toContainText('Cerrada');
}

/** El informe final ya está a pantalla entera tras cerrar; devuelve su cuerpo. */
async function openReport(page: Page) {
  const report = page.getByTestId('report-full');
  await expect(report).toContainText('Resultado:');
  return report;
}

/** Vuelve a la partida en solo lectura y abre la pestaña Equipo. */
async function openTeam(page: Page) {
  await page.getByTestId('report-view-run').click();
  await page.getByTestId('toolbar-team').click();
  const team = page.getByTestId('dock-panel-equipo');
  await expect(team).toBeVisible();
  return team;
}

/** Vuelve al archivo desde la pantalla de juego (enlace «Archivo» de la
 * cabecera) y lee el conteo de casos de la sección de carrera. */
async function careerCasesFromArchive(page: Page): Promise<number> {
  await page.getByRole('link', { name: 'Archivo' }).click();
  const section = page.getByTestId('career-section');
  await expect(section).toBeVisible();
  const text = await page.getByTestId('career-cases').textContent();
  const match = /(\d+)/.exec(text ?? '');
  expect(match).not.toBeNull();
  const digits = match?.[1];
  if (digits === undefined) throw new Error('sin conteo de casos en la vista de carrera');
  return Number(digits);
}

test.describe('E2E carrera y reputación (GDD §13, DEC-020)', () => {
  test('la vista de carrera del archivo enseña rango, puntos y casos', async ({ page }) => {
    await loginDev(page);
    const section = page.getByTestId('career-section');
    await expect(section).toBeVisible();
    await expect(page.getByTestId('career-rank')).toContainText('Rango:');
    await expect(page.getByTestId('career-points')).toContainText('puntos');
    await expect(page.getByTestId('career-cases')).toContainText(/caso/);
  });

  test('tras cerrar un caso, Margaret evalúa la carrera y el informe muestra el resultado oficial o la práctica', async ({ page }) => {
    await openGameScreen(page);
    await closeCase(page);
    // El informe muestra las consecuencias de carrera: o este cierre es el
    // oficial («Resultado oficial:») o ya existía uno anterior y este es de
    // práctica («Esta partida es de práctica:»). Una de las dos, siempre.
    const report = await openReport(page);
    await expect(report).toContainText('Consecuencias de carrera');
    const body = await report.textContent();
    expect(/Resultado oficial:|Esta partida es de práctica:/.test(body ?? '')).toBe(true);
    await page.keyboard.press('Escape');
    // Margaret evalúa la carrera: tras un cierre, la carrera es no vacía
    // seguro (o este cierre creó el oficial o ya existía uno).
    await openTeam(page);
    await page.getByTestId('team-evaluate').click();
    await expect(page.getByTestId('team-turns')).toContainText('Tu carrera: rango');
  });

  test('un segundo cierre del mismo caso es siempre de práctica y no suma casos', async ({ page }) => {
    await openGameScreen(page);
    await closeCase(page);
    const afterFirst = await careerCasesFromArchive(page);
    // Segunda partida del mismo expediente (el fijo): su cierre es de
    // práctica seguro, porque tras el primer cierre ya existe oficial.
    const creation = page.locator('.archive-create').first();
    await expect(creation.getByRole('heading', { name: 'Nueva partida' })).toBeVisible();
    await creation.getByRole('radio', { name: 'Robo internacional', exact: true }).check();
    await creation.getByRole('button', { name: 'Empezar partida' }).click();
    await page.waitForSelector('[data-testid="game-screen"]', { timeout: 10000 });
    await expect(page.getByTestId('clock')).toContainText('0 min');
    await closeCase(page);
    const report = await openReport(page);
    await expect(report).toContainText('Esta partida es de práctica:');
    const afterSecond = await careerCasesFromArchive(page);
    expect(afterSecond).toBe(afterFirst);
  });
});
