// Narración TTS segura (T5-05)
// SPEC-006: voz, velocidad, lectura manual/automática, repetir, pausar.
// Si el navegador/sistema no tiene voz compatible, la capa cae a texto sin lanzar errores.

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
  return typeof globalThis !== 'undefined' && 'speechSynthesis' in globalThis;
}

function getSpeechSynthesis(): any {
  if (typeof globalThis === 'undefined') return null;
  return (globalThis as any).speechSynthesis ?? null;
}

function toVoice(voice: any): TTSVoice {
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

  function pickVoice(voiceName?: string): any {
    const voices = synth ? synth.getVoices() : [];
    if (voiceName) {
      const match = voices.find((v: any) => v.name === voiceName);
      if (match) return match;
    }
    const es = voices.find((v: any) => String(v.lang || '').toLowerCase().startsWith('es'));
    return es ?? voices[0] ?? null;
  }

  return {
    speak(text: string, options: TTSOptions = {}): boolean {
      if (!synth || !text) return false;
      try {
        const utterance = new (window as any).SpeechSynthesisUtterance(text);
        utterance.voice = pickVoice(options.voice);
        utterance.lang = utterance.lang || 'es-ES';
        utterance.rate = options.rate ?? DEFAULT_RATE;
        utterance.pitch = options.pitch ?? DEFAULT_PITCH;
        utterance.volume = options.volume ?? DEFAULT_VOLUME;
        utterance.onstart = () => { speaking = true; paused = false; };
        utterance.onend = () => { speaking = false; paused = false; };
        utterance.onerror = () => { speaking = false; paused = false; };
        utterance.onpause = () => { paused = true; };
        utterance.onresume = () => { paused = false; };
        
        synth.speak(utterance);
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
