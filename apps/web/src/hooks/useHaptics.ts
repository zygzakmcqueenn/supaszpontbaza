import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';
import { useEffect, useRef } from 'react';

export const useHaptics = () => {
  const isEnabled = useRef(true);

  useEffect(() => {
    const loadSettings = () => {
      Preferences.get({ key: 'haptic_fx_enabled' }).then(({ value }) => {
        isEnabled.current = value !== 'false';
      }).catch(() => {});
    };
    loadSettings();
    window.addEventListener('preferences_changed', loadSettings);
    return () => window.removeEventListener('preferences_changed', loadSettings);
  }, []);

  const lightImpact = () => {
    if (!isEnabled.current) return;
    try {
      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
    } catch (error) {}
  };

  const heavyImpact = () => {
    if (!isEnabled.current) return;
    try {
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
    } catch (error) {}
  };

  return { lightImpact, heavyImpact };
};
