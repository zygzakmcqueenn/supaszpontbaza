import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

export async function getPlaylistTracks(playlistId: string): Promise<Array<{ author: string, title: string, coverUrl: string, previewUrl: string, spotifyId: string }>> {
  const tracks: Array<{ author: string, title: string, coverUrl: string, previewUrl: string, spotifyId: string }> = [];
  
  try {
    const url = `https://open.spotify.com/embed/playlist/${playlistId}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    const html = response.data;
    const scriptMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    
    if (!scriptMatch) {
      throw new Error('Nie znaleziono danych playlisty w kodzie strony (brak __NEXT_DATA__).');
    }

    const data = JSON.parse(scriptMatch[1]);
    const entity = data?.props?.pageProps?.state?.data?.entity;

    if (!entity || !entity.trackList) {
      throw new Error('Nieprawidłowa struktura danych Spotify (brak trackList).');
    }

    const playlistCoverUrl = entity.coverArt?.sources?.[0]?.url || '';

    for (const track of entity.trackList) {
      // Pomijamy utwory, które nie mają darmowego podglądu audio
      if (!track.audioPreview?.url) continue;

      const title = track.title.split(' (')[0].split(' - ')[0]; 
      const authorRaw = track.subtitle || 'Nieznany wykonawca';
      const author = authorRaw.split(',')[0].split('&')[0].trim();
      const spotifyId = track.uri?.split(':')?.[2] || '';
      
      tracks.push({ 
        author, 
        title, 
        coverUrl: playlistCoverUrl, 
        previewUrl: track.audioPreview.url,
        spotifyId
      });
    }

  } catch (error: any) {
    console.error('Błąd podczas pobierania playlisty ze Spotify (Scraping):', error.message);
    throw error;
  }

  return tracks;
}
