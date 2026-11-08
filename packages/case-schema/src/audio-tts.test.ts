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
});
