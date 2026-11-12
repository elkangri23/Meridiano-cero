import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Crea una partida desde la UI del archivo; la creación confirmada navega sola a su pantalla de juego. */
async function openGameScreen(page: Page) {
  await page.goto('/archivo');
  await page.waitForSelector('#root > *', { timeout: 10000 });
  await page.click('button:has-text("Entrar en desarrollo local")');
  const creation = page.locator('.archive-create').first();
  // El archivo puede tardar en montar el formulario (API dev + vite en la
  // misma VM): 15 s en vez de los 5 s por defecto.
  await expect(creation.getByRole('heading', { name: 'Nueva partida' })).toBeVisible({ timeout: 15000 });
  await creation.getByRole('radio', { name: 'Robo internacional', exact: true }).check();
  await creation.getByRole('button', { name: 'Empezar partida' }).click();
  await page.waitForSelector('[data-testid="game-screen"]', { timeout: 15000 });
  await expect(page.getByTestId('clock')).toContainText('0 min');
}

/** Minutos del reloj de la partida. */
async function clockMinutes(page: Page): Promise<number> {
  const text = await page.getByTestId('clock').textContent() ?? '';
  const match = /(\d+) min/.exec(text);
  expect(match, `reloj sin minutos: ${text}`).not.toBeNull();
  return match ? Number(match[1]) : -1;
}

/** Pulsa una oferta y devuelve el diálogo de confirmación abierto. */
async function openPreview(page: Page, testId: string) {
  await page.getByTestId(testId).click();
  const preview = page.getByTestId('preview-dialog');
  await expect(preview).toBeVisible();
  return preview;
}

/** Abre la pestaña Dossier del dock. */
async function openDossier(page: Page) {
  await page.getByTestId('toolbar-dossier').click();
  await expect(page.getByRole('tabpanel', { name: 'Dossier' })).toBeVisible();
}

/** Cierra el caso desde la cabecera (rediseño Norte): pestaña Informe,
 * confirmación en línea y el informe final a pantalla entera. */
async function closeCase(page: Page) {
  await page.getByTestId('close-case-header').click();
  await expect(page.getByRole('tabpanel', { name: 'Informe' })).toBeVisible();
  await page.getByTestId('dock-close-start').click();
  await page.getByTestId('dock-close-yes').click();
  await expect(page.getByTestId('report-full')).toBeVisible();
  await expect(page.getByTestId('run-state')).toContainText('Cerrada');
}

test.describe('E2E acciones irregulares (GDD §14)', () => {
  test('sobornar a Lucía avisa del riesgo, cuesta 30 min y queda registrado con advertencia', async ({ page }) => {
    await openGameScreen(page);
    // La oferta avisa en la propia escena: lo que diga no será admisible.
    // (Fase 4 del rediseño A2: el aviso vive en la tarjeta de la oferta,
    // no en el botón, que lleva solo el verbo.)
    const bribe = page.getByTestId('offer-card-irregular:bribe:lucia');
    await expect(bribe).toBeVisible();
    await expect(bribe).toContainText('no será admisible');
    // La confirmación nombra al testigo (Tomás) y la retirada a la tercera vez.
    const preview = await openPreview(page, 'offer-irregular:bribe:lucia');
    await expect(preview).toContainText('Te pueden ver Tomás Ríos.');
    await expect(preview).toContainText('A la 3.ª vez que te vean, A.C.M.E. retirará el caso.');
    await expect(preview).toContainText('Lo que te cuente no será admisible como prueba.');
    await page.getByTestId('preview-confirm').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    await expect(await clockMinutes(page)).toBe(30);
    // El acto y la advertencia quedan en el dossier, en español.
    await openDossier(page);
    const dossier = page.getByTestId('dock-panel-dossier');
    await expect(dossier).toContainText('Sobornaste a Lucía (min 30).');
    await expect(dossier).toContainText('Advertencia de A.C.M.E.');
    // Sobornar no es atajo: Lucía ya lo ha contado todo y la oferta desaparece.
    await expect(page.getByTestId('offer-irregular:bribe:lucia')).toBeHidden();
  });

  test('forzar el acceso permite recuperar sin orden, lo recuperado no es admisible y el informe descuenta', async ({ page }) => {
    await openGameScreen(page);
    // Viajar a Lisboa (el viaje puede llevar retraso semilla: no se afirma el reloj absoluto).
    await openPreview(page, 'offer-travel:lisboa');
    await page.getByTestId('preview-confirm').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    // El aviso de viaje no se cierra solo: hay que pulsar «Seguir» para
    // poder pulsar en la escena.
    await page.getByTestId('travel-animation').getByRole('button', { name: 'Seguir' }).click();
    await expect(page.getByTestId('travel-animation')).toBeHidden();
    await expect(page.getByTestId('offer-irregular:force_entry:LIS-ALM')).toBeVisible();
    const before = await clockMinutes(page);
    // La confirmación nombra a los testigos de Lisboa y la inadmisibilidad.
    const preview = await openPreview(page, 'offer-irregular:force_entry:LIS-ALM');
    await expect(preview).toContainText('Te pueden ver Marta y Inés Valera.');
    await expect(preview).toContainText('Lo que recuperes tras forzar el acceso no será admisible.');
    await page.getByTestId('preview-confirm').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    await expect(await clockMinutes(page)).toBe(before + 30);
    // Sin orden, forzar el acceso habilita la recuperación del astrolabio.
    await expect(page.getByTestId('offer-recover:astrolabio-original')).toBeVisible();
    await openPreview(page, 'offer-recover:astrolabio-original');
    await page.getByTestId('preview-confirm').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    // En el dossier, el astrolabio recuperado figura como no admisible.
    await openDossier(page);
    const dossier = page.getByTestId('dock-panel-dossier');
    await expect(dossier).toContainText('Forzaste el acceso a Almacén de depósito');
    await expect(dossier).toContainText('El astrolabio original está recuperado.');
    const row = dossier.locator('tr', { hasText: 'El astrolabio original está recuperado.' });
    await expect(row).toContainText('No');
    // Cerrar el caso: el informe final refleja el acto y descuenta 10 puntos.
    await closeCase(page);
    const report = page.getByTestId('report-full');
    await expect(report).toContainText('Conducta irregular');
    await expect(report).toContainText('Acceso forzado');
    await expect(report).toContainText('Almacén de depósito');
    await expect(report).toContainText('Conducta irregular: -10');
  });
});
