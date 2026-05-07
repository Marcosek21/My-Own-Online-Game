const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Importy naszych modułów
const config = require('./config');
const { getDist, getSafeSpawn, getUniqueColor } = require('./lib/utils');
const { checkWallCollision } = require('./lib/physics');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

app.use(express.static(path.join(__dirname, 'public')));

const players = {};
const bullets = [];
const powerups = [];

// PĘTLA FIZYKI
setInterval(() => {
    // Logika pocisków
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx; b.y += b.vy;

        const hitWall = checkWallCollision(b.x, b.y, 1, 1);
        if (hitWall || b.x < 0 || b.x > config.MAP_SIZE || b.y < 0 || b.y > config.MAP_SIZE) {
            bullets.splice(i, 1); continue;
        }

        for (let id in players) {
            if (id === b.owner) continue;
            const p = players[id];
            if (b.x > p.x && b.x < p.x + 40 && b.y > p.y && b.y < p.y + 40) {
                p.hp -= b.damage;
                p.lastHit = Date.now();
                bullets.splice(i, 1);
                if (p.hp <= 0) {
                    if (players[b.owner]) players[b.owner].score += 1;
                    const spawn = getSafeSpawn(players);
                    p.hp = 100; p.x = spawn.x; p.y = spawn.y; p.speedBoost = false;
                }
                break;
            }
        }
    }

    // Logika Power-upów
    for (let id in players) {
        const p = players[id];
        for (let i = powerups.length - 1; i >= 0; i--) {
            const pu = powerups[i];
            if (getDist(p.x + 20, p.y + 20, pu.x, pu.y) < 40) {
                if (pu.type === 'health') p.hp = Math.min(100, p.hp + 40);
                if (pu.type === 'speed') {
                    p.speedBoost = true;
                    setTimeout(() => { if (players[id]) players[id].speedBoost = false; }, 7000);
                }
                powerups.splice(i, 1);
            }
        }
    }

    io.emit('state', { players, bullets, powerups, walls: config.WALLS });
}, 1000 / 60);

// SPAWNER POWERUPÓW
setInterval(() => {
    if (powerups.length < 15) {
        powerups.push({
            id: Math.random(),
            x: Math.random() * (config.MAP_SIZE - 60) + 30,
            y: Math.random() * (config.MAP_SIZE - 60) + 30,
            type: config.POWERUP_TYPES[Math.floor(Math.random() * config.POWERUP_TYPES.length)]
        });
    }
}, 5000);

// OBSŁUGA SOCKETÓW
io.on('connection', (socket) => {
    socket.on('join_game', (data) => {
        // Sprawdzamy aktualną liczbę graczy w obiekcie players
        const currentPlayersCount = Object.keys(players).length;

        if (currentPlayersCount >= config.MAX_PLAYERS) {
            // Serwer jest pełny - wysyłamy informację zwrotną do klienta
            socket.emit('error_message', 'Serwer jest pełny! (Max 6 graczy). Spróbuj później.');
            return; // Przerywamy funkcję, gracz nie zostaje dodany
        }

        // Jeśli jest miejsce, kontynuujemy standardowe dodawanie gracza
        const spawn = getSafeSpawn(players);
        players[socket.id] = {
            x: spawn.x, y: spawn.y,
            color: getUniqueColor(players),
            name: data.name ? data.name.substring(0, 12) : 'Bezimienny',
            hp: 100, score: 0, speedBoost: false, lastHit: 0, weapon: 'pistol', lastFired: 0
        };
        
        console.log(`[GRA] ${players[socket.id].name} dołączył. Graczy: ${currentPlayersCount + 1}/${config.MAX_PLAYERS}`);
    });

    socket.on('move', (movement) => {
        const p = players[socket.id];
        if (!p) return;
        const speed = p.speedBoost ? 8 : 5;
        const dx = movement.x * speed;
        const dy = movement.y * speed;

        if (!checkWallCollision(Math.max(0, Math.min(config.MAP_SIZE - 40, p.x + dx)), p.y, 40, 40)) {
            p.x = Math.max(0, Math.min(config.MAP_SIZE - 40, p.x + dx));
        }
        if (!checkWallCollision(p.x, Math.max(0, Math.min(config.MAP_SIZE - 40, p.y + dy)), 40, 40)) {
            p.y = Math.max(0, Math.min(config.MAP_SIZE - 40, p.y + dy));
        }
    });

    socket.on('shoot', (target) => {
        const p = players[socket.id];
        if (!p) return;
        const weapon = config.WEAPONS[p.weapon];
        const now = Date.now();
        if (now - p.lastFired >= weapon.fireRate) {
            p.lastFired = now;
            const angle = Math.atan2(target.y - (p.y + 20), target.x - (p.x + 20));
            
            // Recoil
            if (weapon.recoil > 0) {
                const rx = p.x - Math.cos(angle) * weapon.recoil;
                const ry = p.y - Math.sin(angle) * weapon.recoil;
                if (!checkWallCollision(rx, ry, 40, 40)) { p.x = rx; p.y = ry; }
            }

            for (let i = 0; i < weapon.count; i++) {
                const a = angle + (Math.random() - 0.5) * weapon.spread;
                bullets.push({
                    x: p.x + 20, y: p.y + 20,
                    vx: Math.cos(a) * weapon.bulletSpeed, vy: Math.sin(a) * weapon.bulletSpeed,
                    damage: weapon.damage, owner: socket.id
                });
            }
        }
    });

    socket.on('change_weapon', (w) => { if(players[socket.id]) players[socket.id].weapon = w; });
    socket.on('disconnect', () => { delete players[socket.id]; });
});

server.listen(3000, '0.0.0.0', () => console.log('Serwer działa na porcie 3000'));