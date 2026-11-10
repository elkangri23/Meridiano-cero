import { test, expect } from '@playwright/test';

/** Crear con dificultad desde el formulario, ver la intro y borrar desde el archivo. */
test('crear con dificultad difícil muestra la intro y se puede borrar desde el archivo', async ({ page }) => {
  await page.goto('/archivo');
  await page.waitForSelector('#root > *', { timeout: 10000 });
  await page.click('button:has-text("Entrar en desarrollo local")');
  const creation = page.locator('.archive-create').first();
  await expect(creation.getByRole('heading', { name: 'Nueva partida' })).toBeVisible();
  // Delito y contenido siempre juntos: «Robo internacional · Familiar».
  await expect(creation.locator('text=Robo internacional · Familiar')).toBeVisible();
  await expect(creation.getByRole('radio', { name: /Fraude/ })).toBeDisabled();
  await creation.getByRole('button', { name: 'SORPRÉNDEME' }).click();
  await expect(creation.locator('text=Ha elegido:')).toBeVisible();
  await creation.getByRole('radio', { name: 'Robo internacional', exact: true }).check();
  await creation.getByRole('radio', { name: /Difícil/ }).check();
  await creation.getByRole('button', { name: 'Empezar partida' }).click();
  await page.waitForSelector('[data-testid="game-screen"]', { timeout: 10000 });
  // Dificultad difícil: la mitad del plazo del expediente (2880 / 2 = 1440).
  await expect(page.getByTestId('clock')).toContainText('1440 min');
  // La intro del caso se muestra al entrar en la partida nueva.
  await expect(page.getByRole('heading', { name: 'El astrolabio de las tres ciudades' })).toBeVisible();
  await expect(page.locator('text=ha desaparecido durante su traslado')).toBeVisible();
  const header = await page.locator('.game-detective small').textContent();
  const reference = /Referencia: ([a-f0-9]{8})/i.exec(header ?? '')?.[1];
  expect(reference).toBeTruthy();
  if (!reference) throw new Error('Expected run reference in header');
  // Volver al archivo: la partida aparece con su dificultad y se puede borrar.
  await page.getByRole('link', { name: 'Archivo' }).click();
  await expect(page.getByRole('heading', { name: 'Mis partidas' })).toBeVisible();
  const row = page.locator('tr', { hasText: reference });
  await expect(row).toContainText('Difícil');
  await expect(row).toContainText('Robo internacional · Familiar');
  await row.getByRole('button', { name: 'Borrar' }).click();
  await row.getByRole('button', { name: 'Sí, borrar' }).click();
  await expect(page.locator('tr', { hasText: reference })).toHaveCount(0);
});
