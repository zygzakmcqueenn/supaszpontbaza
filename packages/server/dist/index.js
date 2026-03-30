"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const gameHandler_1 = require("./sockets/gameHandler");
const app = (0, express_1.default)();
const allowedOrigins = [
    'http://localhost',
    'capacitor://localhost',
    'http://localhost:3000'
];
const corsOptions = {
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://192.168.')) {
            callback(null, true);
        }
        else {
            callback(null, true); // Fallback: tryb Beta dopuszcza dowolne klonowanie
        }
    },
    methods: ["GET", "POST"],
    credentials: true
};
app.use((0, cors_1.default)(corsOptions));
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: corsOptions
});
io.on('connection', (socket) => {
    console.log(`🔌 Nowy gracz połączony: ${socket.id}`);
    (0, gameHandler_1.registerGameHandlers)(io, socket);
});
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`🚀 Serwer Party-Hitz działa na porcie ${PORT}`);
});
