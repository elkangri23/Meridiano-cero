import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Rediseño Norte, fase 2: la pestaña y el botón de laboratorio siguen
 * sin existir — el análisis forense vive ahora en la ficha de cada
 * evidencia del Dossier — y la terminal de inteligencia no tiene entrada
 * propia. Este archivo afirma esa realidad: no hay pestaña ni botón de
 * laboratorio, ni entrada a la terminal, y el análisis de EV-02 está en
 * su ficha del Dossier. La lógica del intérprete y de la terminal sigue
 * cubierta por los unitarios (`interpret-clarification.test.ts`,
 * `intel-terminal`) y la consulta determinista sin registro vive ahora en
 * Elena (team.spec.ts). */

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

/** Recoge EV-02 (la cerradura de la vitrina): inspeccionar la sala y la cerradura, recoger. */
async function collectLockEvidence(page: Page) {
  await page.getByTestId('offer-inspect:MAD-SALA').click();
  await expect(page.getByTestId('clock')).toContainText('10 min');
  await page.getByTestId('offer-inspect:MAD-SALA:cerradura').click();
  await expect(page.getByTestId('clock')).toContainText('30 min');
  await page.getByTestId('offer-collect:EV-02').click();
  await expect(page.getByTestId('clock')).toContainText('30 min');
}

test.describe('E2E laboratorio forense + terminal de inteligencia (fase 2: el análisis vive en el Dossier)', () => {
  test('sin pestaña de laboratorio: el análisis de EV-02 está en su ficha del Dossier', async ({ page }) => {
    await openGameScreen(page);
    await collectLockEvidence(page);
    // Ni en la escena ni en el dock hay laboratorio.
    await expect(page.getByTestId('open-lab')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Laboratorio', exact: true })).toHaveCount(0);
    // Ni entrada a la terminal de inteligencia.
    await expect(page.getByRole('button', { name: 'Terminal de inteligencia', exact: true })).toHaveCount(0);
    // El Dossier muestra EV-02 recogida, con su texto y su análisis en la
    // propia ficha; el distintivo cuenta las dos evidencias (EV-01 y EV-02).
    await expect(page.getByTestId('dossier-evidence-count')).toHaveText('2');
    await page.getByTestId('toolbar-dossier').click();
    const dossier = page.getByTestId('dock-panel-dossier');
    await expect(dossier).toContainText('La cerradura de la vitrina tiene residuo de herramienta.');
    await expect(page.getByTestId('offer-analyze:EV-02')).toBeVisible();
    await expect(page.getByTestId('offer-analyze:EV-02')).toContainText('Analizar huellas y marcas · 90 min');
  });

  test('el dock tiene exactamente 5 pestañas y ninguna es el laboratorio', async ({ page }) => {
    await openGameScreen(page);
    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(5);
    await expect(tabs.nth(0)).toContainText('Dossier');
    await expect(tabs.nth(1)).toContainText('Mapa');
    await expect(tabs.nth(2)).toContainText('Central');
    await expect(tabs.nth(3)).toContainText('Equipo');
    await expect(tabs.nth(4)).toContainText('Informe');
  });
});
