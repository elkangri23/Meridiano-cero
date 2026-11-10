import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/** Sustituto de speechSynthesis: registra lo hablado, con dos voces.
 * `speechSynthesis` es un getter del prototipo de window: la asignación
 * directa no lo sustituye, hay que definir la propiedad propia. */
const TTS_STUB = `
window.__tts = { spoken: [], cancelled: 0, paused: 0, resumed: 0, listeners: {} };
class FakeUtterance {
  constructor(text) {
    this.text = text; this.voice = null; this.lang = ''; this.rate = 1; this.pitch = 1; this.volume = 1;
    this.onstart = null; this.onend = null; this.onerror = null; this.onpause = null; this.onresume = null;
  }
}
Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: FakeUtterance, configurable: true, writable: true });
Object.defineProperty(window, 'speechSynthesis', { value: {
  getVoices: () => [
    { name: 'Voz Española', lang: 'es-ES', localService: true, default: true },
    { name: 'English Voice', lang: 'en-US', localService: false, default: false },
  ],
  speak(u) {
    window.__tts.spoken.push({ text: u.text, voice: u.voice ? u.voice.name : null, rate: u.rate, volume: u.volume });
    // Como una voz real: la lectura sigue en curso (onstart) hasta que se
    // cancela (onend); sin esto el controlador creería que ya terminó y
    // pause() no haría nada.
    window.__tts.current = u;
    if (u.onstart) u.onstart();
  },
  pause() { window.__tts.paused++; const u = window.__tts.current; if (u && u.onpause) u.onpause(); },
  resume() { window.__tts.resumed++; const u = window.__tts.current; if (u && u.onresume) u.onresume(); },
  cancel() { window.__tts.cancelled++; const u = window.__tts.current; window.__tts.current = null; if (u && u.onend) u.onend(); },
  addEventListener(type, fn) { (window.__tts.listeners[type] = window.__tts.listeners[type] || []).push(fn); },
  removeEventListener() {},
}, configurable: true, writable: true });
`;

/** Sustituto de AudioContext: cuenta los contextos creados sin sonar. */
const AUDIO_STUB = `
window.__audioContexts = [];
class FakeAudioContext {
  constructor() {
    window.__audioContexts.push(this);
    this.currentTime = 0;
    this.state = 'suspended';
    this.destination = {};
  }
  createGain() { return { gain: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  createOscillator() { return { type: '', frequency: { setValueAtTime() {} }, connect() {}, start() {}, stop() {} }; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
}
window.AudioContext = FakeAudioContext;
window.webkitAudioContext = FakeAudioContext;
`;

/** Sin síntesis de voz: la propiedad existe pero es `undefined`. */
const NO_TTS_STUB = `
Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
`;

/** Síntesis presente pero sin voces instaladas: `getVoices` vacío. */
const NO_VOICES_STUB = `
Object.defineProperty(window, 'speechSynthesis', { value: {
  getVoices: () => [],
  speak(u) { window.__tts.spoken.push(u.text); },
  pause() {}, resume() {}, cancel() { window.__tts.cancelled++; },
  addEventListener(type, fn) { (window.__tts.listeners[type] = window.__tts.listeners[type] || []).push(fn); },
  removeEventListener() {},
}, configurable: true, writable: true });
`;

async function ttsState(page: Page) {
  return page.evaluate(() => (window as unknown as { __tts: { spoken: Array<{ text: string; voice: string | null; rate: number; volume: number }>; cancelled: number; paused: number; resumed: number } }).__tts);
}

async function audioContextCount(page: Page) {
  return page.evaluate(() => (window as unknown as { __audioContexts: unknown[] }).__audioContexts.length);
}

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

async function openSettings(page: Page) {
  await page.click('button:has-text("Ajustes")');
  const settings = page.getByRole('dialog', { name: 'Ajustes' });
  await expect(settings).toBeVisible();
  return settings;
}

async function enableTts(page: Page, autoRead = false) {
  const settings = await openSettings(page);
  await settings.getByTestId('tts-enabled').check();
  if (autoRead) await settings.getByTestId('tts-autoread').check();
  await page.keyboard.press('Escape');
}

