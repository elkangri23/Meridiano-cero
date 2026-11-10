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

/** Recoge EV-02 (la cerradura de la vitrina): inspeccionar la sala y la cerradura, recoger. */
async function collectLockEvidence(page: Page) {
  await page.getByTestId('offer-inspect:MAD-SALA').click();
  await expect(page.getByTestId('clock')).toContainText('10 min');
  await page.getByTestId('offer-inspect:MAD-SALA:cerradura').click();
  await expect(page.getByTestId('clock')).toContainText('30 min');
  await page.getByTestId('offer-collect:EV-02').click();
  await expect(page.getByTestId('clock')).toContainText('30 min');
}

/** Abre el laboratorio desde la pista de la escena. */
async function openLab(page: Page) {
  await page.getByTestId('open-lab').click();
  await expect(page.getByRole('dialog', { name: 'Laboratorio' })).toBeVisible();
}

/** Pregunta en la terminal y espera su respuesta. */
async function askIntel(page: Page, question: string) {
  await page.click('button:has-text("Terminal de inteligencia")');
  await expect(page.getByRole('dialog', { name: 'Terminal de inteligencia' })).toBeVisible();
  await page.getByTestId('chat-input').fill(question);
  await page.getByTestId('chat-send').click();
  await expect(page.getByTestId('chat-turns')).toContainText(question, { timeout: 15000 });
}

test.describe('E2E laboratorio forense + terminal de inteligencia', () => {
  test('el análisis es de huellas, cuesta 90 min y su resultado es el del tipo', async ({ page }) => {
    await openGameScreen(page);
    await collectLockEvidence(page);
    // La escena anuncia el análisis disponible y ya no lo lista entre sus acciones.
    await expect(page.getByTestId('open-lab')).toBeVisible();
    await expect(page.getByTestId('open-lab')).toContainText('un análisis disponible en el Laboratorio');
    await expect(page.getByTestId('offer-analyze:EV-02')).toBeHidden();
    await openLab(page);
    // El laboratorio enseña el tipo, la prueba con su frase y la nota de procedimiento.
    const lab = page.getByRole('dialog', { name: 'Laboratorio' });
    await expect(lab).toContainText('Huellas y marcas');
    await expect(lab).toContainText('La cerradura de la vitrina tiene residuo de herramienta.');
    await expect(lab).toContainText('la ausencia de registro no demuestra inocencia');
    // Pedir el análisis no avanza el reloj (los 90 min son la espera del
    // resultado, no el coste de la acción): va con un clic, sin diálogo.
    await page.getByTestId('offer-analyze:EV-02').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    await expect(page.getByTestId('clock')).toContainText('30 min');
    await expect(lab).toContainText('En curso: responde en el minuto 120');
    await page.keyboard.press('Escape');
    // Tres esperas de 30 min maduran el análisis en el minuto 120. Al
    // descubrirse el resultado, la oferta desaparece de la escena y el
    // laboratorio se abre desde la barra de herramientas.
    for (const minute of [60, 90, 120]) {
      await page.getByTestId('offer-wait:30').click();
      await expect(page.getByTestId('clock')).toContainText(`${minute} min`);
    }
    await page.click('button:has-text("Laboratorio")');
    await expect(page.getByRole('dialog', { name: 'Laboratorio' })).toBeVisible();
    await expect(lab).toContainText('Resultado: La huella técnica es compatible con una herramienta de la serie HV-17. No acusa a nadie por sí sola.');
    await page.keyboard.press('Escape');
    // El dossier enseña el resultado con su frase, no con el ID crudo.
    await page.click('button:has-text("Dossier")');
    await expect(page.getByRole('dialog', { name: 'Dossier' })).toContainText('La huella técnica es compatible con una herramienta de la serie HV-17.');
    await expect(page.getByRole('dialog', { name: 'Dossier' })).toContainText('la ausencia de registro no demuestra inocencia');
  });

  test('la terminal responde solo con hechos autorizados y dice que no hay registro sin inventar', async ({ page }) => {
    await openGameScreen(page);
    await collectLockEvidence(page);
    // Con hecho: la cerradura, con su frase del expediente.
    await askIntel(page, '¿Qué se sabe de la cerradura de la vitrina?');
    await expect(page.getByTestId('chat-turns')).toContainText('La cerradura de la vitrina tiene residuo de herramienta.', { timeout: 15000 });
    await page.keyboard.press('Escape');
    // Sin hecho: respuesta determinista de no registro, sin inventar.
    await askIntel(page, '¿Qué se sabe del submarino amarillo?');
    await expect(page.getByTestId('chat-turns')).toContainText('Sin registro en los archivos consultados.', { timeout: 15000 });
  });
});
