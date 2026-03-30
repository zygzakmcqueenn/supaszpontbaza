'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Preferences } from '@capacitor/preferences';

interface SettingsMenuProps {
  onClose: () => void;
}

export default function SettingsMenu({ onClose }: SettingsMenuProps) {
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      const haptics = await Preferences.get({ key: 'haptic_fx_enabled' });
      const audio = await Preferences.get({ key: 'audio_fx_enabled' });
      
      if (haptics.value !== null) setHapticsEnabled(haptics.value === 'true');
      if (audio.value !== null) setAudioEnabled(audio.value === 'true');
    };
    loadSettings();
  }, []);

  const toggleHaptics = async () => {
    const newVal = !hapticsEnabled;
    setHapticsEnabled(newVal);
    await Preferences.set({ key: 'haptic_fx_enabled', value: newVal.toString() });
  };

  const toggleAudio = async () => {
    const newVal = !audioEnabled;
    setAudioEnabled(newVal);
    await Preferences.set({ key: 'audio_fx_enabled', value: newVal.toString() });
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-md px-4"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="bg-surface/90 backdrop-blur-xl border border-gray-800 p-8 rounded-[2.5rem] max-w-sm w-full shadow-[0_0_50px_rgba(0,0,0,0.5)]"
      >
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-white">Ustawienia</h2>
          <button onClick={onClose} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-full transition-colors">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col gap-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-white text-lg">Dźwięki interfejsu</h3>
              <p className="text-xs text-gray-400">Efekty dźwiękowe przycisków</p>
            </div>
            <button 
              onClick={toggleAudio}
              className={`w-14 h-8 rounded-full transition-colors relative ${audioEnabled ? 'bg-primary' : 'bg-gray-700'}`}
            >
              <div className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-all ${audioEnabled ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
          
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-white text-lg">Wibracje w grze</h3>
              <p className="text-xs text-gray-400">Haptyczne sprzężenie zwrotne</p>
            </div>
            <button 
              onClick={toggleHaptics}
              className={`w-14 h-8 rounded-full transition-colors relative ${hapticsEnabled ? 'bg-primary' : 'bg-gray-700'}`}
            >
              <div className={`w-6 h-6 bg-white rounded-full absolute top-1 transition-all ${hapticsEnabled ? 'left-7' : 'left-1'}`} />
            </button>
          </div>
        </div>

      </motion.div>
    </motion.div>
  );
}
