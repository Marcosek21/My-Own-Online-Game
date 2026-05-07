const config = require('../config');

const getDist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);

function getSafeSpawn(players) {
    let position = { x: Math.random() * (config.MAP_SIZE - 100) + 50, y: Math.random() * (config.MAP_SIZE - 100) + 50 };
    let safe = false;
    let attempts = 0;
    while (!safe && attempts < 50) {
        safe = true;
        for (let id in players) {
            if (getDist(position.x, position.y, players[id].x, players[id].y) < 300) { safe = false; break; }
        }
        if (safe) {
            safe = !config.WALLS.some(w => position.x + 40 > w.x && position.x < w.x + w.w && position.y + 40 > w.y && position.y < w.y + w.h);
        }
        if (!safe) position = { x: Math.random() * (config.MAP_SIZE - 100) + 50, y: Math.random() * (config.MAP_SIZE - 100) + 50 };
        attempts++;
    }
    return position;
}

function getUniqueColor(players) {
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

module.exports = { getDist, getSafeSpawn, getUniqueColor };