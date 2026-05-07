const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "https://gierka.marcoschneider.pl", 
        methods: ["GET", "POST"]
    }
});

app.use(express.static(path.join(__dirname, 'public')));

// Zarządzanie połączeniami graczy
io.on('connection', (socket) => {
    // 1. Sprawdzanie botów/nagłówków
    if (!socket.handshake.headers.host) {
        return socket.disconnect();
    }

    console.log(`[GRA] Połączono socket: ${socket.id}`);

    // 2. Obsługa zdarzenia join_game - TERAZ JEST WEWNĄTRZ KLAMER
    socket.on('join_game', (data) => {
        console.log(`[GRA] Gracz ${data.name} faktycznie wszedł do gry!`);
        
        // Możemy odesłać potwierdzenie do gracza
        socket.emit('welcome', { message: `Witaj w grze, ${data.name}!` });
    });

    // 3. Obsługa rozłączenia
    socket.on('disconnect', () => {
        console.log(`[GRA] Gracz rozłączony: ${socket.id}`);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Serwer nasłuchuje na porcie ${PORT}`);
});