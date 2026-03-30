"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getYouTubePlaylistTracks = getYouTubePlaylistTracks;
const youtubei_js_1 = require("youtubei.js");
let ytInstance = null;
async function getYT() {
    if (!ytInstance) {
        ytInstance = await youtubei_js_1.Innertube.create({
            cache: new youtubei_js_1.UniversalCache(false)
        });
    }
    return ytInstance;
}
async function getYouTubePlaylistTracks(playlistId) {
    const tracks = [];
    try {
        const yt = await getYT();
        const playlist = await yt.getPlaylist(playlistId);
        if (!playlist || !playlist.items) {
            throw new Error('Nieprawidłowa playlista YouTube lub brak dostępu.');
        }
        const playlistData = playlist;
        const playlistCoverUrl = playlistData.info?.thumbnails?.[0]?.url
            || playlistData.thumbnails?.[0]?.url
            || '';
        for (const item of playlist.items) {
            if (item.type !== 'PlaylistVideo')
                continue;
            const video = item;
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
    }
    catch (error) {
        console.error('Błąd podczas pobierania playlisty z YouTube (youtubei.js):', error.message);
        throw error;
    }
    return tracks;
}
