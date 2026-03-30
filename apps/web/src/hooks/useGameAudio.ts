import useSound from 'use-sound';
import { useHaptics } from './useHaptics';
import { Preferences } from '@capacitor/preferences';
import { useEffect, useRef } from 'react';

export const useGameAudio = () => {
  const { lightImpact, heavyImpact } = useHaptics();
  const isEnabled = useRef(true);

  useEffect(() => {
    const loadSettings = () => {
      Preferences.get({ key: 'audio_fx_enabled' })
        .then(({ value }) => {
          isEnabled.current = value !== 'false';
        })
        .catch(() => {});
    };
    loadSettings();
    window.addEventListener('preferences_changed', loadSettings);
    return () => window.removeEventListener('preferences_changed', loadSettings);
  }, []);

  const [playClick] = useSound('/sounds/click.mp3', { volume: 0.5, soundEnabled: true });
  const [playCountdown] = useSound('/sounds/countdown.mp3', { volume: 0.8, soundEnabled: true });

  const playClickEffect = () => {
    if (isEnabled.current) {
      try { playClick(); } catch(e) {}
    }
    lightImpact();
  };

  const playCountdownEffect = () => {
    if (isEnabled.current) {
      try { playCountdown(); } catch(e) {}
    }
    heavyImpact();
  };

  return { playClickEffect, playCountdownEffect };
};
