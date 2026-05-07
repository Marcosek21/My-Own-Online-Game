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

// STAN GRY
const players = {};
const bullets = [];
const MAP_SIZE = 2000; // Rozmiar wirtualnej mapy

// --- PĘTLA FIZYKI (60 FPS) ---
setInterval(() => {
    // 1. Aktualizacja pocisków
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;

        // Usuwanie pocisków poza granicami mapy
        if (b.x < 0 || b.x > MAP_SIZE || b.y < 0 || b.y > MAP_SIZE) {
            bullets.splice(i, 1);
            continue;
        }

        // 2. Sprawdzanie kolizji pocisków z graczami
        for (let id in players) {
            if (id === b.owner) continue; // Nie trafiaj samego siebie
            
            const p = players[id];
            // Kolizja: pocisk (punkt) wewnątrz kwadratu gracza (40x40)
            if (b.x > p.x && b.x < p.x + 40 && b.y > p.y && b.y < p.y + 40) {
                p.hp -= 20; // Zadaj obrażenia
                bullets.splice(i, 1); // Usuń pocisk

                // Sprawdzenie czy gracz zginął
                if (p.hp <= 0) {
                    console.log(`[KILL] ${players[b.owner]?.name} zabił ${p.name}`);
                    
                    // Przyznaj punkt strzelcowi (jeśli nadal jest w grze)
                    if (players[b.owner]) {
                        players[b.owner].score += 1;
                    }
                    
                    // Reset gracza (respawn)
                    p.hp = 100;
                    p.x = Math.random() * (MAP_SIZE - 100) + 50;
                    p.y = Math.random() * (MAP_SIZE - 100) + 50;
                }
                break; 
            }
        }
    }

    // 3. Rozsyłanie stanu do wszystkich klientów
    io.emit('state', { players, bullets });
}, 1000 / 60);

// --- OBSŁUGA POŁĄCZEŃ SOCKET.IO ---
io.on('connection', (socket) => {
    console.log(`[POŁĄCZENIE] Nowy socket: ${socket.id}`);

    // Dołączenie gracza do gry
    socket.on('join_game', (data) => {
        players[socket.id] = {
            x: Math.random() * 500 + 100,
            y: Math.random() * 500 + 100,
            color: `hsl(${Math.random() * 360}, 70%, 50%)`,
            name: data.name ? data.name.substring(0, 12) : 'Bezimienny',
            hp: 100,
            score: 0
        };
        console.log(`[GRA] ${players[socket.id].name} dołączył do aren.`);
    });

    // Ruch gracza z blokadą granic (Clamping)
    socket.on('move', (movement) => {
        const p = players[socket.id];
        if (p) {
            // Przesuwamy i od razu sprawdzamy czy nie wychodzi poza mapę
            p.x = Math.max(0, Math.min(MAP_SIZE - 40, p.x + movement.x));
            p.y = Math.max(0, Math.min(MAP_SIZE - 40, p.y + movement.y));
        }
    });

    // Strzelanie
    socket.on('shoot', (target) => {
        const p = players[socket.id];
        if (p) {
            // Oblicz kąt w stronę kliknięcia (celujemy ze środka kwadratu)
            const centerX = p.x + 20;
            const centerY = p.y + 20;
            const angle = Math.atan2(target.y - centerY, target.x - centerX);
            
            bullets.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * 12,
                vy: Math.sin(angle) * 12,
                owner: socket.id
            });
        }
    });

    // Rozłączenie
    socket.on('disconnect', () => {
        if (players[socket.id]) {
            console.log(`[GRA] ${players[socket.id].name} wyszedł z gry.`);
            delete players[socket.id];
        }
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`SERWER URUCHOMIONY: http://localhost:${PORT}`);
});