// Motor de música retro y efectos (GDD §15, T5-05)
// Banda sonora sintetizada con WebAudio (osciladores), sin archivos de
// audio externos y sin activos con copyright: melodía + bajo en bucle,
// determinista, y efectos cortos de interfaz. Todo es decorativo: ningún
// sonido es la única vía de información (regla de oro del GDD).
// La música nunca arranca sola: el AudioContext solo se crea y se reanuda
// tras un gesto del usuario (la política de autoplay del navegador lo
// bloquea sin interacción), así que `start()` es un no-op silencioso si el
// contexto sigue suspendido.

export type EffectKind = 'click' | 'confirm' | 'error' | 'travel';

export interface MusicEngine {
  readonly supported: boolean;
  isPlaying(): boolean;
  start(): void;
  stop(): void;
  /** Volumen de música, 0-100. */
  setMusicVolume(volume: number): void;
  /** Volumen de efectos, 0-100. */
  setEffectsVolume(volume: number): void;
  setMuted(muted: boolean): void;
  playEffect(kind: EffectKind): void;
  dispose(): void;
}

export type AudioContextFactory = () => AudioContext | null;

/** Paso de corchea a ~125 BPM y bucle de 16 pasos (2 compases). */
const STEP_SECONDS = 0.24;
const LOOP_STEPS = 16;
/** Melodía en MIDI (0 = silencio): La menor, dos compases. */
const MELODY: readonly number[] = [69, 72, 76, 72, 74, 76, 79, 76, 77, 76, 74, 72, 71, 72, 0, 0];
/** Bajo en MIDI, una nota por cada dos pasos (negras). */
const BASS: readonly number[] = [45, 41, 48, 43];
const MELODY_PEAK = 0.5;
const BASS_PEAK = 0.7;
/** La música es de fondo: el volumen de preferencia se escala a discreto. */
const MUSIC_CEILING = 0.35;
const EFFECTS_CEILING = 0.5;

function midiToFrequency(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) return 0;
  return Math.min(100, Math.max(0, volume));
}

function hasAudioConstructor(): boolean {
  if (typeof window === 'undefined') return false;
  const holder = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  return Boolean(holder.AudioContext ?? holder.webkitAudioContext);
}

function defaultCreateContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const holder = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const Ctor = holder.AudioContext ?? holder.webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