test.describe('E2E audio y TTS (GDD §15)', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(TTS_STUB + AUDIO_STUB);
  });

  test('la música no suena sin gesto del usuario y arranca tras el primero', async ({ page }) => {
    await openGameScreen(page);
    expect(await audioContextCount(page)).toBe(0);
    await page.click('button:has-text("Ajustes")');
    await expect(page.getByRole('dialog', { name: 'Ajustes' })).toBeVisible();
    expect(await audioContextCount(page)).toBeGreaterThan(0);
  });

  test('los ajustes de audio y TTS se ven y persisten tras recargar', async ({ page }) => {
    await openGameScreen(page);
    const settings = await openSettings(page);
    await expect(settings.getByTestId('audio-music-enabled')).toBeVisible();
    await expect(settings.getByTestId('audio-music-volume')).toBeVisible();
    await expect(settings.getByTestId('audio-effects-enabled')).toBeVisible();
    await expect(settings.getByTestId('audio-narration-volume')).toBeVisible();
    await expect(settings.getByTestId('tts-enabled')).toBeVisible();
    await expect(settings.getByTestId('tts-voice')).toBeVisible();
    await expect(settings.getByTestId('tts-rate')).toBeVisible();
    await expect(settings.getByTestId('tts-autoread')).toBeVisible();
    await settings.getByTestId('audio-music-volume').fill('30');
    await settings.getByTestId('tts-enabled').check();
    await settings.getByTestId('tts-voice').selectOption('English Voice');
    await settings.getByTestId('tts-rate').fill('1.5');
    await page.reload();
    await page.waitForSelector('[data-testid="game-screen"]', { timeout: 10000 });
    const again = await openSettings(page);
    await expect(again.getByTestId('audio-music-volume')).toHaveValue('30');
    await expect(again.getByTestId('tts-enabled')).toBeChecked();
    await expect(again.getByTestId('tts-voice')).toHaveValue('English Voice');
    await expect(again.getByTestId('tts-rate')).toHaveValue('1.5');
  });

  test('TTS manual: leer, repetir, pausar y detener la narración', async ({ page }) => {
    await openGameScreen(page);
    await enableTts(page);
    await page.getByTestId('offer-inspect:MAD-SALA').click();
    await expect(page.getByTestId('clock')).toContainText('10 min');
    await page.getByTestId('tts-read').click();
    let state = await ttsState(page);
    expect(state.spoken.length).toBe(1);
    expect(state.spoken[0]?.text.length).toBeGreaterThan(10);
    await page.getByTestId('tts-repeat').click();
    state = await ttsState(page);
    expect(state.spoken.length).toBe(2);
    expect(state.spoken[1]?.text).toBe(state.spoken[0]?.text);
    await page.getByTestId('tts-pause').click();
    state = await ttsState(page);
    expect(state.paused).toBe(1);
    await expect(page.getByTestId('tts-pause')).toContainText('Reanudar');
    await page.getByTestId('tts-pause').click();
    state = await ttsState(page);
    expect(state.resumed).toBe(1);
    await page.getByTestId('tts-stop').click();
    state = await ttsState(page);
    expect(state.cancelled).toBeGreaterThan(0);
  });

  test('en auto la voz sigue el idioma de la interfaz: en inglés lee con la voz inglesa', async ({ page }) => {
    await openGameScreen(page);
    // Cambiar el idioma en Ajustes (el botón se busca por testid porque
    // su texto cambia con el idioma).
    await page.getByTestId('toolbar-settings').click();
    const selector = page.getByTestId('settings-language');
    await expect(selector).toBeVisible();
    await selector.selectOption('en');
    await expect(selector).toHaveValue('en');
    await page.keyboard.press('Escape');
    await page.getByTestId('toolbar-settings').click();
    const settings = page.getByRole('dialog', { name: 'Settings' });
    await expect(settings).toBeVisible();
    await settings.getByTestId('tts-enabled').check();
    await page.keyboard.press('Escape');
    await page.getByTestId('offer-inspect:MAD-SALA').click();
    await expect(page.getByTestId('clock')).toContainText('10 min');
    await page.getByTestId('tts-read').click();
    const state = await ttsState(page);
    expect(state.spoken.length).toBe(1);
    expect(state.spoken[0]?.voice).toBe('English Voice');
  });

  test('autoRead lee la narración nueva sin pulsar nada', async ({ page }) => {
    await openGameScreen(page);
    await enableTts(page, true);
    await page.getByTestId('offer-inspect:MAD-SALA').click();
    await expect(page.getByTestId('clock')).toContainText('10 min');
    const state = await ttsState(page);
    expect(state.spoken.length).toBeGreaterThanOrEqual(1);
    expect(state.spoken[0]?.text.length).toBeGreaterThan(10);
  });

  test('el mute cancela la narración y deshabilita la lectura', async ({ page }) => {
    await openGameScreen(page);
    await enableTts(page);
    await page.getByTestId('offer-inspect:MAD-SALA').click();
    await expect(page.getByTestId('clock')).toContainText('10 min');
    await page.getByTestId('tts-read').click();
    let state = await ttsState(page);
    expect(state.spoken.length).toBe(1);
    const settings = await openSettings(page);
    await settings.getByTestId('audio-muted').check();
    await page.keyboard.press('Escape');
    state = await ttsState(page);
    expect(state.cancelled).toBeGreaterThan(0);
    await expect(page.getByTestId('tts-read')).toBeDisabled();
  });

  test('el botón Leer del chat lee la respuesta del personaje', async ({ page }) => {
    await openGameScreen(page);
    await enableTts(page);
    await page.getByTestId('offer-talk:lucia:identidad').click();
    const chat = page.getByTestId('scene-chat');
    await expect(chat).toBeVisible();
    await expect(chat.getByTestId('chat-read-0')).toBeVisible();
    await chat.getByTestId('chat-read-0').click();
    const state = await ttsState(page);
    expect(state.spoken.length).toBe(1);
    expect(state.spoken[0]?.text.length).toBeGreaterThan(10);
  });

  test('el botón Leer del dossier lee el hallazgo', async ({ page }) => {
    await openGameScreen(page);
    await enableTts(page);
    await page.getByTestId('offer-inspect:MAD-SALA').click();
    await expect(page.getByTestId('clock')).toContainText('10 min');
    await page.click('button:has-text("Dossier")');
    const dossier = page.getByRole('dialog', { name: 'Dossier' });
    await expect(dossier).toBeVisible();
    await expect(dossier.getByTestId('dossier-read-0')).toBeVisible();
    await dossier.getByTestId('dossier-read-0').click();
    const state = await ttsState(page);
    expect(state.spoken.length).toBe(1);
    expect(state.spoken[0]?.text.length).toBeGreaterThan(10);
  });

  test('sin voz, la lectura queda deshabilitada y explicada, y el texto sigue', async ({ page }) => {
    await page.addInitScript(NO_TTS_STUB);
    await openGameScreen(page);
    const settings = await openSettings(page);
    await expect(settings.getByTestId('tts-unsupported')).toBeVisible();
    await expect(settings.getByTestId('tts-unsupported')).toContainText('no ofrece síntesis de voz');
    await expect(settings.getByTestId('tts-enabled')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await page.getByTestId('offer-inspect:MAD-SALA').click();
    await expect(page.getByTestId('clock')).toContainText('10 min');
    await expect(page.getByTestId('tts-read')).toBeDisabled();
  });

  test('sin voces, pulsar Leer avisa y no habla ni apila avisos', async ({ page }) => {
    await page.addInitScript(NO_VOICES_STUB);
    await openGameScreen(page);
    await enableTts(page);
    await page.getByTestId('offer-inspect:MAD-SALA').click();
    await expect(page.getByTestId('clock')).toContainText('10 min');
    await page.getByTestId('tts-read').click();
    await expect(page.getByTestId('tts-no-voices')).toBeVisible();
    await expect(page.getByTestId('tts-no-voices')).toContainText('No hay voces disponibles');
    await page.getByTestId('tts-read').click();
    await expect(page.getByTestId('tts-no-voices')).toHaveCount(1);
    let state = await ttsState(page);
    expect(state.spoken.length).toBe(0);
    await page.getByTestId('offer-talk:lucia:identidad').click();
    const chat = page.getByTestId('scene-chat');
    await expect(chat).toBeVisible();
    await chat.getByTestId('chat-read-0').click();
    await expect(chat.getByTestId('tts-no-voices-chat')).toBeVisible();
    await page.click('button:has-text("Dossier")');
    const dossier = page.getByRole('dialog', { name: 'Dossier' });
    await expect(dossier).toBeVisible();
    await dossier.getByTestId('dossier-read-0').click();
    await expect(dossier.getByTestId('tts-no-voices-dossier')).toBeVisible();
    state = await ttsState(page);
    expect(state.spoken.length).toBe(0);
  });
});
