import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Pulido cosmético (2026-11-08): los arreglos pequeños del lote, con
 * evidencia en el navegador. El archivo tiene 6 pruebas (6 entradas
 * locales): la API de desarrollo limita la entrada local a 10 intentos
 * por IP y minuto. */

/** Crea una partida desde la UI del archivo en el modo elegido; la
 * creación confirmada navega sola a su pantalla de juego. */
async function openGameScreen(page: Page, mode: 'guided' | 'free' = 'guided') {
  await page.goto('/');
  await page.waitForSelector('#root > *', { timeout: 10000 });
  await page.click('button:has-text("Entrar en desarrollo local")');
  const creation = page.locator('.archive-create').first();
  await expect(creation.getByRole('heading', { name: 'Nueva partida' })).toBeVisible();
  await creation.getByRole('radio', { name: 'Robo internacional', exact: true }).check();
  if (mode === 'free') await creation.locator('input[name="exploration"][value="free"]').check();
  await creation.getByRole('button', { name: 'Empezar partida' }).click();
  await page.waitForSelector('[data-testid="game-screen"]', { timeout: 10000 });
  await expect(page.getByTestId('clock')).toContainText('0 min');
  await page.getByRole('button', { name: 'Entendido, a investigar' }).click();
}

/** Pulsa una oferta y espera el reloj en `minute`. Las acciones costosas o
 * irreversibles enseñan el diálogo de confirmación; las baratas se ejecutan
 * en el mismo clic. */
async function playOffer(page: Page, testId: string, minute: number) {
  const needsDialog = /offer-(travel|detain|recover|request_warrant|finish)/.test(testId);
  await page.getByTestId(testId).click();
  if (needsDialog) {
    await expect(page.getByTestId('preview-dialog')).toBeVisible();
    await page.getByTestId('preview-confirm').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
  }
  await expect(page.getByTestId('clock')).toContainText(`${minute} min`);
  if (!needsDialog) await expect(page.getByTestId('preview-dialog')).toBeHidden();
}

/** Viaja desde la ventana del mapa: abre Mapa, pulsa Viajar, confirma y cierra la ventana. */
async function travelTo(page: Page, cityId: string, minute: number) {
  await page.click('button:has-text("Mapa")');
  await page.getByTestId(`travel-${cityId}`).click();
  await expect(page.getByTestId('preview-dialog')).toBeVisible();
  await page.getByTestId('preview-confirm').click();
  await expect(page.getByTestId('preview-dialog')).toBeHidden();
  await expect(page.getByTestId('clock')).toContainText(`${minute} min`);
  // El aviso de viaje no se cierra solo: hay que pulsar «Seguir».
  await page.getByTestId('travel-animation').getByRole('button', { name: 'Seguir' }).click();
  await expect(page.getByTestId('travel-animation')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId(`travel-${cityId}`)).toBeHidden();
}

/** Abre la ventana del mapa (Atlas A.C.M.E.). */
async function openMap(page: Page) {
  await page.click('button:has-text("Mapa")');
  await expect(page.getByRole('dialog', { name: 'Mapa' })).toBeVisible();
}

