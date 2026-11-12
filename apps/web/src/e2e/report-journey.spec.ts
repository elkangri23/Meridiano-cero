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
  await expect(page.getByTestId('difficulty')).toBeVisible();
  await expect(page.getByTestId('difficulty')).toContainText('Normal · 48 horas');
}

/** Pulsa una oferta y espera el reloj en `minute`. Las acciones costosas o
 * irreversibles (viajar, detener, recuperar, pedir orden) enseñan el
 * diálogo de confirmación; las baratas (inspeccionar, hablar, recoger,
 * consultar, esperar) se ejecutan en el mismo clic (lote 2). El cierre ya
 * no es una oferta de escena: se hace desde la cabecera con `closeCase`. */
async function playOffer(page: Page, testId: string, minute: number) {
  const needsDialog = /offer-(travel|detain|recover|request_warrant)/.test(testId);
  await page.getByTestId(testId).click();
  if (needsDialog) {
    await expect(page.getByTestId('preview-dialog')).toBeVisible();
    await page.getByTestId('preview-confirm').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
  }
  await expect(page.getByTestId('clock')).toContainText(`${minute} min`);
  if (!needsDialog) await expect(page.getByTestId('preview-dialog')).toBeHidden();
}

/** Cierra el caso desde la cabecera (rediseño Norte): botón «Cerrar el
 * caso», pestaña Informe, «Iniciar el cierre del caso», confirmación en
 * línea y el informe final a pantalla entera. */
async function closeCase(page: Page) {
  await page.getByTestId('close-case-header').click();
  await expect(page.getByRole('tabpanel', { name: 'Informe' })).toBeVisible();
  await page.getByTestId('dock-close-start').click();
  await page.getByTestId('dock-close-yes').click();
  await expect(page.getByTestId('report-full')).toBeVisible();
  await expect(page.getByTestId('run-state')).toContainText('Partida cerrada');
}

/** Viaja desde la pestaña Mapa del dock: abre Mapa, pulsa Viajar y
 * confirma. La ciudad de destino deja de listarse como destino. */
async function travelTo(page: Page, cityId: string, minute: number) {
  await page.click('button:has-text("Mapa")');
  await page.getByTestId(`travel-${cityId}`).click();
  await expect(page.getByTestId('preview-dialog')).toBeVisible();
  await page.getByTestId('preview-confirm').click();
  await expect(page.getByTestId('preview-dialog')).toBeHidden();
  await expect(page.getByTestId('clock')).toContainText(`${minute} min`);
  await expect(page.getByTestId(`travel-${cityId}`)).toBeHidden();
}

/** Ruta A del caso fijo (470 min, 87/100): inspecciones en Madrid,
 * análisis de EV-02 que madura en París, orden y detención de Inés,
 * recuperación del astrolabio en Lisboa y cierre. */
async function playRouteA(page: Page) {
  await openGameScreen(page);
  await playOffer(page, 'offer-inspect:MAD-SALA', 10);
  await playOffer(page, 'offer-inspect:MAD-SALA:cerradura', 30);
  await playOffer(page, 'offer-collect:EV-02', 30);
  await page.click('button:has-text("Dossier")');
  await page.getByTestId('offer-analyze:EV-02').click();
  await travelTo(page, 'paris', 210);
  await playOffer(page, 'offer-query:herramienta-hv17', 210);
  await playOffer(page, 'offer-query:traslado-ines', 210);
  await playOffer(page, 'offer-wait:30', 240);
  await playOffer(page, 'offer-request_warrant:ines', 240);
  await playOffer(page, 'offer-wait:30', 270);
  await playOffer(page, 'offer-detain:ines', 300);
  await travelTo(page, 'lisboa', 450);
  await playOffer(page, 'offer-recover:astrolabio-original', 470);
  await closeCase(page);
  await expect(page.getByTestId('report-full')).toContainText('Total: 87 / 100');
}

