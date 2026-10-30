import { describe, it, expect, vi } from 'vitest';
import { createTTSController, createNoopTTSController, type TTSController } from './audio-tts.js';

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
    const calls: any[] = [];
    (globalThis as any).speechSynthesis = {
      getVoices: () => voices,
      speak: (u: any) => { calls.push(u); },
      pause: vi.fn(),
      resume: vi.fn(),
      cancel: vi.fn(),
    };
    // En entorno de test, window no existe, así que lo creamos como alias de globalThis
    (globalThis as any).window = globalThis;
    (globalThis as any).SpeechSynthesisUtterance = class {
      text: string = '';
      voice: any = null;
      rate: number = 1;
      pitch: number = 1;
      volume: number = 1;
      onstart: any = null;
      onend: any = null;
      onerror: any = null;
      onpause: any = null;
      onresume: any = null;
      constructor(text: string) { this.text = text; }
    };
    const c = createTTSController();
    expect(c.speak('hola')).toBe(true);
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toBe('hola');
    expect(c.getStatus().supported).toBe(true);
    expect(c.getStatus().voices).toEqual(voices);
    expect(() => { c.pause(); c.resume(); c.cancel(); }).not.toThrow();
    delete (globalThis as any).speechSynthesis;
    delete (globalThis as any).SpeechSynthesisUtterance;
    delete (globalThis as any).window;
    vi.unstubAllGlobals();
  });
});