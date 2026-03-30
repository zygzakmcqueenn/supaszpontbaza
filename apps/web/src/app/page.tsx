'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { io, Socket } from 'socket.io-client';
import type { GameState, Player } from '@party-hitz/shared';
import ServerWakeUpScreen from '../components/ServerWakeUpScreen';

let socket: Socket | null = null;

type ViewState = 'home' | 'hostLobby' | 'joinForm' | 'playerLobby' | 'countdown' | 'playing' | 'roundEnd' | 'hostForm' | 'soloForm';

export default function Home() {
  const [view, setView] = useState<ViewState>('home');
  const [roomCode, setRoomCode] = useState<string>('');
  const [players, setPlayers] = useState<Player[]>([]);
  
  const [inputCode, setInputCode] = useState('');
  const [inputName, setInputName] = useState('');
  
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [socketError, setSocketError] = useState('');
  const [forceSkipWakeUp, setForceSkipWakeUp] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [hostError, setHostError] = useState('');
  const [countdown, setCountdown] = useState(3);
  
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [playlistUrl, setPlaylistUrl] = useState('');
  const [answerAuthor, setAnswerAuthor] = useState('');
  const [answerTitle, setAnswerTitle] = useState('');
  const [showPointsAnimation, setShowPointsAnimation] = useState<{ points: number; id: string } | null>(null);
  const prevSegmentRef = useRef<number | undefined>(undefined);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [playedSegments, setPlayedSegments] = useState<number[]>([]);
  const [guessStep, setGuessStep] = useState<'author' | 'title'>('author');
  
  const [showExitModal, setShowExitModal] = useState(false);

  useEffect(() => {
    if (!socket) {
      const serverUrl = process.env.NEXT_PUBLIC_API_URL || `http://${window.location.hostname}:3001`;
      socket = io(serverUrl);
    }

    socket.on('connect', () => {
      setIsConnected(true);
      setSocketError('');
    });
    
    socket.on('connect_error', (err: Error) => {
      setSocketError(err.message);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setIsLoading(false);
    });

    socket.on('playersUpdated', (updatedPlayers: Player[]) => {
      setPlayers(updatedPlayers);
    });

    socket.on('gameStateUpdated', (state: GameState) => {
      setGameState(state);
      setPlayers(state.players);
      setView(prev => {
        if (state.status === 'roundEnd') return 'roundEnd';
        if (state.status === 'playing' && prev === 'roundEnd') return 'countdown';
        return prev;
      });
    });

    socket.on('gameStarting', (state: GameState) => {
      setGameState(state);
      setView('countdown');
      setIsLoading(false);
    });

    socket.on('gameStartError', (data: { message: string }) => {
      setHostError(data.message);
      setIsLoading(false);
      // Jeśli grał solo nie chcemy wyrzucać go do lobby
      if (players.length > 1) {
        setView('hostLobby');
      }
    });

    return () => {
      socket?.off('connect');
      socket?.off('disconnect');
      socket?.off('playersUpdated');
      socket?.off('gameStateUpdated');
      socket?.off('gameStarting');
      socket?.off('gameStartError');
      socket?.off('connect_error');
    };
  }, []);

  useEffect(() => {
    if (view === 'countdown') {
      setCountdown(3);
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            setView('playing');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [view]);

  // Effect to track points evaluation after segment advance
  useEffect(() => {
    if (gameState?.currentSegment && prevSegmentRef.current && gameState.currentSegment > prevSegmentRef.current) {
      // Sagment advanced!
      const prevSegRes = gameState.segmentResponses?.[prevSegmentRef.current]?.[socket?.id || ''];
      if (prevSegRes && prevSegRes.pointsAwarded > 0) {
        setShowPointsAnimation({ points: prevSegRes.pointsAwarded, id: Date.now().toString() });
        setTimeout(() => setShowPointsAnimation(null), 3000);
      }
    }
    prevSegmentRef.current = gameState?.currentSegment;
  }, [gameState?.currentSegment, gameState?.segmentResponses]);

  useEffect(() => {
    setGuessStep('author');
  }, [gameState?.currentSegment, gameState?.currentTrackIndex]);

  const handleCreateParty = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!socket || !isConnected) return;
    setIsLoading(true);

    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(e => console.log(e));
      }
    } catch(e) {}
    
    socket.emit('createRoom', { hostName: inputName.trim() || 'Host' }, (res: { success: boolean, gameState: GameState }) => {
      if (res.success) {
        setRoomCode(res.gameState.roomId);
        setPlayers(res.gameState.players);
        setGameState(res.gameState);
        setView('hostLobby');
      }
      setIsLoading(false);
    });
  };

  const handleJoinParty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !isConnected) return;
    setErrorMsg('');
    setIsLoading(true);

    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(e => console.log(e));
      }
    } catch(e) {}
    
    socket.emit('joinRoom', { roomId: inputCode, playerName: inputName }, (res: { success: boolean, message?: string, gameState?: GameState }) => {
      if (res.success && res.gameState) {
        setRoomCode(res.gameState.roomId);
        setPlayers(res.gameState.players);
        setGameState(res.gameState);
        setView('playerLobby');
      } else {
        setErrorMsg(res.message || 'Wystąpił błąd');
      }
      setIsLoading(false);
    });
  };

  const handleStartGame = () => {
    if (!socket) return;
    setHostError('');
    socket.emit('startGame', { roomId: roomCode, playlistUrl });
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(e => console.log(e));
      }
    } catch(e) {}
  };

  const handleStartSoloGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (!socket || !isConnected || playlistUrl.trim() === '') return;
    setIsLoading(true);
    setHostError('');
    
    try {
      if (document.documentElement.requestFullscreen) {
        document.documentElement.requestFullscreen().catch(e => console.log(e));
      }
    } catch(e) {}

    socket.emit('createRoom', { hostName: 'Gracz (Solo)' }, (res: { success: boolean, gameState: GameState, message?: string }) => {
      if (res.success && res.gameState) {
        setRoomCode(res.gameState.roomId);
        setPlayers(res.gameState.players);
        setGameState(res.gameState);
        socket!.emit('startGame', { roomId: res.gameState.roomId, playlistUrl });
      } else {
        setHostError(res.message || 'Wystąpił błąd podczas startu gry Solo.');
        setIsLoading(false);
      }
    });
  };

  let alreadyGuessedAuthor = false;
  let alreadyGuessedTitle = false;
  let guessedAuthorText = '';
  let guessedTitleText = '';

  if (gameState?.segmentResponses && gameState.currentSegment) {
    // Sprawdzamy przeszłe zablokowane poprawne odp
    for (let s = 1; s < gameState.currentSegment; s++) {
      const responses = gameState.segmentResponses[s];
      if (responses) {
        const myRes = responses[socket?.id || ''];
        if (myRes) {
          if (myRes.isAuthorCorrect) { alreadyGuessedAuthor = true; guessedAuthorText = myRes.author; }
          if (myRes.isTitleCorrect) { alreadyGuessedTitle = true; guessedTitleText = myRes.title; }
        }
      }
    }
  }

  let hasSubmittedThisSegment = false;
  let currentSegmentAuthorCorrect = false;
  let currentSegmentTitleCorrect = false;
  let currentSegmentAuthorSubmitted = '';
  let currentSegmentTitleSubmitted = '';

  if (gameState?.segmentResponses && gameState.currentSegment) {
    const myCurrentRes = gameState.segmentResponses[gameState.currentSegment]?.[socket?.id || ''];
    if (myCurrentRes) {
      hasSubmittedThisSegment = true;
      if (myCurrentRes.isAuthorCorrect) currentSegmentAuthorCorrect = true;
      if (myCurrentRes.isTitleCorrect) currentSegmentTitleCorrect = true;
      currentSegmentAuthorSubmitted = myCurrentRes.author;
      currentSegmentTitleSubmitted = myCurrentRes.title;
    }
  }

  const handleSubmitAnswer = (answer: { author: string; title: string } | 'SKIP') => {
    if (!socket) return;
    if (answer !== 'SKIP' && answer.author.trim() === '' && answer.title.trim() === '') return;
    
    // Zabezpieczenie na wypadek nadpisania odgadniętego już pola przez pusty submit
    if (answer !== 'SKIP') {
      if (alreadyGuessedAuthor) answer.author = guessedAuthorText;
      if (alreadyGuessedTitle) answer.title = guessedTitleText;
    }

    socket.emit('submitAnswer', { roomId: roomCode, answer });
    
    if (!alreadyGuessedAuthor) setAnswerAuthor('');
    if (!alreadyGuessedTitle) setAnswerTitle('');
  };

  // Audio Management Layer
  useEffect(() => {
    if (gameState?.tracks && gameState.currentTrackIndex !== undefined) {
      const currentTrack = gameState.tracks[gameState.currentTrackIndex];
      // Resetowanie historii segmentów odtworzonych dla nowej piosenki
      setPlayedSegments([]);
      
      if (currentTrack?.previewUrl) {
        if (!audioRef.current) {
          audioRef.current = new Audio();
        }
        if (audioRef.current.src !== currentTrack.previewUrl) {
          audioRef.current.src = currentTrack.previewUrl;
          audioRef.current.load();
        }
      }
    }
  }, [gameState?.tracks, gameState?.currentTrackIndex]);

  const handlePlayTrack = () => {
    if (!audioRef.current || !gameState?.currentSegment) return;
    const audio = audioRef.current;
    
    // Funkcjonalność Play / Stop
    if (isPlayingAudio) {
      audio.pause();
      setIsPlayingAudio(false);
      if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
      return;
    }
    
    setIsPlayingAudio(true);
    
    // Tabela milisekund odpowiadająca segmentom: 0.5s, 1s, 2s, 4s, 8s, 16s
    const segmentDurations = [500, 1000, 2000, 4000, 8000, 16000];
    const segIndex = Math.min(gameState.currentSegment - 1, 5);
    
    let accumulatedMs = 0;
    for (let i = 0; i < segIndex; i++) {
      accumulatedMs += segmentDurations[i];
    }

    const isFirstPlayInSegment = !playedSegments.includes(gameState.currentSegment);
    if (isFirstPlayInSegment) {
      setPlayedSegments(prev => [...prev, gameState.currentSegment!]);
    }

    let startTimeMs = 0;
    let durationMs = 0;

    if (isFirstPlayInSegment && segIndex > 0) {
      // 1. Pierwsze odtworzenie 2+ segmentu: gramy "od końca pierwszego do + X sekund"
      // Startuje tam gdzie skończył się poprzedni segment, i gra TYLKO czas z obecnego.
      startTimeMs = accumulatedMs;
      durationMs = segmentDurations[segIndex];
    } else {
      // 2. Pierwszy segment, LUB drugie i kolejne puszczenie tego samego segmentu: leci od nowa (00:00)
      // Odtwarza całkowity skumulowany czas piosenki (Suma poprzednich + ten segment)
      startTimeMs = 0;
      durationMs = accumulatedMs + segmentDurations[segIndex];
    }
    
    audio.currentTime = startTimeMs / 1000;
    audio.play().catch(e => console.error("Error playing audio:", e));
    
    if (playTimeoutRef.current) clearTimeout(playTimeoutRef.current);
    playTimeoutRef.current = setTimeout(() => {
      audio.pause();
      setIsPlayingAudio(false);
    }, durationMs);
  };

  const handleNextSegment = () => {
    if (!socket) return;
    socket.emit('nextSegment', { roomId: roomCode });
  };

  const handleNextRound = () => {
    if (!socket) return;
    socket.emit('nextRound', { roomId: roomCode });
  };

  const handleStartNextTrack = () => {
    if (!socket) return;
    socket.emit('startNextTrack', { roomId: roomCode });
  };

  return (
    <main className="flex h-[100dvh] w-full flex-col items-center justify-center p-3 sm:p-8 relative overflow-hidden text-white">
      <AnimatePresence>
        {(!isConnected && !forceSkipWakeUp) && (
          <ServerWakeUpScreen 
            errorMsg={socketError} 
            onSkip={() => setForceSkipWakeUp(true)} 
          />
        )}
      </AnimatePresence>
      
      {/* Tło gradientowe */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] sm:w-[600px] sm:h-[600px] bg-primary/10 blur-[100px] rounded-full pointer-events-none" />

      {/* Globalny Header (Logo + Home) */}
      <AnimatePresence>
        {view !== 'home' && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`absolute ${view === 'playing' ? 'top-[max(env(safe-area-inset-top,3.5rem),2.5rem)]' : 'top-[15vh]'} left-0 right-0 w-full flex items-center justify-between px-4 z-50 pointer-events-none`}
          >
            {/* Przycisk Home */}
            <button
              onClick={() => setShowExitModal(true)}
              className="p-3 text-gray-400 hover:text-white transition-colors pointer-events-auto"
            >
              <svg className="w-[1.8rem] h-[1.8rem] md:w-9 md:h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {/* Logo */}
            <div className="flex-1 flex justify-center pointer-events-none">
              <h1 className="text-[3.1rem] sm:text-7xl font-black tracking-tighter drop-shadow-md scale-y-[1.15] text-white leading-none">
                Party<span className="text-primary">Hitz</span>
              </h1>
            </div>

            {/* Prawy przeciwciężar dla idealnego wyśrodkowania Flexboxa */}
            <div className="w-[3.3rem] h-[3.3rem]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal wyjścia */}
      <AnimatePresence>
        {showExitModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-surface/90 backdrop-blur-xl border border-gray-800 p-10 rounded-[2.5rem] max-w-sm w-full text-center shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            >
              <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 text-red-500">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">Wyjście z gry</h2>
              <p className="text-gray-400 mb-8">Czy na pewno chcesz opuścić ten pokój i wrócić do menu głównego?</p>
              
              <div className="flex gap-4">
                <button 
                  onClick={() => setShowExitModal(false)}
                  className="flex-1 py-4 px-4 bg-gray-800 hover:bg-gray-700 text-white font-bold rounded-full transition-colors"
                >
                  Anuluj
                </button>
                <button 
                  onClick={() => {
                    setView('home');
                    setRoomCode('');
                    setGameState(null);
                    setPlayers([]);
                    setPlaylistUrl('');
                    setIsLoading(false);
                    setHostError('');
                    socket?.emit('leaveRoom');
                    setShowExitModal(false);
                  }}
                  className="flex-1 py-4 px-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-full transition-colors"
                >
                  Wyjdź
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        
        {view === 'home' && (
          <motion.div key="home" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -30 }} className="z-10 text-center w-full max-w-2xl">
            <h1 className="text-6xl md:text-8xl font-extrabold tracking-tighter mb-6">Party<span className="text-primary">Hitz</span></h1>
            <p className="text-gray-400 text-lg md:text-xl mb-12 px-4">Odtwarzaj ulubione playlisty. Odgaduj piosenki szybciej niż Twoi znajomi.</p>
            <div className="flex flex-col gap-6 justify-center px-4 max-w-sm mx-auto">
              <motion.button 
                whileHover={{ scale: 1.05 }} 
                whileTap={{ scale: 0.95 }} 
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
                onClick={() => setView('soloForm')} 
                disabled={!isConnected} 
                className={`font-bold py-5 px-10 rounded-[2rem] text-xl transition-all shadow-xl border-2 ${isConnected ? 'bg-primary border-primary hover:bg-primaryHover text-black shadow-[0_0_40px_rgba(29,185,84,0.3)]' : 'bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed'}`}
              >
                Graj Solo
              </motion.button>

              <div className="flex gap-4">
                <button disabled className="flex-1 bg-surface border border-gray-800 font-bold py-4 px-2 rounded-[1.5rem] text-sm text-gray-600 opacity-50 cursor-not-allowed">
                  Stwórz imprezę
                </button>
                <button disabled className="flex-1 bg-surface border border-gray-800 font-bold py-4 px-2 rounded-[1.5rem] text-sm text-gray-600 opacity-50 cursor-not-allowed">
                  Dołącz do gry
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {view === 'soloForm' && (
          <motion.div key="soloForm" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} className="z-10 w-full max-w-md bg-surface/80 backdrop-blur-xl border border-gray-800 p-10 rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <h2 className="text-3xl font-bold text-white mb-6 text-center">Graj Solo</h2>
            <form onSubmit={handleStartSoloGame} className="flex flex-col gap-4">
              <div>
                <label className="text-gray-400 text-sm mb-2 block font-medium pl-4">Link do playlisty (Spotify)</label>
                <input type="url" value={playlistUrl} onChange={(e) => setPlaylistUrl(e.target.value)} className="w-full bg-background border border-gray-700/50 rounded-[1.5rem] px-6 py-4 text-base text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-center" placeholder="https://open.spotify.com/playlist/..." required />
              </div>
              
              {hostError && <p className="text-red-500 text-sm text-center font-bold px-2">{hostError}</p>}
              
              <button type="submit" disabled={isLoading || playlistUrl.trim() === ''} className={`font-bold py-5 rounded-[1.5rem] text-lg mt-4 transition-all w-full shadow-lg border-2 ${playlistUrl.trim() !== '' ? 'bg-primary border-primary hover:bg-primaryHover text-black hover:scale-105' : 'bg-[#181818] border-gray-800 text-gray-600 cursor-not-allowed'}`}>
                {isLoading ? 'Ładowanie playlisty...' : 'Rozpocznij Grę'}
              </button>
              <button type="button" onClick={() => setView('home')} className="text-gray-400 hover:text-white py-2 text-sm mt-4 transition-colors">Wróć</button>
            </form>
          </motion.div>
        )}

        {view === 'hostForm' && (
          <motion.div key="hostForm" initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 50 }} className="z-10 w-full max-w-md bg-surface/80 backdrop-blur-xl border border-gray-800 p-10 rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <h2 className="text-3xl font-bold text-white mb-6 text-center">Załóż pokój</h2>
            <form onSubmit={handleCreateParty} className="flex flex-col gap-4">
              <div>
                <label className="text-gray-400 text-sm mb-2 block font-medium pl-4">Twój nick (Host)</label>
                <input type="text" maxLength={15} value={inputName} onChange={(e) => setInputName(e.target.value)} className="w-full bg-background border border-gray-700/50 rounded-full px-6 py-4 text-lg text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all text-center" placeholder="Wpisz swój pseudonim" required />
              </div>
              <button type="submit" disabled={isLoading || inputName.trim() === ''} className={`font-bold py-5 rounded-full text-lg mt-4 transition-all w-full shadow-lg ${inputName.trim() !== '' ? 'bg-primary hover:bg-primaryHover text-black hover:scale-105' : 'bg-gray-600 text-gray-400 cursor-not-allowed'}`}>
                {isLoading ? 'Tworzenie...' : 'Stwórz imprezę'}
              </button>
              <button type="button" onClick={() => setView('home')} className="text-gray-400 hover:text-white py-2 text-sm mt-2 transition-colors">Wróć</button>
            </form>
          </motion.div>
        )}

        {view === 'hostLobby' && (
          <motion.div key="hostLobby" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.2 }} className="z-10 text-center flex flex-col items-center w-full max-w-4xl">
            <h2 className="text-2xl text-gray-400 mb-4 uppercase tracking-widest font-semibold">Kod Twojej Imprezy</h2>
            <div className="bg-surface/90 backdrop-blur-md border border-gray-800 px-16 py-10 rounded-[3rem] mb-8 shadow-2xl">
              <span className="text-8xl md:text-[10rem] font-black text-white tracking-widest leading-none drop-shadow-md">{roomCode}</span>
            </div>
            
            <div className="bg-surface/50 border border-gray-800/50 w-full rounded-[2.5rem] p-8 mt-8 mb-8 backdrop-blur-md shadow-xl">
              <h3 className="text-xl text-primary font-bold mb-4 pl-4 uppercase tracking-wider text-left">Link do playlisty (Spotify)</h3>
              <input 
                type="text" 
                value={playlistUrl} 
                onChange={(e) => setPlaylistUrl(e.target.value)} 
                className="w-full bg-background/80 border border-gray-700/50 rounded-full px-8 py-5 text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all mb-8 shadow-inner" 
                placeholder="https://open.spotify.com/playlist/..." 
              />
              <h3 className="text-xl text-primary font-bold mb-4 pl-4 uppercase tracking-wider text-left">Podłączeni gracze ({players.filter(p => !p.isHost).length}):</h3>
              <div className="flex flex-wrap gap-3 justify-center min-h-[40px]">
                <AnimatePresence mode="popLayout">
                  {players.filter(p => !p.isHost).length === 0 ? (
                    <motion.p key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-gray-500 italic">Oczekiwanie na graczy...</motion.p>
                  ) : (
                    players.filter(p => !p.isHost).map((player) => (
                      <motion.span layout key={player.id} initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }} className="bg-gray-800 text-white px-4 py-2 rounded-full font-medium flex gap-2 items-center">
                        {player.name}
                        {player.score > 0 && <span className="text-primary font-bold text-sm bg-black/30 px-2 py-0.5 rounded-full">{player.score} pkt</span>}
                      </motion.span>
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>

            {hostError && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-red-500/10 border border-red-500/50 text-red-500 px-6 py-4 rounded-xl mb-6 font-medium max-w-lg">
                ⚠️ {hostError}
              </motion.div>
            )}

            <motion.button 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              onClick={handleStartGame}
              disabled={playlistUrl.trim() === ''}
              className={`font-bold py-5 px-16 rounded-full text-2xl transition-all shadow-xl ${
                playlistUrl.trim() !== '' ? 'bg-primary hover:bg-primaryHover text-black shadow-[0_0_40px_rgba(29,185,84,0.4)] hover:scale-105' : 'bg-gray-800 text-gray-500 cursor-not-allowed'
              }`}
            >
              ROZPOCZNIJ GRĘ!
            </motion.button>
          </motion.div>
        )}

        {view === 'joinForm' && (
          <motion.div key="joinForm" initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} className="z-10 w-full max-w-md bg-surface/80 backdrop-blur-xl border border-gray-800 p-10 rounded-[2.5rem] shadow-[0_0_50px_rgba(0,0,0,0.5)]">
            <h2 className="text-3xl font-bold text-white mb-6 text-center">Dołącz do zabawy</h2>
            <form onSubmit={handleJoinParty} className="flex flex-col gap-5">
              <div>
                <label className="text-gray-400 text-sm mb-2 block font-medium pl-4">Kod z ekranu</label>
                <input type="text" maxLength={4} value={inputCode} onChange={(e) => setInputCode(e.target.value.toUpperCase())} className="w-full bg-background border border-gray-700/50 rounded-full px-6 py-5 text-center text-4xl font-black text-white uppercase focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-inner" placeholder="P0K0" required />
              </div>
              <div>
                <label className="text-gray-400 text-sm mb-2 block font-medium pl-4">Twój nick</label>
                <input type="text" maxLength={15} value={inputName} onChange={(e) => setInputName(e.target.value)} className="w-full bg-background border border-gray-700/50 rounded-full px-6 py-4 text-center text-xl text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-inner" placeholder="Wpisz pseudonim" required />
              </div>
              {errorMsg && <p className="text-red-500 text-center font-bold">{errorMsg}</p>}
              <button type="submit" disabled={isLoading} className="bg-primary hover:bg-primaryHover text-black hover:scale-105 font-bold py-5 rounded-full text-xl mt-4 transition-all w-full shadow-lg">{isLoading ? 'Łączenie...' : 'Wbijam na szponta'}</button>
              <button type="button" onClick={() => setView('home')} className="text-gray-400 hover:text-white py-2 text-sm mt-2 transition-colors">Wróć</button>
            </form>
          </motion.div>
        )}

        {view === 'playerLobby' && (
          <motion.div key="playerLobby" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.2 }} className="z-10 text-center">
            <div className="w-24 h-24 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-6"><span className="text-4xl">🎉</span></div>
            <h2 className="text-3xl font-bold text-white mb-4">Jesteś w grze!</h2>
            <p className="text-gray-400 text-lg">Spójrz na ekran główny i poczekaj, aż Host wystartuje playlistę.</p>
          </motion.div>
        )}

        {view === 'countdown' && (
          <motion.div key="countdown" className="z-10 flex flex-col items-center justify-center">
            <h2 className="text-3xl text-primary font-bold mb-8 uppercase tracking-widest text-center">Przygotuj się!</h2>
            <div className="h-40 w-40 relative flex items-center justify-center">
              <AnimatePresence mode="popLayout">
                <motion.span
                  key={countdown}
                  initial={{ opacity: 0, scale: 0.2, y: 50 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 2, filter: "blur(10px)" }}
                  transition={{ duration: 0.4, type: "spring" }}
                  className="text-9xl font-black absolute text-white drop-shadow-[0_0_30px_rgba(29,185,84,0.6)]"
                >
                  {countdown}
                </motion.span>
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {view === 'playing' && gameState && (
          <motion.div key="playing" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="z-10 flex flex-col justify-end text-center w-full max-w-4xl h-full pb-8 sm:pb-12 pt-24 sm:pt-32">
            
            {/* Opcjonalny odstęp zjadający nadmiar miejsca u góry - TERAZ TRZYMA PRZYCISK PLAY! */}
            <div className="flex-1 min-h-0 flex flex-col justify-center items-center">
              {/* Główne Przyciski Hosta (Play & Next) */}
              {(players.find(p => p.id === socket?.id)?.isHost || players.length === 1) && (
                <div className="flex justify-center items-center gap-4 sm:gap-8 w-full mt-2 mb-2">
                  <button 
                    onClick={handlePlayTrack}
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all shadow-[0_0_30px_rgba(29,185,84,0.4)] ${isPlayingAudio ? 'bg-[#1DB954] scale-95' : 'bg-[#1DB954] hover:scale-105'}`}
                  >
                    {isPlayingAudio ? (
                      <svg className="w-8 h-8 sm:w-10 sm:h-10 text-black fill-current" viewBox="0 0 24 24">
                        <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                      </svg>
                    ) : (
                      <svg className="w-8 h-8 sm:w-10 sm:h-10 text-black fill-current ml-2" viewBox="0 0 24 24">
                        <path d="M5 3l14 9-14 9z"/>
                      </svg>
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Progress Bar i Czas */}
            <div className="flex gap-1 mb-4 items-end h-6 shrink-0">
              {[1, 2, 3, 4, 5, 6].map((segment, index) => {
                const flexGrows = [5, 10, 20, 40, 80, 160];
                const segmentTimesStr = ['0.5s', '1s', '2s', '4s', '8s', '16s'];
                return (
                  <div key={segment} style={{ flexGrow: flexGrows[segment - 1], flexBasis: 0 }} className="flex flex-col relative group">
                    {gameState.currentSegment === segment && (
                      <span className="text-[10px] text-gray-400 font-bold mb-1 absolute bottom-full left-0 whitespace-nowrap">
                        {segmentTimesStr[index]}
                      </span>
                    )}
                    <div className={`h-[6px] rounded-full transition-all duration-300 w-full ${gameState.currentSegment && gameState.currentSegment >= segment ? 'bg-white shadow-[0_0_10px_rgba(255,255,255,0.8)]' : 'bg-[#282828]'}`}>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* History Rows */}
            <div className="flex flex-col gap-1 mb-4 overflow-y-hidden shrink-0">
              {[1, 2, 3, 4, 5, 6].map((segment) => {
                const isCurrent = gameState.currentSegment === segment;
                const isPast = gameState.currentSegment ? segment < gameState.currentSegment : false;
                
                // Szukamy, czy użytkownik odpowiedział "SKIP" w poprzednich segmentach
                let answerText = "";
                let isSkipped = false;
                let pointsGained = 0;
                let isBlankPlaceholder = false;
                let isAuthorCorrect = false;
                let isTitleCorrect = false;
                
                if (isPast && gameState.segmentResponses && gameState.segmentResponses[segment]) {
                   const myAnswer = gameState.segmentResponses[segment][socket?.id || ''];
                   if (myAnswer) {
                     if (myAnswer.isBlankPlaceholder) {
                       isBlankPlaceholder = true;
                     } else if (myAnswer.isSkip) {
                       isSkipped = true;
                       answerText = "POMINIĘTO";
                       pointsGained = myAnswer.pointsAwarded;
                     } else {
                       const authStr = myAnswer.author || '???';
                       const titStr = myAnswer.title || '???';
                       answerText = `${authStr} - ${titStr}`;
                       pointsGained = myAnswer.pointsAwarded;
                       isAuthorCorrect = !!(myAnswer as any).isAuthorCorrect;
                       isTitleCorrect = !!(myAnswer as any).isTitleCorrect;
                     }
                   }
                }

                return (
                  <div key={segment} className={`h-[36px] sm:h-[40px] text-xs sm:text-sm border rounded flex items-center justify-between px-3 transition-colors ${
                    isCurrent ? 'border-primary shadow-[0_0_10px_rgba(29,185,84,0.2)] bg-transparent' 
                    : isPast && gameState.segmentResponses && gameState.segmentResponses[segment] && gameState.segmentResponses[segment][socket?.id || ''] ? 
                      (isBlankPlaceholder ? 'bg-[#282828] border-transparent' : (isSkipped ? 'bg-[#3E3E3E] border-[#2A2A2A]' : (isAuthorCorrect && isTitleCorrect ? 'bg-primary/20 border-primary' : (pointsGained > 0 ? 'bg-yellow-500/20 border-yellow-500' : 'bg-red-500/20 border-red-500'))))
                    : 'border-[#282828] bg-transparent'
                  }`}>
                    {answerText && (
                      <>
                        <span className={`font-bold tracking-widest truncate max-w-[80%] ${isSkipped ? 'text-gray-400' : (pointsGained > 0 ? 'text-white' : 'text-red-200')}`}>
                          {answerText}
                        </span>
                        {pointsGained > 0 && <span className="font-bold text-primary">+{pointsGained}</span>}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Action Button PRZENIESIONY WYŻEJ */}
            <div className="mt-2 mb-2 flex justify-center shrink-0">
              <button 
                onClick={() => {
                  if (answerAuthor.trim() !== '' || answerTitle.trim() !== '') {
                    handleSubmitAnswer({ author: answerAuthor, title: answerTitle });
                  } else {
                    handleSubmitAnswer('SKIP');
                  }
                }}
                disabled={!!(gameState.segmentResponses && gameState.currentSegment && gameState.segmentResponses[gameState.currentSegment] && gameState.segmentResponses[gameState.currentSegment][socket?.id || ''])}
                className={`font-black px-14 py-2 rounded-full h-14 sm:h-16 transition-all disabled:opacity-50 tracking-wider text-[13px] sm:text-base shadow-lg z-10 relative mt-4 ${
                  answerAuthor.trim() !== '' || answerTitle.trim() !== '' 
                    ? 'bg-primary hover:bg-primaryHover text-black scale-105' 
                    : 'bg-white hover:bg-gray-200 text-black'
                }`}
              >
                {answerAuthor.trim() !== '' || answerTitle.trim() !== '' ? 'ZATWIERDŹ' : 'POMIŃ'}
              </button>
            </div>

            {/* Multiple Choice Options */}
            <div className="relative w-full h-[180px] sm:h-[220px] mt-1 shrink-0 overflow-hidden">
              <AnimatePresence initial={false}>
                {guessStep === 'author' && (
                  <motion.div 
                    key="author"
                    initial={{ opacity: 0, x: -50 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                    transition={{ type: "tween", duration: 0.3 }}
                    className="absolute inset-0 flex flex-col w-full"
                  >
                    <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mb-1 text-left shrink-0">Wykonawca</span>
                    <div className="grid grid-cols-2 gap-2 min-h-0 h-full pb-4">
                      {gameState.tracks[gameState.currentTrackIndex]?.artistOptions?.map((authorOpt, i) => (
                        <button
                          key={`author-${i}`}
                          onClick={() => {
                            setAnswerAuthor(authorOpt);
                            setGuessStep('title');
                          }}
                          disabled={alreadyGuessedAuthor || hasSubmittedThisSegment}
                          className={`p-2 rounded-[1rem] font-bold text-xs sm:text-sm min-h-[3rem] sm:min-h-[3.5rem] flex justify-center items-center text-center transition-all border break-words shadow-sm ${
                            alreadyGuessedAuthor ? (authorOpt === guessedAuthorText ? 'bg-primary text-black border-primary' : 'bg-[#181818] text-gray-700 border-transparent')
                            : hasSubmittedThisSegment ? (
                              currentSegmentAuthorCorrect && authorOpt === currentSegmentAuthorSubmitted ? 'bg-primary text-black border-primary'
                              : authorOpt === currentSegmentAuthorSubmitted ? 'bg-red-500/20 text-red-500 border-red-500' 
                              : 'bg-[#181818] text-gray-700 border-transparent'
                            )
                            : answerAuthor === authorOpt ? 'bg-primary border-primary text-black transform scale-[1.02]' 
                            : 'bg-[#282828] border-transparent hover:bg-[#383838] text-white hover:border-gray-500'
                          } disabled:opacity-50`}
                        >
                          {authorOpt}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {guessStep === 'title' && (
                  <motion.div
                    key="title"
                    initial={{ opacity: 0, x: 100 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 50 }}
                    transition={{ type: "tween", duration: 0.3 }}
                    className="absolute inset-0 flex flex-col w-full"
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px] text-left shrink-0">Tytuł utworu</span>
                      <button 
                        onClick={() => setGuessStep('author')}
                        className="text-primary hover:text-primaryHover text-[10px] font-bold tracking-widest uppercase transition-colors"
                      >
                        ← Wróć do wykonawcy
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 min-h-0 h-full pb-4">
                      {gameState.tracks[gameState.currentTrackIndex]?.titleOptions?.map((titleOpt, i) => (
                        <button
                          key={`title-${i}`}
                          onClick={() => setAnswerTitle(titleOpt)}
                          disabled={alreadyGuessedTitle || hasSubmittedThisSegment}
                          className={`p-2 rounded-[1rem] font-bold text-xs sm:text-sm min-h-[3rem] sm:min-h-[3.5rem] flex justify-center items-center text-center transition-all border break-words shadow-sm ${
                            alreadyGuessedTitle ? (titleOpt === guessedTitleText ? 'bg-primary text-black border-primary' : 'bg-[#181818] text-gray-700 border-transparent')
                            : hasSubmittedThisSegment ? (
                              currentSegmentTitleCorrect && titleOpt === currentSegmentTitleSubmitted ? 'bg-primary text-black border-primary'
                              : titleOpt === currentSegmentTitleSubmitted ? 'bg-red-500/20 text-red-500 border-red-500' 
                              : 'bg-[#181818] text-gray-700 border-transparent'
                            )
                            : answerTitle === titleOpt ? 'bg-primary border-primary text-black transform scale-[1.02]' 
                            : 'bg-[#282828] border-transparent hover:bg-[#383838] text-white hover:border-gray-500'
                          } disabled:opacity-50`}
                        >
                          {titleOpt}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}

        {view === 'roundEnd' && gameState && (
          <motion.div key="roundEnd" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="z-10 w-full max-h-[90dvh] overflow-y-auto max-w-2xl bg-surface border border-gray-800 rounded-3xl p-8 shadow-2xl custom-scrollbar">
            <h2 className="text-4xl font-black text-center mb-8 text-white uppercase tracking-wider">Wyniki Rundy</h2>
            
            <div className="flex flex-col gap-4 mb-10">
              {[...players].sort((a, b) => b.score - a.score).map((player, index) => (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }} 
                  animate={{ opacity: 1, x: 0 }} 
                  transition={{ delay: index * 0.1 }}
                  key={player.id} 
                  className={`flex items-center justify-between p-4 rounded-2xl border ${index === 0 ? 'bg-primary/10 border-primary' : 'bg-[#282828] border-transparent'}`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`text-2xl font-black ${index === 0 ? 'text-primary' : 'text-gray-500'}`}>#{index + 1}</span>
                    <span className="text-xl font-bold text-white">{player.name} {player.isHost && <span className="text-sm font-normal text-gray-500 ml-2">(Host)</span>}</span>
                  </div>
                  <span className={`text-2xl font-black ${index === 0 ? 'text-primary' : 'text-white'}`}>{player.score}</span>
                </motion.div>
              ))}
            </div>

            {/* Spotify Embed Player */}
            {gameState.tracks && gameState.currentTrackIndex !== undefined && gameState.tracks[gameState.currentTrackIndex]?.spotifyId && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="mb-8 w-full max-w-md mx-auto rounded-[1rem] overflow-hidden shadow-2xl border border-gray-800/80 bg-black/40">
                <iframe 
                  style={{ borderRadius: '12px', border: 0 }} 
                  src={`https://open.spotify.com/embed/track/${gameState.tracks[gameState.currentTrackIndex].spotifyId}?utm_source=generator&theme=0&autoplay=1`} 
                  width="100%" 
                  height="152" 
                  allowFullScreen 
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
                  loading="lazy">
                </iframe>
              </motion.div>
            )}

            {(players.find(p => p.id === socket?.id)?.isHost || players.length === 1) ? (
              <div className="flex justify-center">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleStartNextTrack}
                  className="font-bold py-5 px-12 bg-primary hover:bg-primaryHover text-black rounded-full text-2xl shadow-[0_0_30px_rgba(29,185,84,0.4)]"
                >
                  START KOLEJNEJ ROUNDY
                </motion.button>
              </div>
            ) : (
              <p className="text-center text-gray-400">Oczekiwanie, aż Host rozpocznie nową rundę...</p>
            )}
          </motion.div>
        )}

      </AnimatePresence>

      <AnimatePresence>
        {showPointsAnimation && (
          <motion.div
            key={showPointsAnimation.id}
            initial={{ opacity: 0, scale: 0.5, x: "-50%", y: "-50%" }}
            animate={{ opacity: 1, scale: 1.5, x: "-50%", y: "-200%" }}
            exit={{ opacity: 0, scale: 2, x: "-50%", y: "-200%" }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className="fixed top-1/2 left-1/2 text-primary font-black text-7xl md:text-9xl drop-shadow-[0_0_40px_rgba(29,185,84,1)] z-[200] pointer-events-none"
          >
            +{showPointsAnimation.points}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}