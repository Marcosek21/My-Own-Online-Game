const config = require('../config');

function checkWallCollision(x, y, w_obj, h_obj) {
    return config.WALLS.some(w => x + w_obj > w.x && x < w.x + w.w && y + h_obj > w.y && y < w.y + w.h);
}

module.exports = { checkWallCollision };