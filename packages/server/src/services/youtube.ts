import { Innertube, UniversalCache } from 'youtubei.js';

let ytInstance: Innertube | null = null;

async function getYT() {
  if (!ytInstance) {
    ytInstance = await Innertube.create({
      cache: new UniversalCache(false)
    });
  }
  return ytInstance;
}

export async function getYouTubePlaylistTracks(playlistId: string): Promise<Array<{ author: string, title: string, coverUrl: string, previewUrl: string, youtubeId: string }>> {
  const tracks: Array<{ author: string, title: string, coverUrl: string, previewUrl: string, youtubeId: string }> = [];
  
  try {
    const yt = await getYT();
    const playlist = await yt.getPlaylist(playlistId);

    if (!playlist || !playlist.items) {
      throw new Error('Nieprawidłowa playlista YouTube lub brak dostępu.');
    }

    const playlistData = playlist as any;
    const playlistCoverUrl = playlistData.info?.thumbnails?.[0]?.url 
      || playlistData.thumbnails?.[0]?.url 
      || '';

    for (const item of playlist.items) {
      if (item.type !== 'PlaylistVideo') continue;
      
      const video = item as any;
      const titleRaw = video.title?.text || 'Nieznany tytuł';
      const title = titleRaw.split(' (')[0].split(' - ')[0].replace(/\[.*?\]/g, '').trim(); 
      const authorRaw = video.author?.name || 'Nieznany wykonawca';
      const author = authorRaw.replace(' - Topic', '').trim();
      const youtubeId = video.id;
      
      tracks.push({ 
        author, 
        title, 
        coverUrl: playlistCoverUrl, 
        previewUrl: '', // Brak bezpośredniego linku MP3 dla darmowych YT, opieramy się na Iframe
        youtubeId
      });
    }

  } catch (error: any) {
    console.error('Błąd podczas pobierania playlisty z YouTube (youtubei.js):', error.message);
    throw error;
  }

  return tracks;
}
