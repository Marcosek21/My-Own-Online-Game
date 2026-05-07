import { initInput, keys } from './Input.js';
import { updateAndDrawParticles, createExplosion } from './Particles.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const miniCanvas = document.getElementById('minimap');
const miniCtx = miniCanvas.getContext('2d');

const socket = io();
let isGameStarted = false;
let players = {};
let bullets = [];
let powerups = [];
let walls = [];
let lastMyHp = 100;
let shakeAmount = 0;
const MAP_SIZE = 2000;

// Funkcja pomocnicza przekazywana do Input.js
const getCameraOffsets = () => {
    const myPlayer = players[socket.id];
    if (!myPlayer) return { camX: 0, camY: 0 };
    return {
        camX: canvas.width / 2 - myPlayer.x - 20,
        camY: canvas.height / 2 - myPlayer.y - 20
    };
};

// Inicjalizacja
initInput(socket, getCameraOffsets);

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// Logika Logowania
document.getElementById('startButton').onclick = () => {
    const name = document.getElementById('nickInput').value.trim();
    if (name.length >= 2) {
        document.getElementById('loginScreen').style.display = 'none';
        isGameStarted = true;
        socket.emit('join_game', { name });
        requestAnimationFrame(draw);
    }
};

socket.on('state', (state) => {
    const myPlayer = state.players[socket.id];
    if (myPlayer) {
        if (myPlayer.hp < lastMyHp) {
            shakeAmount = 12;
            createExplosion(myPlayer.x + 20, myPlayer.y + 20, myPlayer.color);
        }
        lastMyHp = myPlayer.hp;
    }
    players = state.players;
    bullets = state.bullets;
    powerups = state.powerups;
    walls = state.walls;
    updateLeaderboard();
});

socket.on('error_message', (msg) => {
    alert(msg); // Wyświetlamy komunikat użytkownikowi
    location.reload(); // Odświeżamy stronę, aby przywrócić ekran logowania
});

function updateLeaderboard() {
    const sorted = Object.values(players).sort((a, b) => b.score - a.score).slice(0, 5);
    document.getElementById('scoresList').innerHTML = sorted.map(p => `
        <div class="score-row"><span>${p.name}</span><b>${p.score}</b></div>
    `).join('');
}

function drawMinimap() {
    miniCtx.clearRect(0, 0, miniCanvas.width, miniCanvas.height);
    const scale = miniCanvas.width / MAP_SIZE;
    miniCtx.fillStyle = "#444";
    walls.forEach(w => miniCtx.fillRect(w.x * scale, w.y * scale, w.w * scale, w.h * scale));
    for (let id in players) {
        const p = players[id];
        miniCtx.fillStyle = id === socket.id ? "#ffff00" : "#ff0000";
        miniCtx.beginPath();
        miniCtx.arc(p.x * scale, p.y * scale, 3, 0, Math.PI * 2);
        miniCtx.fill();
    }
}

function draw() {
    if (!isGameStarted) return;
    const myPlayer = players[socket.id];
    if (!myPlayer) { requestAnimationFrame(draw); return; }

    let { camX, camY } = getCameraOffsets();

    if (shakeAmount > 0) {
        camX += (Math.random() - 0.5) * shakeAmount;
        camY += (Math.random() - 0.5) * shakeAmount;
        shakeAmount *= 0.9;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(camX, camY);

    // Tło
    ctx.fillStyle = "#151515";
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);

    // Ściany
    ctx.fillStyle = "#333";
    walls.forEach(w => ctx.fillRect(w.x, w.y, w.w, w.h));

    // Power-upy
    powerups.forEach(pu => {
        ctx.beginPath();
        ctx.fillStyle = pu.type === 'health' ? "#2ecc71" : "#00d4ff";
        ctx.arc(pu.x, pu.y, 10, 0, Math.PI * 2);
        ctx.fill();
    });

    // Cząsteczki
    updateAndDrawParticles(ctx);

    // Lasery (Pociski)
    bullets.forEach(b => {
        ctx.strokeStyle = "yellow";
        ctx.lineWidth = 3;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(b.x - b.vx * 1.5, b.y - b.vy * 1.5);
        ctx.stroke();
    });

    // Gracze
    for (let id in players) {
        const p = players[id];
        const isFlashing = p.lastHit && (Date.now() - p.lastHit < 100);
        ctx.fillStyle = isFlashing ? "white" : p.color;
        ctx.fillRect(p.x, p.y, 40, 40);
        
        // Paski HP
        ctx.fillStyle = "#222";
        ctx.fillRect(p.x, p.y - 12, 40, 6);
        ctx.fillStyle = p.hp > 30 ? "#2ecc71" : "#e74c3c";
        ctx.fillRect(p.x, p.y - 12, (p.hp / 100) * 40, 6);

        ctx.fillStyle = "white";
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(p.name, p.x + 20, p.y - 20);
    }

    ctx.restore();
    drawMinimap();

    // Ruch
    let dx = 0, dy = 0;
    if (keys['w']) dy -= 1;
    if (keys['s']) dy += 1;
    if (keys['a']) dx -= 1;
    if (keys['d']) dx += 1;
    if (dx !== 0 || dy !== 0) {
        const dist = Math.hypot(dx, dy);
        socket.emit('move', { x: dx / dist, y: dy / dist });
    }

    requestAnimationFrame(draw);
}