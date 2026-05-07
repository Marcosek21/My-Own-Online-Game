module.exports = {
    MAP_SIZE: 2000,
    MAX_PLAYERS: 6,
    MAP_SIZE: 2000,
    WEAPONS: {
        pistol: { fireRate: 400, bulletSpeed: 15, damage: 20, spread: 0, count: 1, recoil: 0 },
        shotgun: { fireRate: 850, bulletSpeed: 12, damage: 15, spread: 0.3, count: 5, recoil: 8 },
        sniper: { fireRate: 1300, bulletSpeed: 28, damage: 65, spread: 0, count: 1, recoil: 15 }
    },
    WALLS: [
        { x: 400, y: 400, w: 300, h: 40 },
        { x: 1200, y: 800, w: 40, h: 300 },
        { x: 800, y: 1200, w: 400, h: 40 },
        { x: 200, y: 1500, w: 40, h: 200 },
        { x: 1500, y: 300, w: 200, h: 200 }
    ],
    POWERUP_TYPES: ['health', 'speed']
};