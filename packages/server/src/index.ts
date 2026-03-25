import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { registerGameHandlers } from './sockets/gameHandler';

const app = express();

const allowedOrigins = [
  'http://localhost', 
  'capacitor://localhost', 
  'http://localhost:3000'
];

const corsOptions = {
  origin: function(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    if (!origin || allowedOrigins.includes(origin) || origin.startsWith('http://192.168.')) {
      callback(null, true);
    } else {
      callback(null, true); // Fallback: tryb Beta dopuszcza dowolne klonowanie
    }
  },
  methods: ["GET", "POST"],
  credentials: true
};

app.use(cors(corsOptions));

const server = http.createServer(app);
const io = new Server(server, {
  cors: corsOptions
});

io.on('connection', (socket) => {
  console.log(`🔌 Nowy gracz połączony: ${socket.id}`);
  registerGameHandlers(io, socket);
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`🚀 Serwer Party-Hitz działa na porcie ${PORT}`);
});