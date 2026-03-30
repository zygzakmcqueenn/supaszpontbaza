export interface Player {
  id: string;
  name: string;
  score: number;
  isHost: boolean;
  avatarUrl?: string;
}

export interface Track {
  id: string;
  title: string;
  artist: string;
  previewUrl: string;
  coverUrl: string;
  spotifyId?: string;
  youtubeId?: string;
  source?: 'spotify' | 'youtube';
  artistOptions?: string[];
  titleOptions?: string[];
}

export type GameStatus = 'waiting' | 'playing' | 'roundEnd' | 'finished';

export interface GameState {
  roomId: string;
  status: GameStatus;
  players: Player[];
  currentTrackIndex: number;
  tracks: Track[];
  roundStartTime?: number;
  playlistUrl?: string;
  playlistSource?: 'spotify' | 'youtube';
  currentSegment?: number;
  segmentReadyToAdvance?: boolean;
  roundReadyToAdvance?: boolean;
  segmentResponses?: Record<number, Record<string, { author: string; title: string; isSkip: boolean; pointsAwarded: number; isAuthorCorrect?: boolean; isTitleCorrect?: boolean; isBlankPlaceholder?: boolean }>>;
  currentTrackDemo?: { author: string; title: string };
}