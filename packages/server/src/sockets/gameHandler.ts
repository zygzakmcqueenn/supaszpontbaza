import { Server, Socket } from 'socket.io';
import { GameState, Player, Track } from '@party-hitz/shared';
import { getPlaylistTracks } from '../services/spotify';

const games = new Map<string, GameState>();

export const registerGameHandlers = (io: Server, socket: Socket) => {
  
  // 1. TWORZENIE POKOJU PRZEZ HOSTA
  socket.on('createRoom', (data: { hostName: string }, callback) => {
    const roomId = Math.random().toString(36).substring(2, 6).toUpperCase();
    
    const hostPlayer: Player = {
      id: socket.id,
      name: data.hostName,
      score: 0,
      isHost: true
    };

    const newGame: GameState = {
      roomId,
      status: 'waiting',
      players: [hostPlayer],
      currentTrackIndex: 0,
      tracks: []
    };

    games.set(roomId, newGame);
    socket.join(roomId);

    console.log(`🏠 Pokój ${roomId} stworzony przez: ${data.hostName}`);
    
    callback({ success: true, gameState: newGame });
  });

  // 2. DOŁĄCZANIE GRACZA DO POKOJU
  socket.on('joinRoom', (data: { roomId: string, playerName: string }, callback) => {
    const code = data.roomId.toUpperCase();
    const room = games.get(code);

    if (!room) {
      return callback({ success: false, message: 'Nie znaleziono pokoju o takim kodzie!' });
    }

    if (room.status !== 'waiting') {
      return callback({ success: false, message: 'Gra już się rozpoczęła!' });
    }

    const newPlayer: Player = {
      id: socket.id,
      name: data.playerName,
      score: 0,
      isHost: false
    };

    room.players.push(newPlayer);
    socket.join(code);

    console.log(`🎮 Gracz ${data.playerName} dołączył do pokoju ${code}`);
    
    // Informujemy wszystkich w pokoju o nowej liście graczy
    io.to(code).emit('playersUpdated', room.players);
    
    callback({ success: true, gameState: room });
  });
  // 4. ROZPOCZĘCIE GRY (Tylko Host)
  socket.on('startGame', async (data: { roomId: string, playlistUrl?: string }) => {
    const code = data.roomId.toUpperCase();
    const room = games.get(code);

    if (room && data.playlistUrl) {
      room.status = 'playing'; // Zmieniamy status pokoju
      room.playlistUrl = data.playlistUrl;
      room.currentSegment = 1;
      room.roundReadyToAdvance = false;
      room.segmentReadyToAdvance = false;
      room.segmentResponses = { 1: {} };
      
      try {
        // 1. Wydobądź ID playlisty ze Spotify URL
        // Np: https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=...
        const playlistIdMatch = data.playlistUrl.match(/playlist\/([a-zA-Z0-9]+)/);
        if (!playlistIdMatch) {
          io.to(code).emit('gameStartError', { message: 'Nieprawidłowy link do playlisty Spotify. Wklej poprawny URL.' });
          io.to(code).emit('gameStateUpdated', { ...room, status: 'hostLobby' });
          return;
        }
        const playlistId = playlistIdMatch[1];

        // Krzyczymy do WSZYSTKICH w tym pokoju (Host i Gracze): "Ładuję..."
        // Możemy użyć tymczasowego statusu lub po prostu czekać.
        
        // 2. Pobierz listę ze Spotify i gotowe MP3
        const spotifyTracks = await getPlaylistTracks(playlistId);
        
        // 3. Konwertuj na format Gry (konwertujemy całą dostępną pulę ze Scrapera, do ~100)
        const validTracks: Track[] = spotifyTracks.map(st => ({
          id: Math.random().toString(36).substring(2, 9),
          title: st.title,
          artist: st.author,
          coverUrl: st.coverUrl,
          previewUrl: st.previewUrl,
          spotifyId: st.spotifyId
        }));

        if (validTracks.length === 0) {
           console.error(`Nie udało się znaleźć darmowych podglądów dla żadnej z piosenek z tej playlisty!`);
           io.to(code).emit('gameStartError', { message: 'Nie udało się dopasować żadnej piosenki z tej playlisty do darmowych próbek audio.' });
           io.to(code).emit('gameStateUpdated', { ...room, status: 'hostLobby' }); // Coś poszło nie tak, cofnij status
           return;
        } else {
           const allArtists = Array.from(new Set(validTracks.map(t => t.artist)));
           const allTitles = Array.from(new Set(validTracks.map(t => t.title)));

           // Mieszaj Ścieżki z całej dostępnej puli (max 100), utnij do 30, a następnie dobierz fałszywe opcje ABCD
           room.tracks = validTracks.sort(() => 0.5 - Math.random()).slice(0, 30).map(track => {
             // Wylosuj 3 zmyłki artysty
             const wrongArtists = allArtists.filter(a => a !== track.artist).sort(() => 0.5 - Math.random()).slice(0, 3);
             const artistOptions = [...wrongArtists, track.artist].sort(() => 0.5 - Math.random());
             
             // Wylosuj 3 zmyłki tytułu
             const wrongTitles = allTitles.filter(t => t !== track.title).sort(() => 0.5 - Math.random()).slice(0, 3);
             const titleOptions = [...wrongTitles, track.title].sort(() => 0.5 - Math.random());
             
             return {
               ...track,
               artistOptions,
               titleOptions
             };
           });

           const firstTrack = room.tracks[0];
           room.currentTrackIndex = 0;
           room.currentTrackDemo = { author: firstTrack.artist, title: firstTrack.title };
        }

        io.to(code).emit('gameStarting', room); 
        console.log(`🚀 Gra w pokoju ${code} właśnie wystartowała! Załadowano ${room.tracks.length} grywalnych utworów.`);
      } catch (err: any) {
        console.error("Błąd ładowania playlisty w startGame:", err);
        const errorMsg = err?.message?.includes('403') 
          ? 'Spotify zablokowało dostęp (Błąd 403). Upewnij się, że playlista JEST PUBLICZNA, a Twoja aplikacja na Spotify Developer Dashboard ma przypisane "Web API".' 
          : 'Wystąpił nieoczekiwany błąd podczas wczytywania playlisty ze Spotify.';
        io.to(code).emit('gameStartError', { message: errorMsg });
        io.to(code).emit('gameStateUpdated', { ...room, status: 'hostLobby' });
      }
    }
  });

  // 5. PRZESŁANIE ODPOWIEDZI LUB POMINIĘCIA
  socket.on('submitAnswer', (data: { roomId: string, answer: { author: string; title: string } | 'SKIP' }) => {
    const code = data.roomId.toUpperCase();
    const room = games.get(code);

    if (room && room.status === 'playing' && room.currentSegment && room.segmentResponses) {
      const currentResponses = room.segmentResponses[room.currentSegment] || {};
      
      let points = 0;
      let submittedAuthor = '';
      let submittedTitle = '';
      let isSkip = false;
      let isAuthorCorrect = false;
      let isTitleCorrect = false;

      // Sprawdź, czy gracz już wcześniej zgadł Autora lub Tytuł
      let alreadyGuessedAuthor = false;
      let alreadyGuessedTitle = false;
      for (let s = 1; s < room.currentSegment; s++) {
        const prevRes = room.segmentResponses[s]?.[socket.id];
        if (prevRes?.isAuthorCorrect) alreadyGuessedAuthor = true;
        if (prevRes?.isTitleCorrect) alreadyGuessedTitle = true;
      }

      // Oblicz mnożnik (segment 1 = x6, ... segment 6 = x1)
      const multiplier = 7 - room.currentSegment;

      if (data.answer === 'SKIP') {
        isSkip = true;
      } else {
        submittedAuthor = data.answer.author;
        submittedTitle = data.answer.title;
        
        // Punktacja: po 10 pkt bazowych za idealne trafienie pola * mnożnik segmentu
        if (room.currentTrackDemo) {
          if (!alreadyGuessedAuthor && submittedAuthor.toLowerCase().trim() === room.currentTrackDemo.author.toLowerCase()) {
            points += 10 * multiplier;
            isAuthorCorrect = true;
          }
          if (!alreadyGuessedTitle && submittedTitle.toLowerCase().trim() === room.currentTrackDemo.title.toLowerCase()) {
            points += 10 * multiplier;
            isTitleCorrect = true;
          }
        }
      }
      
      // Zabezpieczenie przed wielokrotnym nabijaniem punktów w tym samym segmencie
      const previousPoints = currentResponses[socket.id]?.pointsAwarded || 0;
      const netPoints = points - previousPoints;

      // Dodaj (albo odejmij jeśli gracz zmienił dobrą na złą odpowiedź) punkty graczowi
      const playerIndex = room.players.findIndex(p => p.id === socket.id);
      if (playerIndex !== -1) {
        room.players[playerIndex].score += netPoints;
      }

      // Zapisz odpowiedź gracza
      currentResponses[socket.id] = { author: submittedAuthor, title: submittedTitle, isSkip, pointsAwarded: points, isAuthorCorrect, isTitleCorrect };
      room.segmentResponses[room.currentSegment] = currentResponses;

      console.log(`📝 Gracz ${socket.id} (Pokój ${code}) - Segment ${room.currentSegment}: ${isSkip ? 'SKIP' : `Autor: ${submittedAuthor}, Tytuł: ${submittedTitle}`} | Punkty runda: ${points}`);

      // Sprawdź, czy wszyscy gracze (w tym Host) oddali odpowiedź wg obecnego segmentu
      const playersAnswered = Object.keys(currentResponses).length;
      if (playersAnswered >= room.players.length) {
        
        // Sprawdź ilu graczy ukończyło kompletnie piosenkę po tym segmencie
        let playersCompleted = 0;
        for (const p of room.players) {
          let hasAuth = false;
          let hasTit = false;
          for (let s = 1; s <= room.currentSegment; s++) {
            if (room.segmentResponses[s]?.[p.id]?.isAuthorCorrect) hasAuth = true;
            if (room.segmentResponses[s]?.[p.id]?.isTitleCorrect) hasTit = true;
          }
          if (hasAuth && hasTit) playersCompleted++;
        }

        if (room.currentSegment >= 6 || playersCompleted >= room.players.length) {
          console.log(`🏁 Wszyscy zagrali / Piosenka odgadnięta. Oczekiwanie na NOWĄ RUNDĘ (przejście za 3.5s).`);
          room.roundReadyToAdvance = true;
          
          setTimeout(() => {
            const currentRoom = games.get(code);
            if (currentRoom && currentRoom.status === 'playing' && currentRoom.roundReadyToAdvance) {
              currentRoom.roundReadyToAdvance = false;
              currentRoom.segmentReadyToAdvance = false;
              currentRoom.status = 'roundEnd';
              console.log(`📊 Otwieram Tablicę Wyników w pokoju ${code}`);
              io.to(code).emit('gameStateUpdated', currentRoom);
            }
          }, 3500);

        } else {
          console.log(`⏸ Wszyscy zagrali w segmencie ${room.currentSegment}. Automatyczne przejście za 3.5s.`);
          room.segmentReadyToAdvance = true;

          setTimeout(() => {
            const currentRoom = games.get(code);
            if (currentRoom && currentRoom.status === 'playing' && currentRoom.segmentReadyToAdvance) {
              currentRoom.segmentReadyToAdvance = false;
              
              if (currentRoom.currentSegment && currentRoom.currentSegment < 6) {
                currentRoom.currentSegment++;
                currentRoom.segmentResponses![currentRoom.currentSegment] = {};
                
                for (const p of currentRoom.players) {
                  let hasAuth = false;
                  let hasTit = false;
                  for (let s = 1; s < currentRoom.currentSegment; s++) {
                    if (currentRoom.segmentResponses![s]?.[p.id]?.isAuthorCorrect) hasAuth = true;
                    if (currentRoom.segmentResponses![s]?.[p.id]?.isTitleCorrect) hasTit = true;
                  }
                  if (hasAuth && hasTit) {
                    currentRoom.segmentResponses![currentRoom.currentSegment][p.id] = {
                      author: '', title: '', isSkip: true, pointsAwarded: 0, 
                      isAuthorCorrect: true, isTitleCorrect: true, isBlankPlaceholder: true
                    };
                  }
                }
                
                console.log(`⏭ Automatycznie przejście do segmentu ${currentRoom.currentSegment} w pokoju ${code}`);
                io.to(code).emit('gameStateUpdated', currentRoom);
              }
            }
          }, 3500);
        }
      }
      io.to(code).emit('gameStateUpdated', room);
    }
  });

  // 6. NASTĘPNY SEGMENT (Tylko Host)
  socket.on('nextSegment', (data: { roomId: string }) => {
    const code = data.roomId.toUpperCase();
    const room = games.get(code);

    if (room && room.status === 'playing' && room.segmentReadyToAdvance && room.currentSegment) {
      const hostPlayer = room.players.find(p => p.id === socket.id);
      if (hostPlayer && hostPlayer.isHost) {
        room.segmentReadyToAdvance = false;
        
        if (room.currentSegment < 6) {
          room.currentSegment++;
          room.segmentResponses![room.currentSegment] = {};
          
          // Automatycznie przepuść graczy, którzy w przeszłości odgadli już wszystko (isAuthorCorrect && isTitleCorrect)
          for (const p of room.players) {
            let hasAuth = false;
            let hasTit = false;
            for (let s = 1; s < room.currentSegment; s++) {
              if (room.segmentResponses![s]?.[p.id]?.isAuthorCorrect) hasAuth = true;
              if (room.segmentResponses![s]?.[p.id]?.isTitleCorrect) hasTit = true;
            }
            if (hasAuth && hasTit) {
              room.segmentResponses![room.currentSegment][p.id] = {
                author: '', title: '', isSkip: true, pointsAwarded: 0, 
                isAuthorCorrect: true, isTitleCorrect: true, isBlankPlaceholder: true
              };
            }
          }
          
          console.log(`⏭ Host przeszedł do segmentu ${room.currentSegment} w pokoju ${code}`);
          io.to(code).emit('gameStateUpdated', room);
        }
      }
    }
  });

  // 7. NASTĘPNA RUNDA / POKAŻ LEADERBOARD (Tylko Host)
  socket.on('nextRound', (data: { roomId: string }) => {
    const code = data.roomId.toUpperCase();
    const room = games.get(code);

    if (room && room.status === 'playing' && room.roundReadyToAdvance) {
      const hostPlayer = room.players.find(p => p.id === socket.id);
      if (hostPlayer && hostPlayer.isHost) {
        room.status = 'roundEnd';
        room.segmentReadyToAdvance = false;
        room.roundReadyToAdvance = false;
        
        console.log(`🏆 Runda zakończona w pokoju ${code}. Przejście do Leaderboardu.`);
        io.to(code).emit('gameStateUpdated', room);
      }
    }
  });

  // 8. START KOLEJNEGO UTWORU PO LEADERBOARDZIE
  socket.on('startNextTrack', (data: { roomId: string }) => {
    const code = data.roomId.toUpperCase();
    const room = games.get(code);

    if (room && room.status === 'roundEnd') {
      const hostPlayer = room.players.find(p => p.id === socket.id);
      if (hostPlayer && hostPlayer.isHost) {
        
        // Zwiększ index utworu
        let nextIndex = room.currentTrackIndex + 1;
        if (nextIndex >= room.tracks.length) {
          nextIndex = 0; // Zapętlamy playlistę gdy dojdziemy do końca
        }
        room.currentTrackIndex = nextIndex;
        
        const nextTrack = room.tracks[nextIndex];
        if (nextTrack) {
          room.currentTrackDemo = { author: nextTrack.artist, title: nextTrack.title };
        }

        room.status = 'playing';
        room.currentSegment = 1;
        room.segmentResponses = { 1: {} };
        room.segmentReadyToAdvance = false;
        room.roundReadyToAdvance = false;
        
        console.log(`🔁 Nowy utwór w pokoju ${code}! Trwa powrót do gry.`);
        io.to(code).emit('gameStateUpdated', room);
      }
    }
  });

  // 3. ROZŁĄCZENIE (Wyjście z klubu / Zamknięcie karty)
  socket.on('disconnect', () => {
    console.log(`❌ Gniazdo rozłączone: ${socket.id}`);

    // Przeszukujemy wszystkie aktywne pokoje
    for (const [roomId, room] of games.entries()) {
      // Szukamy, czy w danym pokoju jest gracz o tym ID gniazda
      const playerIndex = room.players.findIndex(p => p.id === socket.id);

      if (playerIndex !== -1) {
        const disconnectedPlayer = room.players[playerIndex];
        
        // Usuwamy gracza z tablicy
        room.players.splice(playerIndex, 1);
        console.log(`👋 Gracz ${disconnectedPlayer.name} usunięty z pokoju ${roomId}`);

        // Jeśli to Host wyszedł, pokój w sumie powinien się zamknąć, ale na razie 
        // po prostu aktualizujemy listę dla pozostałych graczy
        io.to(roomId).emit('playersUpdated', room.players);
        
        // Skoro znaleźliśmy i usunęliśmy gracza, nie musimy szukać dalej
        break; 
      }
    }
  });
};