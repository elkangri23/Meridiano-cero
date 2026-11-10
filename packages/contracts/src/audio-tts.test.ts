import { describe, it, expect, vi } from 'vitest';
import { createTTSController, createNoopTTSController, type TTSController } from './audio-tts.js';

/** Globales que el controlador lee (speechSynthesis y su constructor). */
interface TtsTestGlobals {
  speechSynthesis?: SpeechSynthesis;
  SpeechSynthesisUtterance?: typeof SpeechSynthesisUtterance;
}

function testGlobals(): TtsTestGlobals {
  return globalThis as unknown as TtsTestGlobals;
}

/** Sustituto mínimo de SpeechSynthesisUtterance para el entorno de test. */
class FakeUtterance {
  text: string;
  voice: SpeechSynthesisVoice | null = null;
  lang = '';
  rate = 1;
  pitch = 1;
  volume = 1;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onpause: (() => void) | null = null;
  onresume: (() => void) | null = null;
  constructor(text: string) { this.text = text; }
}

describe('audio-tts', () => {
  it('createNoopTTSController no habla y reporta no soportado', () => {
    const c: TTSController = createNoopTTSController();
    expect(c.speak('hola')).toBe(false);
    expect(c.getStatus().supported).toBe(false);
    expect(c.getVoices()).toEqual([]);
    expect(() => { c.pause(); c.resume(); c.cancel(); }).not.toThrow();
  });

  it('createTTSController sin speechSynthesis cae a texto sin error', () => {
    const c = createTTSController();
    expect(c.speak('hola')).toBe(false);
    expect(c.getStatus().supported).toBe(false);
    expect(c.getVoices()).toEqual([]);
  });

  it('createTTSController con speechSynthesis undefined reporta no soportado', () => {
    const globals = testGlobals();
    // `exactOptionalPropertyTypes`: la asignación directa de undefined no
    // compila; se simula la propiedad presente pero sin valor.
    (globals as unknown as Record<string, unknown>).speechSynthesis = undefined;
    const c = createTTSController();
    expect(c.speak('hola')).toBe(false);
    expect(c.getStatus().supported).toBe(false);
    delete globals.speechSynthesis;
  });

  it('createTTSController con stub global funciona', () => {
    const voices = [{ name: 'Voz ES', lang: 'es-ES', localService: true, default: true }];
    const calls: SpeechSynthesisUtterance[] = [];
    const globals = testGlobals();
    globals.speechSynthesis = {
      getVoices: () => voices,
      speak: (u: SpeechSynthesisUtterance) => { calls.push(u); },
      pause: vi.fn(),
      resume: vi.fn(),
      cancel: vi.fn(),
    } as unknown as SpeechSynthesis;
    globals.SpeechSynthesisUtterance = FakeUtterance as unknown as typeof SpeechSynthesisUtterance;
    const c = createTTSController();
    expect(c.speak('hola')).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.text).toBe('hola');
    expect(c.getStatus().supported).toBe(true);
    expect(c.getStatus().voices).toEqual(voices);
    expect(() => { c.pause(); c.resume(); c.cancel(); }).not.toThrow();
    delete globals.speechSynthesis;
    delete globals.SpeechSynthesisUtterance;
    vi.unstubAllGlobals();
  });

  it('en auto la voz sigue el idioma de la interfaz y el lang declarado sigue a la voz', () => {
    const voices = [
      { name: 'Voz ES', lang: 'es-ES', localService: true, default: true },
      { name: 'English Voice', lang: 'en-US', localService: true, default: false },
      { name: 'Voix FR', lang: 'fr-FR', localService: true, default: false },
    ];
    const calls: SpeechSynthesisUtterance[] = [];
    const globals = testGlobals();
    globals.speechSynthesis = {
      getVoices: () => voices,
      speak: (u: SpeechSynthesisUtterance) => { calls.push(u); },
      pause: vi.fn(),
      resume: vi.fn(),
      cancel: vi.fn(),
    } as unknown as SpeechSynthesis;
    globals.SpeechSynthesisUtterance = FakeUtterance as unknown as typeof SpeechSynthesisUtterance;
    const c = createTTSController();
    expect(c.speak('hello', { language: 'en' })).toBe(true);
    expect(calls[0]?.voice?.name).toBe('English Voice');
    expect(calls[0]?.lang).toBe('en-US');
    expect(c.speak('bonjour', { language: 'fr' })).toBe(true);
    expect(calls[1]?.voice?.name).toBe('Voix FR');
    expect(calls[1]?.lang).toBe('fr-FR');
    delete globals.speechSynthesis;
    delete globals.SpeechSynthesisUtterance;
    vi.unstubAllGlobals();
  });

  it('en auto sin voz del idioma cae a la española sin dejar de hablar', () => {
    const voices = [
      { name: 'Voz ES', lang: 'es-ES', localService: true, default: true },
      { name: 'English Voice', lang: 'en-US', localService: true, default: false },
    ];
    const calls: SpeechSynthesisUtterance[] = [];
    const globals = testGlobals();
    globals.speechSynthesis = {
      getVoices: () => voices,
      speak: (u: SpeechSynthesisUtterance) => { calls.push(u); },
      pause: vi.fn(),
      resume: vi.fn(),
      cancel: vi.fn(),
    } as unknown as SpeechSynthesis;
    globals.SpeechSynthesisUtterance = FakeUtterance as unknown as typeof SpeechSynthesisUtterance;
    const c = createTTSController();
    expect(c.speak('bonjour', { language: 'fr' })).toBe(true);
    expect(calls[0]?.voice?.name).toBe('Voz ES');
    expect(calls[0]?.lang).toBe('es-ES');
    delete globals.speechSynthesis;
    delete globals.SpeechSynthesisUtterance;
    vi.unstubAllGlobals();
  });

  it('la voz explícita gana al idioma de la interfaz', () => {
    const voices = [
      { name: 'Voz ES', lang: 'es-ES', localService: true, default: true },
      { name: 'English Voice', lang: 'en-US', localService: true, default: false },
    ];
    const calls: SpeechSynthesisUtterance[] = [];
    const globals = testGlobals();
    globals.speechSynthesis = {
      getVoices: () => voices,
      speak: (u: SpeechSynthesisUtterance) => { calls.push(u); },
      pause: vi.fn(),
      resume: vi.fn(),
      cancel: vi.fn(),
    } as unknown as SpeechSynthesis;
    globals.SpeechSynthesisUtterance = FakeUtterance as unknown as typeof SpeechSynthesisUtterance;
    const c = createTTSController();
    expect(c.speak('hello', { voice: 'Voz ES', language: 'en' })).toBe(true);
    expect(calls[0]?.voice?.name).toBe('Voz ES');
    expect(calls[0]?.lang).toBe('es-ES');
    delete globals.speechSynthesis;
    delete globals.SpeechSynthesisUtterance;
    vi.unstubAllGlobals();
  });

  it('createTTSController con síntesis pero sin voces no habla ni finge hablar', () => {
    const calls: SpeechSynthesisUtterance[] = [];
    const globals = testGlobals();
    globals.speechSynthesis = {
      getVoices: () => [],
      speak: (u: SpeechSynthesisUtterance) => { calls.push(u); },
      pause: vi.fn(),
      resume: vi.fn(),
      cancel: vi.fn(),
    } as unknown as SpeechSynthesis;
    globals.SpeechSynthesisUtterance = FakeUtterance as unknown as typeof SpeechSynthesisUtterance;
    const c = createTTSController();
    expect(c.speak('hola')).toBe(false);
    expect(calls).toHaveLength(0);
    expect(c.getStatus().supported).toBe(true);
    expect(c.getStatus().voices).toEqual([]);
    expect(c.getStatus().speaking).toBe(false);
    delete globals.speechSynthesis;
    delete globals.SpeechSynthesisUtterance;
    vi.unstubAllGlobals();
  });
});
