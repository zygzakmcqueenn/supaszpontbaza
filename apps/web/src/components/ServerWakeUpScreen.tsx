'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor } from '@capacitor/core';

export default function ServerWakeUpScreen({ onOtaComplete }: { onOtaComplete?: () => void }) {
  const [status, setStatus] = useState<'checking_update' | 'downloading_update' | 'checking_server'>('checking_update');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const checkUpdates = async () => {
      if (!Capacitor.isNativePlatform()) {
        setStatus('checking_server');
        onOtaComplete?.();
        return;
      }
      
      try {
        await CapacitorUpdater.notifyAppReady();
        
        const serverUrl = process.env.NEXT_PUBLIC_API_URL || `http://${window.location.hostname}:3001`;
        const res = await fetch(`${serverUrl}/api/update/check`, { cache: 'no-store' });
        if (!res.ok) throw new Error('API Sync Failed');
        const data = await res.json();
        
        setStatus('downloading_update');
        
        CapacitorUpdater.addListener('download', (info: any) => {
          setProgress(Math.round(info.percent));
        });
        
        const version = await CapacitorUpdater.download({
          url: data.url,
          version: data.version
        });
        
        await CapacitorUpdater.set({ id: version.id });
        
      } catch (err) {
        setStatus('checking_server');
        onOtaComplete?.();
      }
    };
    checkUpdates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: 'easeInOut' }}
      className="fixed inset-0 z-[999] bg-background flex flex-col items-center justify-center p-6 text-center"
    >
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-12">
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter drop-shadow-lg">
            Party<span className="text-primary">Hitz</span>
          </h1>
        </motion.div>

        <div className="flex flex-col items-center gap-6">
          <div className="relative flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              className="w-16 h-16 border-4 border-gray-800 border-t-primary rounded-full"
            />
            <motion.div
              animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute w-4 h-4 bg-primary rounded-full shadow-[0_0_15px_rgba(29,185,84,0.8)]"
            />
          </div>

          <div className="flex flex-col gap-2 relative z-20 w-full max-w-sm">
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-wide uppercase transition-all duration-300">
              {status === 'checking_update' && 'Sprawdzanie aktualizacji...'}
              {status === 'downloading_update' && 'Pobieranie nowej wersji...'}
              {status === 'checking_server' && 'Szukanie serwerów imprezy...'}
            </h2>
            
            {status === 'downloading_update' ? (
              <div className="w-full mt-4">
                <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden relative">
                  <motion.div 
                    className="h-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: "linear", duration: 0.2 }}
                  />
                </div>
                <p className="text-primary font-bold mt-2 font-mono">{progress}%</p>
              </div>
            ) : (
              <p className="text-gray-400 text-sm md:text-base max-w-sm px-4">
                Zastosowaliśmy darmową chmurę testową. Jeśli nikogo tu dawno nie było, <span className="text-primary font-semibold">serwer może wstać w ok. 30-50 sekund</span>. Daj mu chwilę!
              </p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