test.describe('E2E pulido cosmético', () => {
  test('EV-06 ya no sale crudo: botón de recoger, inventario y dossier usan su texto', async ({ page }) => {
    await openGameScreen(page);
    await playOffer(page, 'offer-inspect:MAD-SALA', 10);
    await playOffer(page, 'offer-inspect:MAD-SALA:caja', 30);
    const collect = page.getByTestId('offer-collect:EV-06');
    await expect(collect).toBeVisible();
    await expect(collect).toContainText('La caja guarda una copia del manifiesto, con sello y firma verificables.');
    await expect(collect).not.toContainText('EV-06');
    await collect.click();
    await expect(page.getByTestId('clock')).toContainText('30 min');
    // Inventario de la escena: texto legible, sin el código crudo.
    const meta = page.locator('.game-scene-meta');
    await expect(meta).toContainText('La caja guarda una copia del manifiesto, con sello y firma verificables.');
    await expect(meta).not.toContainText('EV-06');
    // Dossier: la tabla de evidencias enseña el texto y su cabecera ya no es «ID».
    await page.getByTestId('toolbar-dossier').click();
    const dossier = page.getByRole('dialog', { name: 'Dossier' });
    await expect(dossier).toBeVisible();
    await expect(dossier.locator('table')).toContainText('La caja guarda una copia del manifiesto, con sello y firma verificables.');
    await expect(dossier.locator('table')).not.toContainText('EV-06');
    await expect(dossier.locator('table thead')).toContainText('Evidencia');
    await expect(dossier.locator('table thead')).not.toContainText('ID');
  });

  test('con la orden concedida no se ofrece «Solicitar orden» y la detenida no sigue en Lisboa', async ({ page }) => {
    await openGameScreen(page);
    await playOffer(page, 'offer-inspect:MAD-SALA', 10);
    await playOffer(page, 'offer-inspect:MAD-SALA:cerradura', 30);
    await playOffer(page, 'offer-collect:EV-02', 30);
    await page.getByTestId('open-lab').click();
    await page.getByTestId('offer-analyze:EV-02').click();
    await expect(page.getByTestId('clock')).toContainText('30 min');
    await page.keyboard.press('Escape');
    await travelTo(page, 'paris', 210);
    await playOffer(page, 'offer-query:herramienta-hv17', 210);
    await playOffer(page, 'offer-query:traslado-ines', 210);
    await playOffer(page, 'offer-wait:30', 240);
    await playOffer(page, 'offer-request_warrant:ines', 240);
    await playOffer(page, 'offer-wait:30', 270);
    // La orden ha madurado: la oferta de pedirla ya no aparece, pero la de detener sí.
    await expect(page.getByTestId('offer-request_warrant:ines')).toHaveCount(0);
    await expect(page.getByTestId('offer-detain:ines')).toBeVisible();
    await playOffer(page, 'offer-detain:ines', 300);
    await travelTo(page, 'lisboa', 450);
    // Inés fue detenida en París: ya no está en la escena de Lisboa.
    await expect(page.getByTestId('offer-talk:ines:identidad')).toHaveCount(0);
    await expect(page.locator('.game-scene-npc')).not.toContainText('Inés Valera');
  });

  test('forzar el acceso avisa de la alternativa legal (orden con una prueba de acceso)', async ({ page }) => {
    await openGameScreen(page);
    await travelTo(page, 'lisboa', 120);
    const force = page.getByTestId('offer-irregular:force_entry:LIS-ALM');
    await expect(force).toBeVisible();
    await expect(force).toContainText('Forzar el acceso a Almacén de depósito');
    await expect(force).toContainText('o pide una orden con una prueba de acceso');
  });

  test('el buscador del atlas filtra la lista y muestra el coste antes de pulsar', async ({ page }) => {
    await openGameScreen(page);
    await openMap(page);
    const map = page.getByRole('dialog', { name: 'Mapa' });
    await map.getByTestId('map-search').fill('Barcelona');
    // La lista completa sin filtrar desaparece; el resultado enseña el coste.
    await expect(page.getByTestId('travel-paris')).toHaveCount(0);
    await expect(page.getByTestId('travel-search-barcelona')).toContainText('Viajar · 300 min');
    // Roma no está en el catálogo: mensaje honesto y lista filtrada.
    await map.getByTestId('map-search').fill('Roma');
    await expect(map.getByTestId('map-search-results')).toContainText('Ninguna ciudad admitida coincide con «Roma»');
    await expect(page.getByTestId('travel-paris')).toHaveCount(0);
    // Sin búsqueda, la lista completa vuelve.
    await map.getByTestId('map-search').fill('');
    await expect(page.getByTestId('travel-paris')).toBeVisible();
  });

  test('cancelar el diálogo limpia el aviso y la consola persiste tras recargar', async ({ page }) => {
    await openGameScreen(page);
    await playOffer(page, 'offer-inspect:MAD-SALA', 10);
    await expect(page.locator('.game-console')).toContainText('Inspección en Sala de embalaje.');
    // Cancelar «Cerrar el caso» no deja el «Preparando:…» pegado.
    await page.getByTestId('offer-finish').click();
    await expect(page.getByTestId('preview-dialog')).toBeVisible();
    await page.getByTestId('preview-cancel').click();
    await expect(page.getByTestId('preview-dialog')).toBeHidden();
    await expect(page.getByRole('status', { name: 'Acción cancelada.' })).toBeVisible();
    // Al recargar, la consola sigue donde se quedó, no en el texto genérico.
    await page.reload();
    await page.waitForSelector('[data-testid="game-screen"]', { timeout: 10000 });
    await expect(page.locator('.game-console')).toContainText('Inspección en Sala de embalaje.');
  });

  test('el atlas distingue escenarios y turistas, no solapa etiquetas y su texto alternativo se actualiza', async ({ page }) => {
    await openGameScreen(page, 'free');
    await openMap(page);
    const atlas = page.locator('.game-atlas');
    // En libre, París aún no se conoce: el texto alternativo no la nombra.
    await expect.poll(async () => atlas.getAttribute('aria-label')).not.toContain('París');
    await page.keyboard.press('Escape');
    // Inspeccionar la sala descubre París.
    await playOffer(page, 'offer-inspect:MAD-SALA', 10);
    await openMap(page);
    await expect.poll(async () => atlas.getAttribute('aria-label')).toContain('París');
    // Marcadores distintos: 2 escenarios (Madrid, París) y 6 turísticos.
    await expect(page.locator('.game-atlas-city--case')).toHaveCount(2);
    await expect(page.locator('.game-atlas-city--tourist')).toHaveCount(6);
    // Ninguna etiqueta se solapa con otra.
    const boxes = await page.locator('.game-atlas-city').evaluateAll(elements =>
      elements.map(element => {
        const rect = element.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }));
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        if (!a || !b) continue;
        const overlaps = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlaps).toBe(false);
      }
    }
    // La ventana del equipo conserva su posición tras recargar.
    await page.keyboard.press('Escape');
    await page.getByTestId('toolbar-team').click();
    const team = page.getByRole('dialog', { name: 'Equipo A.C.M.E.' });
    await expect(team).toBeVisible();
    await team.getByRole('button', { name: 'Mover' }).click();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    const before = await team.boundingBox();
    await page.reload();
    await page.waitForSelector('[data-testid="game-screen"]', { timeout: 10000 });
    await page.getByTestId('toolbar-team').click();
    const after = await page.getByRole('dialog', { name: 'Equipo A.C.M.E.' }).boundingBox();
    expect(after).toEqual(before);
  });
});
