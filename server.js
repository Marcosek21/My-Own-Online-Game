const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// Inicjalizacja 'io' - musi być przed jakimkolwiek użyciem io.on lub io.emit
const io = new Server(server, {
    cors: {
        origin: "https://gierka.marcoschneider.pl", 
        methods: ["GET", "POST"]
    }
});

app.use(express.static(path.join(__dirname, 'public')));

const players = {};
const bullets = [];

// --- PĘTLA FIZYKI SERWERA (60 FPS) ---
// Przelicza ruch pocisków i kolizje niezależnie od tego, co robią gracze
setInterval(() => {
    // 1. Logika pocisków
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;

        // Usuwanie pocisków poza ekranem (z marginesem)
        if (b.x < -100 || b.x > 3000 || b.y < -100 || b.y > 3000) {
            bullets.splice(i, 1);
            continue;
        }

        // 2. Sprawdzanie kolizji pocisków z graczami
        for (let id in players) {
            if (id === b.owner) continue; // Nie trafiaj samego siebie
            
            const p = players[id];
            // Prosta kolizja (pocisk jako punkt, gracz jako kwadrat 40x40)
            if (b.x > p.x && b.x < p.x + 40 && b.y > p.y && b.y < p.y + 40) {
                console.log(`[TRAFIENIE] Gracz ${p.name} oberwał!`);
                
                // Reset pozycji trafionego gracza
                p.x = 100 + Math.random() * 600;
                p.y = 100 + Math.random() * 400;
                
                bullets.splice(i, 1); // Usuń pocisk po trafieniu
                break;
            }
        }
    }

    // 3. Rozsyłanie stanu świata do wszystkich połączonych klientów
    io.emit('state', { players, bullets });
}, 1000 / 60);

// --- OBSŁUGA POŁĄCZEŃ ---
io.on('connection', (socket) => {
    console.log(`[POŁĄCZENIE] Nowy socket: ${socket.id}`);

    // Obsługa dołączenia do gry
    socket.on('join_game', (data) => {
        players[socket.id] = {
            x: 100 + Math.random() * 500,
            y: 100 + Math.random() * 500,
            color: `hsl(${Math.random() * 360}, 70%, 50%)`,
            name: data.name || 'Bezimienny'
        };
        console.log(`[GRA] Gracz ${players[socket.id].name} wszedł do gry.`);
    });

    // Obsługa ruchu
    socket.on('move', (movement) => {
        if (players[socket.id]) {
            players[socket.id].x += movement.x;
            players[socket.id].y += movement.y;
        }
    });

    // Obsługa strzału
    socket.on('shoot', (target) => {
        if (players[socket.id]) {
            const p = players[socket.id];
            // Obliczanie wektora prędkości pocisku w stronę kliknięcia
            const angle = Math.atan2(target.y - (p.y + 20), target.x - (p.x + 20));
            
            bullets.push({
                x: p.x + 20, // Środek kwadratu
                y: p.y + 20,
                vx: Math.cos(angle) * 12, // Prędkość pocisku
                vy: Math.sin(angle) * 12,
                owner: socket.id
            });
        }
    });

    // Rozłączenie
    socket.on('disconnect', () => {
        if (players[socket.id]) {
            console.log(`[GRA] ${players[socket.id].name} opuścił grę.`);
            delete players[socket.id];
        }
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Serwer gry działa na http://localhost:${PORT}`);
});