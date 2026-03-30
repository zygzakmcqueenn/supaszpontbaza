"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDeezerPreviewUrl = getDeezerPreviewUrl;
const axios_1 = __importDefault(require("axios"));
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
/**
 * Szuka utworu w API Deezera, aby odzyskać .mp3 "preview" url (30 sekund).
 * Zwraca URL jako string. Jeśli nie znajdzie darmowej próbki, zwraca null.
 */
async function getDeezerPreviewUrl(author, title, retryCount = 0) {
    try {
        // Proste zapytanie tekstowe znane z bycia bardziej wybaczającym na Deezer API niż strict tags
        // Filtrujemy niepotrzebne słowa jak (feat. XYZ)
        const cleanTitle = title.split(' (')[0].split(' - ')[0];
        const q = `${author} ${cleanTitle}`;
        // Używamy timeout, aby upewnić się, że nie powiesimy zapytania
        const response = await axios_1.default.get(`https://api.deezer.com/search`, {
            params: { q, limit: 3 },
            timeout: 5000
        });
        if (response.data && response.data.error) {
            console.error(`Deezer API Error dla ${q}:`, response.data.error.message);
            if (response.data.error.code === 4 && retryCount < 2) {
                // Rate limit z Deezera (50 req / 5s). Czekamy sekunde i ponawiamy raz.
                await delay(1000);
                return getDeezerPreviewUrl(author, title, retryCount + 1);
            }
            return null;
        }
        if (response.data && response.data.data && response.data.data.length > 0) {
            // Szukamy pierwszej próbki z dostępnym preview
            for (const track of response.data.data) {
                if (track.preview && track.preview.length > 0) {
                    return track.preview;
                }
            }
        }
    }
    catch (error) {
        if (error.response?.status === 429 && retryCount < 2) {
            await delay(1000);
            return getDeezerPreviewUrl(author, title, retryCount + 1);
        }
        console.error(`Błąd zaciągania preview Deezera dla: ${author} - ${title}:`, error.message);
    }
    return null;
}