/** Una nota con envolvente (ataque rápido, caída hasta el final del paso). */
function scheduleNote(
  context: AudioContext, destination: AudioNode, midi: number, time: number,
  duration: number, type: OscillatorType, peak: number,
): void {
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(midiToFrequency(midi), time);
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.linearRampToValueAtTime(peak, time + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  oscillator.connect(gain);
  gain.connect(destination);
  oscillator.start(time);
  oscillator.stop(time + duration + 0.05);
}

/** Reanuda el contexto tras un gesto: sin gesto sigue suspendido y no se
 * lanza ningún error; el intento es mejor esfuerzo. */
function resumeContext(context: AudioContext): void {
  try {
    const resumed = context.resume();
    if (resumed && typeof resumed.catch === 'function') resumed.catch(() => undefined);
  } catch {
    // Sin gesto del usuario el contexto sigue suspendido: no suena nada.
  }
}

function effectNotes(kind: EffectKind): Array<{ midi: number; duration: number; type: OscillatorType }> {  switch (kind) {
    case 'confirm':
      return [
        { midi: 81, duration: 0.09, type: 'sine' },
        { midi: 88, duration: 0.14, type: 'sine' },
      ];
    case 'error':
      return [{ midi: 53, duration: 0.18, type: 'sawtooth' }];
    case 'travel':
      return [
        { midi: 72, duration: 0.07, type: 'triangle' },
        { midi: 76, duration: 0.07, type: 'triangle' },
        { midi: 79, duration: 0.07, type: 'triangle' },
        { midi: 84, duration: 0.12, type: 'triangle' },
      ];
    case 'click':
    default:
      return [{ midi: 93, duration: 0.05, type: 'sine' }];
  }
}

export function createMusicEngine(createContext: AudioContextFactory = defaultCreateContext): MusicEngine {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let musicBus: GainNode | null = null;
  let effectsBus: GainNode | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let nextTime = 0;
  let step = 0;
  let musicVolume = 60;
  let effectsVolume = 70;
  let muted = false;
  let disposed = false;

  function applyVolumes(): void {
    if (!master || !musicBus || !effectsBus || !context) return;
    master.gain.setValueAtTime(muted ? 0 : 1, context.currentTime);
    musicBus.gain.setValueAtTime((musicVolume / 100) * MUSIC_CEILING, context.currentTime);
    effectsBus.gain.setValueAtTime((effectsVolume / 100) * EFFECTS_CEILING, context.currentTime);
  }

  function ensureContext(): AudioContext | null {
    if (context) return context;
    context = createContext();
    if (!context) return null;
    try {
      master = context.createGain();
      musicBus = context.createGain();
      effectsBus = context.createGain();
      musicBus.connect(master);
      effectsBus.connect(master);
      master.connect(context.destination);
      applyVolumes();
    } catch {
      context = null;
      return null;
    }
    return context;
  }

  /** Programa las notas del bucle hasta 0,15 s por delante del reloj.
   * Mientras el contexto sigue suspendido (sin gesto del usuario) no se
   * programa nada: si no, al reanudarse sonaría de golpe todo lo acumulado. */
  function scheduleAhead(): void {
    if (!context || !musicBus) return;
    if (context.state !== 'running') {
      nextTime = context.currentTime + 0.05;
      return;
    }
    while (nextTime < context.currentTime + 0.15) {
      const melody = MELODY[step % LOOP_STEPS] ?? 0;
      if (melody > 0) scheduleNote(context, musicBus, melody, nextTime, STEP_SECONDS * 0.95, 'square', MELODY_PEAK);
      if (step % 2 === 0) {
        const bass = BASS[Math.floor(step / 2) % BASS.length] ?? 0;
        if (bass > 0) scheduleNote(context, musicBus, bass, nextTime, STEP_SECONDS * 1.9, 'triangle', BASS_PEAK);
      }
      nextTime += STEP_SECONDS;
      step = (step + 1) % LOOP_STEPS;
    }
  }

  function startTimer(): void {
    if (timer !== null) return;
    if (!context) return;
    nextTime = context.currentTime + 0.05;
    step = 0;
    scheduleAhead();
    timer = setInterval(scheduleAhead, 40);
  }

  function stopTimer(): void {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  }

  const engine: MusicEngine = {
    get supported() {
      // Con la factoría por defecto basta con que exista el constructor:
      // crear el contexto solo para comprobarlo lo dejaría suspendido sin
      // necesidad. Con una factoría inyectada (tests) sí hay que probarla.
      if (createContext === defaultCreateContext) return hasAudioConstructor();
      return ensureContext() !== null;
    },
    isPlaying(): boolean {
      return timer !== null;
    },
    start(): void {
      if (disposed || timer !== null) return;
      const ctx = ensureContext();
      if (!ctx) return;
      // Sin gesto del usuario el navegador mantiene el contexto suspendido:
      // se intenta reanudar, pero si sigue suspendido no suena nada y no
      // se lanza ningún error; el siguiente gesto lo pondrá en marcha.
      resumeContext(ctx);
      startTimer();
    },
    stop(): void {
      stopTimer();
    },
    setMusicVolume(volume: number): void {
      musicVolume = clampVolume(volume);
      applyVolumes();
    },
    setEffectsVolume(volume: number): void {
      effectsVolume = clampVolume(volume);
      applyVolumes();
    },
    setMuted(value: boolean): void {
      muted = value;
      applyVolumes();
    },
    playEffect(kind: EffectKind): void {
      if (disposed || muted || effectsVolume <= 0) return;
      const ctx = ensureContext();
      if (!ctx || !effectsBus) return;
      resumeContext(ctx);
      try {
        let time = ctx.currentTime + 0.01;
        for (const note of effectNotes(kind)) {
          scheduleNote(ctx, effectsBus, note.midi, time, note.duration, note.type, 0.6);
          time += note.duration;
        }
      } catch {
        // Un efecto no puede romper el juego.
      }
    },
    dispose(): void {
      disposed = true;
      stopTimer();
      if (context) {
        try {
          const closed = context.close();
          if (closed && typeof closed.catch === 'function') closed.catch(() => undefined);
        } catch {
          // El cierre es mejor esfuerzo.
        }
        context = null;
      }
      master = null;
      musicBus = null;
      effectsBus = null;
    },
  };
  return engine;
}
