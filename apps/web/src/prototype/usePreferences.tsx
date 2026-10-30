import { useEffect, useState, type ReactNode } from 'react';
import { createPreferenceStore, type PresentationPreferences } from '@meridiano/case-schema';

const store = createPreferenceStore();

export function usePreferences() {
  const [prefs, setPrefs] = useState<PresentationPreferences>(() => store.load());

  function update(partial: Partial<PresentationPreferences>): void {
    const next = { ...prefs, ...partial };
    setPrefs(next);
    store.save(next);
  }

  return {
    prefs,
    setLanguage: (language: PresentationPreferences['language']) => update({ language }),
    setAudio: (audio: Partial<PresentationPreferences['audio']>) =>
      update({ audio: { ...prefs.audio, ...audio } }),
    setTTS: (tts: Partial<PresentationPreferences['tts']>) =>
      update({ tts: { ...prefs.tts, ...tts } }),
    setFontMode: (fontMode: PresentationPreferences['fontMode']) => update({ fontMode }),
    setTextScale: (textScale: number) => update({ textScale }),
    setPalette: (palette: PresentationPreferences['palette']) => update({ palette }),
    setAccessibility: (accessibility: Partial<PresentationPreferences['accessibility']>) =>
      update({ accessibility: { ...prefs.accessibility, ...accessibility } }),
    reset: () => { store.clear(); setPrefs(store.load()); },
  };
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  // Estado global simple; cada consumidor llama usePreferences() de forma independiente
  // pero comparte la misma store subyacente (localStorage).
  return <>{children}</>;
}