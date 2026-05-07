const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// STAN GRY - Zmienne globalne serwera
const players = {};
const bullets = [];
const MAP_SIZE = 2000;

// --- FUNKCJE POMOCNICZE ---

const getDist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

function getSafeSpawn() {
    let position = { x: Math.random() * (MAP_SIZE - 100) + 50, y: Math.random() * (MAP_SIZE - 100) + 50 };
    let safe = false;
    let attempts = 0;

    while (!safe && attempts < 50) {
        safe = true;
        for (let id in players) {
            if (getDist(position.x, position.y, players[id].x, players[id].y) < 300) {
                safe = false;
                position = { x: Math.random() * (MAP_SIZE - 100) + 50, y: Math.random() * (MAP_SIZE - 100) + 50 };
                break;
            }
        }
        attempts++;
    }
    return position;
}

function getUniqueColor() {
    let color;
    let isTooSimilar = true;
    let attempts = 0;

    while (isTooSimilar && attempts < 30) {
        const hue = Math.floor(Math.random() * 360);
        color = `hsl(${hue}, 70%, 50%)`;
        isTooSimilar = Object.values(players).some(p => {
            // Wyciągamy wartość hue z ciągu hsl(...)
            const match = p.color.match(/\d+/);
            if (!match) return false;
            const existingHue = parseInt(match[0]);
            return Math.abs(existingHue - hue) < 25; 
        });
        attempts++;
    }
    return color;
}

// --- INICJALIZACJA SOCKET.IO ---

const io = new Server(server, {
    cors: {
        origin: "https://gierka.marcoschneider.pl", 
        methods: ["GET", "POST"]
    }
});

app.use(express.static(path.join(__dirname, 'public')));

// --- PĘTLA FIZYKI (60 FPS) ---

setInterval(() => {
    // 1. Aktualizacja pocisków
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;

        if (b.x < 0 || b.x > MAP_SIZE || b.y < 0 || b.y > MAP_SIZE) {
            bullets.splice(i, 1);
            continue;
        }

        // 2. Sprawdzanie kolizji
        for (let id in players) {
            if (id === b.owner) continue;
            
            const p = players[id];
            if (b.x > p.x && b.x < p.x + 40 && b.y > p.y && b.y < p.y + 40) {
                p.hp -= 20;
                bullets.splice(i, 1);

                if (p.hp <= 0) {
                    console.log(`[KILL] ${players[b.owner]?.name || 'Nieznany'} zabił ${p.name}`);
                    if (players[b.owner]) players[b.owner].score += 1;
                    
                    // Bezpieczny Respawn
                    const newPos = getSafeSpawn();
                    p.hp = 100;
                    p.x = newPos.x;
                    p.y = newPos.y;
                }
                break; 
            }
        }
    }

    io.emit('state', { players, bullets });
}, 1000 / 60);

// --- OBSŁUGA POŁĄCZEŃ ---

io.on('connection', (socket) => {
    console.log(`[POŁĄCZENIE] ${socket.id}`);

    socket.on('join_game', (data) => {
        const spawn = getSafeSpawn();
        players[socket.id] = {
            x: spawn.x,
            y: spawn.y,
            color: getUniqueColor(),
            name: data.name ? data.name.substring(0, 12) : 'Bezimienny',
            hp: 100,
            score: 0
        };
    });

    socket.on('move', (movement) => {
        const p = players[socket.id];
        if (p) {
            p.x = Math.max(0, Math.min(MAP_SIZE - 40, p.x + movement.x));
            p.y = Math.max(0, Math.min(MAP_SIZE - 40, p.y + movement.y));
        }
    });

    socket.on('shoot', (target) => {
        const p = players[socket.id];
        if (p) {
            const centerX = p.x + 20;
            const centerY = p.y + 20;
            
            // Obliczamy kąt i prędkość lokalnie dla każdego strzału
            const angle = Math.atan2(target.y - centerY, target.x - centerX);
            const bulletSpeed = 14;

            bullets.push({
                x: centerX,
                y: centerY,
                vx: Math.cos(angle) * bulletSpeed,
                vy: Math.sin(angle) * bulletSpeed,
                owner: socket.id
            });
        }
    });

    socket.on('disconnect', () => {
        if (players[socket.id]) {
            console.log(`[GRA] ${players[socket.id].name} wyszedł.`);
            delete players[socket.id];
        }
    });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`SERWER URUCHOMIONY NA PORCIE ${PORT}`);
});