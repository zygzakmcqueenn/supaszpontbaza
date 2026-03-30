import useSound from 'use-sound';
import { useHaptics } from './useHaptics';
import { Preferences } from '@capacitor/preferences';

export const useGameAudio = () => {
  const { lightImpact, heavyImpact } = useHaptics();

  const [playClick] = useSound('/sounds/click.mp3', { volume: 0.5, soundEnabled: true });
  const [playCountdown] = useSound('/sounds/countdown.mp3', { volume: 0.8, soundEnabled: true });

  const playClickEffect = async () => {
    try {
      const pref = await Preferences.get({ key: 'audio_fx_enabled' });
      if (pref.value !== 'false') playClick();
    } catch(e) {}
    lightImpact();
  };

  const playCountdownEffect = async () => {
    try {
      const pref = await Preferences.get({ key: 'audio_fx_enabled' });
      if (pref.value !== 'false') playCountdown();
    } catch(e) {}
    heavyImpact();
  };

  return { playClickEffect, playCountdownEffect };
};
