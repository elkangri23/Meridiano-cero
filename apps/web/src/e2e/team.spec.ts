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

/** Abre el equipo desde la barra de herramientas. */
async function openTeam(page: Page) {
  await page.click('button:has-text("Equipo A.C.M.E.")');
  await expect(page.getByRole('dialog', { name: 'Equipo A.C.M.E.' })).toBeVisible();
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

/** Pide el análisis de huellas de EV-02 y espera a que madure (min 120). */
async function completeAnalysis(page: Page) {
  await collectLockEvidence(page);
  await page.getByTestId('open-lab').click();
  await expect(page.getByRole('dialog', { name: 'Laboratorio' })).toBeVisible();
  await page.getByTestId('offer-analyze:EV-02').click();
  await expect(page.getByTestId('preview-dialog')).toBeHidden();
  await page.keyboard.press('Escape');
  for (const minute of [60, 90, 120]) {
    await page.getByTestId('offer-wait:30').click();
    await expect(page.getByTestId('clock')).toContainText(`${minute} min`);
  }
}

test.describe('E2E equipo A.C.M.E.', () => {
  test('pedir ayuda a Margaret y a Clara es gratis, queda registrado y no revela la solución', async ({ page }) => {
    await openGameScreen(page);
    await openTeam(page);
    const team = page.getByRole('dialog', { name: 'Equipo A.C.M.E.' });
    // Los cinco miembros del GDD §8, con su función y el límite escrito.
    for (const name of ['Margaret Sullivan', 'Dr. Samuel Richter', 'Elena Vázquez', 'David Nakamura', 'Clara Beaumont']) {
      await expect(team).toContainText(name);
    }
    await expect(team).toContainText('El equipo nunca indica si vas bien, ni señala al culpable ni sugiere la siguiente pista.');
    // Margaret: el encargo y los objetivos, sin diálogo de confirmación y sin coste.
    await page.getByTestId('team-briefing').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    await expect(page.getByTestId('clock')).toContainText('0 min');
    await expect(page.getByTestId('team-turns')).toContainText('Margaret Sullivan');
    await expect(page.getByTestId('team-turns')).toContainText('Detener a Inés con orden válida (pendiente)');
    await expect(page.getByTestId('team-turns')).toContainText('Recuperar el astrolabio original (pendiente)');
    await expect(page.getByTestId('team-history')).toContainText('Margaret Sullivan · Preguntar sobre el encargo');
    // Clara: el expediente vacío, también gratis y registrado.
    await page.getByTestId('team-organize').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    await expect(page.getByTestId('clock')).toContainText('0 min');
    await expect(page.getByTestId('team-turns')).toContainText('Clara Beaumont');
    await expect(page.getByTestId('team-turns')).toContainText('Pruebas en tu poder: ninguna todavía.');
    await expect(page.getByTestId('team-history')).toContainText('Clara Beaumont · Organizar el expediente');
    // Nada de lo respondido señala a la culpable ni sugiere la siguiente pista.
    await expect(page.getByTestId('team-turns')).not.toContainText('culpable');
  });

  test('Richter explica un análisis completado y David muestra las rutas desde Madrid', async ({ page }) => {
    await openGameScreen(page);
    await completeAnalysis(page);
    await openTeam(page);
    const team = page.getByRole('dialog', { name: 'Equipo A.C.M.E.' });
    // Richter: el selector trae el análisis completado y su explicación es el texto del resultado.
    await expect(page.getByTestId('team-analysis')).toHaveValue('EV-03');
    await page.getByTestId('team-explain').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    await expect(page.getByTestId('team-turns')).toContainText('Dr. Samuel Richter');
    await expect(page.getByTestId('team-turns')).toContainText('La huella técnica es compatible con una herramienta de la serie HV-17.');
    await expect(page.getByTestId('team-turns')).toContainText('Un análisis solo dice lo que la prueba permite decir.');
    await expect(page.getByTestId('team-history')).toContainText('Dr. Samuel Richter · Explicar un análisis');
    // David: las rutas que ofrece la vista desde Madrid.
    await page.getByTestId('team-routes').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    await expect(page.getByTestId('team-turns')).toContainText('David Nakamura');
    await expect(page.getByTestId('team-turns')).toContainText('Viajar a París');
    await expect(team).toContainText('Sin detenciones que coordinar');
  });

  test('Elena dice que no hay registro sin inventar nada', async ({ page }) => {
    await openGameScreen(page);
    await openTeam(page);
    await page.getByTestId('team-elena-input').fill('¿Qué se sabe del submarino amarillo?');
    await page.getByTestId('team-elena-send').click();
    await expect(page.getByTestId('team-turns')).toContainText('Elena Vázquez');
    await expect(page.getByTestId('team-turns')).toContainText('Sin registro en los archivos consultados. La ausencia de registro no demuestra inocencia.');
    await expect(page.getByTestId('team-history')).toContainText('Elena Vázquez · Consulta de inteligencia');
    await expect(page.getByTestId('clock')).toContainText('0 min');
  });
});
