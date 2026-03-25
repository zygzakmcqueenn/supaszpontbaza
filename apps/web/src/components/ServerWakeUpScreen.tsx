'use client';

import { motion } from 'framer-motion';

export default function ServerWakeUpScreen() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: 'easeInOut' }}
      className="fixed inset-0 z-[999] bg-background flex flex-col items-center justify-center p-6 text-center"
    >
      {/* Tło gradientowe (Spotify Green glow) */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Kontener Animacji */}
      <div className="relative z-10 flex flex-col items-center gap-12">
        
        {/* Logo z pulsem */}
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter drop-shadow-lg">
            Party<span className="text-primary">Hitz</span>
          </h1>
        </motion.div>

        {/* Spinner i Tekst Informacyjny */}
        <div className="flex flex-col items-center gap-6">
          <div className="relative flex items-center justify-center">
            {/* Zewnętrzny, obracający się pierścień */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              className="w-16 h-16 border-4 border-gray-800 border-t-primary rounded-full"
            />
            {/* Wewnętrzny puls (Dioda) */}
            <motion.div
              animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute w-4 h-4 bg-primary rounded-full shadow-[0_0_15px_rgba(29,185,84,0.8)]"
            />
          </div>

          <div className="flex flex-col gap-2">
            <h2 className="text-xl md:text-2xl font-bold text-white tracking-wide uppercase">
              Wybudzanie serwerów imprezy...
            </h2>
            <p className="text-gray-400 text-sm md:text-base max-w-sm px-4">
              Zastosowaliśmy darmową chmurę testową. Jeśli nikogo tu dawno nie było, <span className="text-primary font-semibold">serwer może wstać w ok. 30-50 sekund</span>. Daj mu chwilę!
            </p>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
