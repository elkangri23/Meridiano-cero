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

/** Abre la pestaña Equipo del dock. */
async function openTeam(page: Page) {
  await page.getByTestId('toolbar-team').click();
  await expect(page.getByRole('tabpanel', { name: 'Equipo' })).toBeVisible();
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

test.describe('E2E equipo A.C.M.E.', () => {
  test('pedir ayuda a Margaret y a Clara es gratis, queda registrado y no revela la solución', async ({ page }) => {
    await openGameScreen(page);
    await openTeam(page);
    const team = page.getByTestId('dock-panel-equipo');
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

  // Rediseño Norte, fase 2: Richter necesita EV-03, que sale del análisis
  // de EV-02 en su ficha del Dossier.
  test('Richter explica un análisis completado y David muestra las rutas desde Madrid', async ({ page }) => {
    await openGameScreen(page);
    await collectLockEvidence(page);
    // El análisis de EV-02 vive en su ficha del Dossier: cuesta 0 y
    // madura a los 90 min de juego.
    await page.click('button:has-text("Dossier")');
    await expect(page.getByTestId('offer-analyze:EV-02')).toContainText('Analizar huellas y marcas · 90 min');
    await page.getByTestId('offer-analyze:EV-02').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    await expect(page.getByTestId('clock')).toContainText('30 min');
    for (const minute of [60, 90, 120]) {
      await page.getByTestId('offer-wait:30').click();
      await expect(page.getByTestId('clock')).toContainText(`${minute} min`);
    }
    await openTeam(page);
    const team = page.getByTestId('dock-panel-equipo');
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

  // Rediseño Norte, fase 3: Elena aconseja y Margaret valora en el sitio,
  // gratis (0 min), y Central y Laboratorio se presentan sin pestaña.
  test('Elena aconseja y Margaret valora en el sitio, gratis, sin pestaña de laboratorio', async ({ page }) => {
    await openGameScreen(page);
    await openTeam(page);
    const team = page.getByTestId('dock-panel-equipo');
    // El dock tiene cinco pestañas y ninguna es Laboratorio.
    await expect(page.getByTestId('game-dock').getByRole('tab')).toHaveCount(5);
    await expect(page.getByRole('tab', { name: 'Laboratorio' })).toHaveCount(0);
    await expect(team.getByTestId('team-central-row')).toContainText('Central operativa');
    await expect(team.getByTestId('team-lab-row')).toContainText('Sin pestaña propia');
    // Elena: consejo en el sitio, gratis, sin diálogo y sin avanzar el reloj.
    await page.getByTestId('team-advice').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    await expect(page.getByTestId('clock')).toContainText('0 min');
    const elenaReply = page.getByTestId('team-reply-elena');
    await expect(elenaReply).toBeVisible();
    await expect(elenaReply).toContainText('Elena · consejo · sin coste (0 min)');
    await expect(elenaReply).toContainText('Estás en Madrid: Sala de embalaje.');
    await expect(elenaReply).toContainText('Objetivos pendientes (2):');
    await expect(elenaReply).toContainText('Detener a Inés con orden válida');
    await expect(elenaReply).not.toContainText('culpable');
    await expect(page.getByTestId('team-turns')).toContainText('¿Qué me aconsejas como siguiente paso?');
    await expect(page.getByTestId('team-history')).toContainText('Elena Vázquez · Pedir consejo');
    await expect(page.locator('.game-console')).toContainText('que te aconsejara sobre el siguiente paso');
    // Margaret: valoración en el sitio, también gratis.
    await page.getByTestId('team-evaluate').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    await expect(page.getByTestId('clock')).toContainText('0 min');
    const margaretReply = page.getByTestId('team-reply-margaret');
    await expect(margaretReply).toBeVisible();
    await expect(margaretReply).toContainText('Margaret Sullivan · valoración de carrera · sin coste (0 min)');
    // El perfil de carrera es el del usuario de desarrollo local,
    // compartido por todos los specs: ya puede traer casos cerrados
    // de corridas anteriores, así que no se afirma un número concreto.
    await expect(margaretReply).toContainText('Tu carrera:');
    await expect(margaretReply).toContainText('puntos');
    await expect(margaretReply).not.toContainText('culpable');
    await expect(page.getByTestId('team-turns')).toContainText('¿Cómo va mi carrera?');
    await expect(page.getByTestId('team-history')).toContainText('Margaret Sullivan · Evaluar mi carrera');
  });
});
