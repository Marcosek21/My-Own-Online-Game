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

// Obiekt przechowujący stan wszystkich graczy
const players = {};

io.on('connection', (socket) => {
    console.log(`[POLĄCZENIE] Nowy socket: ${socket.id}`);

    socket.on('join_game', (data) => {
        // Inicjalizacja gracza z losowym kolorem i pozycją startową
        players[socket.id] = {
            x: 100 + Math.random() * 400,
            y: 100 + Math.random() * 400,
            color: `hsl(${Math.random() * 360}, 70%, 50%)`,
            name: data.name || 'Bezimienny'
        };
        console.log(`[GRA] ${players[socket.id].name} wszedł do gry.`);
        
        // Rozsyłamy aktualny stan świata do WSZYSTKICH
        io.emit('state', players);
    });

    // Obsługa ruchu wysyłanego przez klienta
    socket.on('move', (movement) => {
        if (players[socket.id]) {
            players[socket.id].x += movement.x;
            players[socket.id].y += movement.y;
            // Bardzo ważne: wysyłamy aktualizację do wszystkich
            io.emit('state', players);
        }
    });

    socket.on('disconnect', () => {
        if (players[socket.id]) {
            console.log(`[GRA] ${players[socket.id].name} opuścił grę.`);
            delete players[socket.id];
            io.emit('state', players); // Informujemy innych o zniknięciu gracza
        }
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Serwer gry działa na porcie ${PORT}`);
});