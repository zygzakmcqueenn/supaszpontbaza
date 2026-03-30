import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Preferences } from '@capacitor/preferences';

export const useHaptics = () => {
  const lightImpact = async () => {
    try {
      const pref = await Preferences.get({ key: 'haptic_fx_enabled' });
      if (pref.value === 'false') return;
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch (error) {
      // Zignoruj błędy jeśli wibracje na PC nie działają
    }
  };

  const heavyImpact = async () => {
    try {
      const pref = await Preferences.get({ key: 'haptic_fx_enabled' });
      if (pref.value === 'false') return;
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch (error) {}
  };

  return { lightImpact, heavyImpact };
};
