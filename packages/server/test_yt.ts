import { getYouTubePlaylistTracks } from './src/services/youtube';

async function test() {
  try {
    const listId = 'PLw-VjHDlEOgs658kAHR_LAaILBXb-sghj';
    console.log(`Pobieranie playlisty: ${listId}`);
    const tracks = await getYouTubePlaylistTracks(listId);
    console.log(`Pobrano ${tracks.length} utworów.`);
    if (tracks.length > 0) {
      console.log('Pierwszy utwór:', tracks[0]);
    }
  } catch (err) {
    console.error('Błąd:', err);
  }
}

test();
