import { getPlaylistTracks } from './src/services/spotify';
import { getYouTubePlaylistTracks } from './src/services/youtube';

async function run() {
  console.log('Testing YT...');
  const urlParams = new URL('https://music.youtube.com/playlist?list=OLAK5uy_lkoyKa7LkjSlOgTkQ_DPbBfWAixU-aCfQ');
  const listId = urlParams.searchParams.get('list');
  try {
     const ytTracks = await getYouTubePlaylistTracks(listId as string);
     console.log('YT success:', ytTracks.length, 'tracks');
  } catch(e) { console.error('YT error:', e); }

  console.log('Testing Spotify...');
  const spotifyMatch = 'https://open.spotify.com/playlist/5WNhNDVbsQIyyOMTDDU46t?si=RKnzFdcKSsOFaiNptjmJcg&pi=g_RIduwoSmKM5'.match(/playlist\/([a-zA-Z0-9]+)/);
  try {
     const spTracks = await getPlaylistTracks(spotifyMatch![1]);
     console.log('Spotify success:', spTracks.length, 'tracks');
  } catch(e) { console.error('Spotify error:', e); }
}

run();
