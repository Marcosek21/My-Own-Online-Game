const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

// KONFIGURACJA BRONI
const WEAPONS = {
    pistol: { fireRate: 400, bulletSpeed: 15, damage: 20, spread: 0, count: 1, recoil: 0 },
    shotgun: { fireRate: 850, bulletSpeed: 12, damage: 15, spread: 0.3, count: 5, recoil: 8 },
    sniper: { fireRate: 1300, bulletSpeed: 28, damage: 65, spread: 0, count: 1, recoil: 15 }
};

// STAN GRY
const players = {};
const bullets = [];
const powerups = [];
const MAP_SIZE = 2000;
const POWERUP_TYPES = ['health', 'speed'];

const walls = [
    { x: 400, y: 400, w: 300, h: 40 },
    { x: 1200, y: 800, w: 40, h: 300 },
    { x: 800, y: 1200, w: 400, h: 40 },
    { x: 200, y: 1500, w: 40, h: 200 },
    { x: 1500, y: 300, w: 200, h: 200 }
];

// --- FUNKCJE POMOCNICZE ---

const getDist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

function getSafeSpawn() {
    let position = { x: Math.random() * (MAP_SIZE - 100) + 50, y: Math.random() * (MAP_SIZE - 100) + 50 };
    let safe = false;
    let attempts = 0;
    while (!safe && attempts < 50) {
        safe = true;
        for (let id in players) {
            if (getDist(position.x, position.y, players[id].x, players[id].y) < 300) { safe = false; break; }
        }
        if (safe) {
            safe = !walls.some(w => position.x + 40 > w.x && position.x < w.x + w.w && position.y + 40 > w.y && position.y < w.y + w.h);
        }
        if (!safe) position = { x: Math.random() * (MAP_SIZE - 100) + 50, y: Math.random() * (MAP_SIZE - 100) + 50 };
        attempts++;
    }
    return position;
}

function getUniqueColor() {
    let color, attempts = 0;
    while (attempts < 30) {
        const hue = Math.floor(Math.random() * 360);
        color = `hsl(${hue}, 70%, 50%)`;
        const tooSimilar = Object.values(players).some(p => {
            const match = p.color.match(/\d+/);
            return match ? Math.abs(parseInt(match[0]) - hue) < 25 : false;
        });
        if (!tooSimilar) break;
        attempts++;
    }
    return color;
}

// --- INICJALIZACJA SOCKET.IO ---

const io = new Server(server, {
    cors: { origin: "https://gierka.marcoschneider.pl", methods: ["GET", "POST"] }
});

app.use(express.static(path.join(__dirname, 'public')));

setInterval(() => {
    if (powerups.length < 15) {
        powerups.push({
            id: Math.random(),
            x: Math.random() * (MAP_SIZE - 60) + 30,
            y: Math.random() * (MAP_SIZE - 60) + 30,
            type: POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)]
        });
    }
}, 5000);

// --- PĘTLA FIZYKI (60 FPS) ---

setInterval(() => {
    // 1. Pociski
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.x += b.vx;
        b.y += b.vy;

        const hitWall = walls.some(w => b.x > w.x && b.x < w.x + w.w && b.y > w.y && b.y < w.y + w.h);
        if (hitWall || b.x < 0 || b.x > MAP_SIZE || b.y < 0 || b.y > MAP_SIZE) {
            bullets.splice(i, 1); continue;
        }

        for (let id in players) {
            if (id === b.owner) continue;
            const p = players[id];
            if (b.x > p.x && b.x < p.x + 40 && b.y > p.y && b.y < p.y + 40) {
                p.hp -= b.damage; // Zadaje obrażenia zdefiniowane przez broń
                p.lastHit = Date.now();
                bullets.splice(i, 1);

                if (p.hp <= 0) {
                    if (players[b.owner]) players[b.owner].score += 1;
                    const spawn = getSafeSpawn();
                    p.hp = 100; p.x = spawn.x; p.y = spawn.y; p.speedBoost = false;
                }
                break; 
            }
        }
    }

    // 2. Power-upy
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

    io.emit('state', { players, bullets, powerups, walls });
}, 1000 / 60);

// --- OBSŁUGA POŁĄCZEŃ ---

io.on('connection', (socket) => {
    socket.on('join_game', (data) => {
        const spawn = getSafeSpawn();
        players[socket.id] = {
            x: spawn.x, y: spawn.y,
            color: getUniqueColor(),
            name: data.name ? data.name.substring(0, 12) : 'Bezimienny',
            hp: 100, score: 0, speedBoost: false,
            lastHit: 0,
            weapon: 'pistol',
            lastFired: 0
        };
    });

    socket.on('change_weapon', (weaponType) => {
        if (WEAPONS[weaponType] && players[socket.id]) {
            players[socket.id].weapon = weaponType;
        }
    });

    socket.on('move', (movement) => {
        const p = players[socket.id];
        if (p) {
            const speedBase = p.speedBoost ? 8 : 5;
            const dx = movement.x * speedBase;
            const dy = movement.y * speedBase;

            const nextX = Math.max(0, Math.min(MAP_SIZE - 40, p.x + dx));
            const collidesX = walls.some(w => nextX + 40 > w.x && nextX < w.x + w.w && p.y + 40 > w.y && p.y < w.y + w.h);
            if (!collidesX) p.x = nextX;

            const nextY = Math.max(0, Math.min(MAP_SIZE - 40, p.y + dy));
            const collidesY = walls.some(w => p.x + 40 > w.x && p.x < w.x + w.w && nextY + 40 > w.y && nextY < w.y + w.h);
            if (!collidesY) p.y = nextY;
        }
    });

    socket.on('shoot', (target) => {
        const p = players[socket.id];
        if (!p) return;

        const weapon = WEAPONS[p.weapon];
        const now = Date.now();

        if (now - p.lastFired >= weapon.fireRate) {
            p.lastFired = now;
            const centerX = p.x + 20;
            const centerY = p.y + 20;
            const baseAngle = Math.atan2(target.y - centerY, target.x - centerX);

            // Mechanika odrzutu (Recoil)
            if (weapon.recoil > 0) {
                const recoilX = -Math.cos(baseAngle) * weapon.recoil;
                const recoilY = -Math.sin(baseAngle) * weapon.recoil;
                
                // Sprawdzenie kolizji dla odrzutu (żeby nie wpaść w ścianę)
                const nextRX = Math.max(0, Math.min(MAP_SIZE - 40, p.x + recoilX));
                const nextRY = Math.max(0, Math.min(MAP_SIZE - 40, p.y + recoilY));
                
                if (!walls.some(w => nextRX + 40 > w.x && nextRX < w.x + w.w && p.y + 40 > w.y && p.y < w.y + w.h)) p.x = nextRX;
                if (!walls.some(w => p.x + 40 > w.x && p.x < w.x + w.w && nextRY + 40 > w.y && nextRY < w.y + w.h)) p.y = nextRY;
            }

            // Tworzenie pocisków
            for (let i = 0; i < weapon.count; i++) {
                const angle = baseAngle + (Math.random() - 0.5) * weapon.spread;
                bullets.push({
                    x: centerX, y: centerY,
                    vx: Math.cos(angle) * weapon.bulletSpeed,
                    vy: Math.sin(angle) * weapon.bulletSpeed,
                    damage: weapon.damage,
                    owner: socket.id
                });
            }
        }
    });

    socket.on('disconnect', () => { delete players[socket.id]; });
});

const PORT = 3000;
server.listen(PORT, '0.0.0.0', () => { console.log(`SERWER ONLINE: ${PORT}`); });