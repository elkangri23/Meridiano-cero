import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

const stamp = Date.now().toString(36);
const password = 'contraseña-e2e-123456';
const displayName = 'Detective E2E';
const email = `e2e-entrada-${stamp}@sintetico.invalid`;

/** Borra la cuenta de prueba si quedó sesión (DELETE anonimiza el perfil). */
async function cleanupAccount(page: Page) {
  const me = await page.request.get('/api/v1/me');
  if (!me.ok()) return;
  const session = await me.json();
  const response = await page.request.delete('/api/v1/account', {
    headers: { Origin: 'http://127.0.0.1:5173', 'x-csrf-token': session.csrfToken },
    data: { confirm: true, password },
  });
  expect(response.status()).toBe(204);
}

test.describe('Entrada web: registro, login y partida', () => {
  test('contraseñas distintas en el registro dicen que no coinciden, no «Error inesperado»', async ({ page }) => {
    await page.goto('/registro');
    await page.waitForSelector('#root > *', { timeout: 10000 });
    await page.getByLabel('Correo').fill(`e2e-distintas-${stamp}@sintetico.invalid`);
    await page.getByLabel('Nombre de detective').fill(displayName);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByLabel('Repite la contraseña').fill('contraseña-e2e-654321');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.locator('text=Las contraseñas no coinciden.')).toBeVisible();
    await expect(page.locator('text=Error inesperado.')).toBeHidden();
  });

  // Un solo registro por pasada: el límite de registro es 5 intentos / 5 min
  // por IP y la API local comparte la IP con todas las pruebas. El test de
  // registro deja la cuenta viva para el test de login, que la borra al final.
  test('registro → archivo con sesión → empezar partida → pantalla de juego con ofertas', async ({ page }) => {
    await page.goto('/registro');
    await page.waitForSelector('#root > *', { timeout: 10000 });
    await page.getByLabel('Correo').fill(email);
    await page.getByLabel('Nombre de detective').fill(displayName);
    await page.getByLabel('Contraseña', { exact: true }).fill(password);
    await page.getByLabel('Repite la contraseña').fill(password);
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.locator('text=Revisa tu correo').first()).toBeVisible();
    await expect(page.locator('text=Cuenta creada como Detective E2E.').first()).toBeVisible();
    await page.getByRole('link', { name: 'Ir al archivo' }).click();
    await expect(page.locator('text=Detective: Detective E2E')).toBeVisible();
    // La entrada al juego: el delito robo viene preseleccionado.
    const creation = page.locator('.archive-create').first();
    await expect(creation.getByRole('heading', { name: 'Nueva partida' })).toBeVisible();
    await expect(creation.getByRole('radio', { name: 'Robo internacional', exact: true })).toBeChecked();
    await expect(creation.locator('text=Robo internacional · Familiar')).toBeVisible();
    await creation.getByRole('button', { name: 'Empezar partida' }).click();
    await page.waitForSelector('[data-testid="game-screen"]', { timeout: 10000 });
    await expect(page.getByTestId('clock')).toContainText('0 min');
    await expect(page.getByTestId('offer-inspect:MAD-SALA')).toBeVisible();
    // Mis partidas muestra la partida creada con su reloj.
    await page.getByRole('link', { name: 'Archivo' }).click();
    await expect(page.getByRole('heading', { name: 'Mis partidas' })).toBeVisible();
    await expect(page.locator('text=0 min').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Jugar' }).first()).toBeVisible();
  });

  test('cerrar sesión → entrar con la cuenta → el archivo vuelve a mostrar al detective', async ({ page }) => {
    // Reutiliza la cuenta del test de registro (misma pasada, serie).
    await page.goto('/login');
    await page.waitForSelector('#root > *', { timeout: 10000 });
    await page.getByLabel('Correo').fill(email);
    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('text=Detective: Detective E2E')).toBeVisible();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await expect(page.locator('text=Sin sesión iniciada. Regístrate o entra para jugar.')).toBeVisible();
    await page.getByRole('link', { name: 'Entrar' }).click();
    await page.getByLabel('Correo').fill(email);
    await page.getByLabel('Contraseña').fill(password);
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page.locator('text=Detective: Detective E2E')).toBeVisible();
    await cleanupAccount(page);
  });

  test('verificación con token inválido explica el error sin crear nada', async ({ page }) => {
    await page.goto('/verificar?token=token-sintetico-malo');
    await page.waitForSelector('#root > *', { timeout: 10000 });
    await expect(page.locator('text=El enlace ya no es válido.')).toBeVisible();
  });

  test('recuperación pide el correo y responde sin revelar si la cuenta existe', async ({ page }) => {
    await page.goto('/recuperar');
    await page.waitForSelector('#root > *', { timeout: 10000 });
    await page.getByLabel('Correo').fill(`e2e-recuperar-${stamp}@sintetico.invalid`);
    await page.getByRole('button', { name: 'Enviar enlace' }).click();
    await expect(page.locator('text=Si la cuenta existe, se ha enviado un enlace de recuperación.')).toBeVisible();
  });
});
