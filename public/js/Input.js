export const keys = {};

export function initInput(socket, getCameraOffsets) {
    window.addEventListener('keydown', e => {
        keys[e.key.toLowerCase()] = true;
        // Zmiana broni (logika z index.html)
        if (['1', '2', '3'].includes(e.key)) {
            const weapons = { '1': 'pistol', '2': 'shotgun', '3': 'sniper' };
            socket.emit('change_weapon', weapons[e.key]);
            updateWeaponUI(weapons[e.key]);
        }
    });

    window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

    window.onmousedown = (e) => {
        if (e.button !== 0) return;
        const offsets = getCameraOffsets();
        socket.emit('shoot', { x: e.clientX - offsets.camX, y: e.clientY - offsets.camY });
    };

    window.addEventListener('contextmenu', e => e.preventDefault());
}

function updateWeaponUI(weapon) {
    document.querySelectorAll('.weapon-slot').forEach(el => el.classList.remove('active'));
    document.getElementById(`slot-${weapon}`).classList.add('active');
}