test.describe('Informe final como recorrido (rediseño Norte, fase 4)', () => {
  test('desglose de puntos pulsable con su explicación', async ({ page }) => {
    await playRouteA(page);
    const report = page.getByTestId('report-full');
    // El primer componente (objetivos) está abierto por defecto. Las cifras
    // son las reales de la ruta A (50/25/15/10), no las del ejemplo de la
    // maqueta: 2 de 2 objetivos, 50 de 50 puntos; 6 de 9 pruebas, 14 de 25.
    await expect(page.getByTestId('report-score-detail')).toContainText('2 de 2 objetivos cumplidos: 50 de 50 puntos.');
    await page.getByTestId('report-score-evidence').click();
    await expect(page.getByTestId('report-score-detail')).toContainText('6 de 9 pruebas recogidas: 14 de 25 puntos.');
    await expect(page.getByTestId('report-score-detail')).not.toContainText('objetivos cumplidos');
    await expect(report).toContainText('Total: 87 / 100');
  });

  test('línea de tiempo andable y con hitos pulsables', async ({ page }) => {
    await playRouteA(page);
    await expect(page.getByTestId('journey-prev')).toBeDisabled();
    await expect(page.getByTestId('journey-pos')).toContainText('1 de');
    await page.getByTestId('journey-next').click();
    await expect(page.getByTestId('journey-pos')).toContainText('2 de');
    await expect(page.getByTestId('journey-prev')).toBeEnabled();
    // El primer hito despliega su minuto y la prueba que salió de ahí.
    await page.getByTestId('journey-milestone-1').click();
    const detail = page.getByTestId('journey-detail');
    await expect(detail).toContainText('Inspección en Sala de embalaje.');
    await expect(detail).toContainText('EV-01');
    // El último hito es el cierre de la investigación.
    await page.locator('[data-testid^="journey-milestone-"]').last().click();
    await expect(page.getByTestId('journey-detail')).toContainText('La investigación ha concluido.');
    await expect(page.getByTestId('journey-next')).toBeDisabled();
  });

  test('ruta por ciudades desplegable, una cada vez', async ({ page }) => {
    await playRouteA(page);
    await expect(page.getByTestId('route-map')).toBeVisible();
    // La primera ciudad (Madrid) está abierta por defecto.
    await expect(page.getByTestId('route-panel-madrid')).toBeVisible();
    await expect(page.getByTestId('route-panel-madrid')).toContainText('Sala de embalaje');
    await page.getByTestId('route-city-paris').click();
    await expect(page.getByTestId('route-panel-paris')).toBeVisible();
    await expect(page.getByTestId('route-panel-paris')).toContainText('París');
    await expect(page.getByTestId('route-panel-madrid')).toHaveCount(0);
    await page.getByTestId('route-city-lisboa').click();
    await expect(page.getByTestId('route-panel-lisboa')).toBeVisible();
    await expect(page.getByTestId('route-panel-lisboa')).toContainText('Lisboa');
    await expect(page.getByTestId('route-panel-paris')).toHaveCount(0);
  });

  test('galería de pruebas: cada carta abre por separado', async ({ page }) => {
    await playRouteA(page);
    await page.getByTestId('evidence-toggle-EV-01').click();
    await expect(page.getByTestId('evidence-detail-EV-01')).toBeVisible();
    await expect(page.getByTestId('evidence-detail-EV-01')).toContainText('Sala de embalaje');
    await expect(page.getByTestId('evidence-detail-EV-02')).toHaveCount(0);
    // Abrir una omitida no cierra la hallada: cada carta tiene su estado.
    await page.getByTestId('missed-toggle-EV-06').click();
    await expect(page.getByTestId('missed-detail-EV-06')).toBeVisible();
    await expect(page.getByTestId('evidence-detail-EV-01')).toBeVisible();
    await page.getByTestId('evidence-toggle-EV-01').click();
    await expect(page.getByTestId('evidence-detail-EV-01')).toHaveCount(0);
    await expect(page.getByTestId('missed-detail-EV-06')).toBeVisible();
  });

  test('verdad por secciones', async ({ page }) => {
    await playRouteA(page);
    await page.getByTestId('truth-who').locator('summary').click();
    await expect(page.getByTestId('report-full')).toContainText('Responsable: Inés Valera');
    await page.getByTestId('truth-how').locator('summary').click();
    await expect(page.getByTestId('report-full')).toContainText('Las pruebas decisivas que lo demuestran');
    await page.getByTestId('truth-timeline').locator('summary').click();
    await expect(page.getByTestId('report-full')).toContainText('El expediente no registra una cronología del delito');
  });

  test('cierre: cronología completa y repetir expediente', async ({ page }) => {
    await playRouteA(page);
    await page.getByTestId('report-full-chrono').click();
    await expect(page.getByTestId('chrono-full')).toBeVisible();
    await expect(page.getByTestId('chrono-full')).toContainText('La investigación ha concluido.');
    await page.getByTestId('report-full-chrono').click();
    await expect(page.getByTestId('chrono-full')).toHaveCount(0);
    // Repetir lleva al archivo con el mismo expediente preseleccionado.
    await page.getByTestId('report-repeat').click();
    await expect(page).toHaveURL(/\/archivo$/);
    const creation = page.locator('.archive-create').first();
    await expect(creation.getByRole('heading', { name: 'Nueva partida' })).toBeVisible();
    await expect(creation.getByRole('radio', { name: 'Robo internacional', exact: true })).toBeChecked();
    await expect(page.locator('.archive-create input[name="difficulty"][value="normal"]')).toBeChecked();
    await expect(creation.getByText(/astrolabio/i).first()).toBeVisible();
  });
});
