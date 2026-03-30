import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { registerGameHandlers } from './sockets/gameHandler';
import path from 'path';
import fs from 'fs';

const app = express();

// Serve the static update.zip payload locally
app.use(express.static(path.join(__dirname, '../public')));

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

// OTA Update Endpoint
app.get('/api/update/check', (req, res) => {
  let current_version = "1.0.0";
  try {
    const zipPath = path.join(__dirname, '../public/update.zip');
    const stats = fs.statSync(zipPath);
    current_version = `ota-${stats.mtimeMs}`;
  } catch (err) {
    // Fallback if missing
  }

  const required_backend_version = "1.0.0";
  const host = req.get('host');
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  
  res.json({
    version: current_version,
    url: `${protocol}://${host}/update.zip`,
    required_backend_version
  });
});

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