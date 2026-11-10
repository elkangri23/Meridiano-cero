// Narración TTS segura (T5-05)
// SPEC-006: voz, velocidad, lectura manual/automática, repetir, pausar.
// Si el navegador/sistema no tiene voz compatible, la capa cae a texto sin lanzar errores.

import type { Language } from './preferences.js';

export interface TTSVoice {
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

export interface TTSStatus {
  supported: boolean;
  voices: TTSVoice[];
  speaking: boolean;
  paused: boolean;
}

export interface TTSOptions {
  voice?: string;
  /** Idioma de la interfaz (lote pequeños del catálogo 2026-11-10): en
   * modo `auto` la voz se elige en este idioma; con voz explícita, la
   * elección del usuario sigue ganando. */
  language?: Language;
  rate?: number;
  pitch?: number;
  volume?: number;
}

const DEFAULT_RATE = 1;
const DEFAULT_PITCH = 1;
const DEFAULT_VOLUME = 0.8;

export interface TTSController {
  speak(text: string, options?: TTSOptions): boolean;
  pause(): void;
  resume(): void;
  cancel(): void;
  getStatus(): TTSStatus;
  getVoices(): TTSVoice[];
}

function isSpeechSynthesisSupported(): boolean {
  // No basta con que exista la propiedad: en algunos entornos está
  // presente pero es `undefined`, y entonces no hay voz que usar.
  return getSpeechSynthesis() !== null;
}

function getSpeechSynthesis(): SpeechSynthesis | null {
  if (typeof globalThis === 'undefined') return null;
  const holder = globalThis as unknown as { speechSynthesis?: SpeechSynthesis };
  return holder.speechSynthesis ?? null;
}

function toVoice(voice: SpeechSynthesisVoice): TTSVoice {
  return {
    name: String(voice?.name ?? ''),
    lang: String(voice?.lang ?? ''),
    localService: Boolean(voice?.localService),
    default: Boolean(voice?.default),
  };
}

export function createTTSController(): TTSController {
  const synth = getSpeechSynthesis();

  let speaking = false;
  let paused = false;

  function getVoices(): TTSVoice[] {
    if (!synth) return [];
    try {
      return synth.getVoices().map(toVoice);
    } catch {
      return [];
    }
  }

  /** Voz preferida: la explícita si existe; si no, la primera del idioma
   * de la interfaz; si no hay de ese idioma, la española (comportamiento
   * anterior) y, en último recurso, la primera disponible. */
  function pickVoice(voiceName?: string, language?: Language): SpeechSynthesisVoice | null {
    const voices = synth ? synth.getVoices() : [];
    if (voiceName) {
      const match = voices.find((v: SpeechSynthesisVoice) => v.name === voiceName);
      if (match) return match;
    }
    if (language) {
      const match = voices.find((v: SpeechSynthesisVoice) => String(v.lang || '').toLowerCase().startsWith(language));
      if (match) return match;
    }
    const es = voices.find((v: SpeechSynthesisVoice) => String(v.lang || '').toLowerCase().startsWith('es'));
    return es ?? voices[0] ?? null;
  }

  /** Idioma declarado del enunciado cuando la voz no trae el suyo. */
  function defaultLang(language?: Language): string {
    return language === 'en' ? 'en-US' : language === 'fr' ? 'fr-FR' : 'es-ES';
  }

  /** Enunciado configurado: voz, idioma declarado, velocidad, tono y
   * volumen, con los marcadores de estado de lectura. */
  function buildUtterance(text: string, options: TTSOptions): SpeechSynthesisUtterance {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice(options.voice, options.language);
    utterance.voice = voice;
    // El `lang` declarado sigue a la voz elegida (antes quedaba
    // siempre en español, aunque la voz fuera inglesa o francesa).
    utterance.lang = voice?.lang || defaultLang(options.language);
    utterance.rate = options.rate ?? DEFAULT_RATE;
    utterance.pitch = options.pitch ?? DEFAULT_PITCH;
    utterance.volume = options.volume ?? DEFAULT_VOLUME;
    utterance.onstart = () => { speaking = true; paused = false; };
    utterance.onend = () => { speaking = false; paused = false; };
    utterance.onerror = () => { speaking = false; paused = false; };
    utterance.onpause = () => { paused = true; };
    utterance.onresume = () => { paused = false; };
    return utterance;
  }

  return {
    speak(text: string, options: TTSOptions = {}): boolean {
      if (!synth || !text) return false;
      // Sin voces no hay nada que leer: no se encola un enunciado que nunca
      // sonaría ni se finge estar hablando.
      if (getVoices().length === 0) return false;
      try {
        synth.speak(buildUtterance(text, options));
        return true;
      } catch {
        return false;
      }
    },
    pause(): void {
      if (synth && speaking) { synth.pause(); paused = true; }
    },
    resume(): void {
      if (synth && paused) { synth.resume(); paused = false; }
    },
    cancel(): void {
      if (synth) {
        synth.cancel();
        speaking = false;
        paused = false;

      }
    },
    getStatus(): TTSStatus {
      return {
        supported: isSpeechSynthesisSupported(),
        voices: getVoices(),
        speaking,
        paused,
      };
    },
    getVoices,
  };
}

export function createNoopTTSController(): TTSController {
  return {
    speak: () => false,
    pause: () => undefined,
    resume: () => undefined,
    cancel: () => undefined,
    getStatus: () => ({ supported: false, voices: [], speaking: false, paused: false }),
    getVoices: () => [],
  };
}
