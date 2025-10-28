// utils.js
const fs = require('fs');
const path = require('path');

//==============================
async function reportError(errorMsg, client, config) {
    if (config.errorChannel && client) {
        try {
            const channel = await client.channels.fetch(config.errorChannel);
            if (channel) {
                await channel.send(`❗ **ERROR:**\n${errorMsg}`);
                return;
            }
        } catch (e) {
            // Si falla, sigue a consola
        }
    }
    // Fallback: consola
    console.error('[ERROR]', errorMsg);
}

//============================
function saveConfig(config) {
    try {
        const configPath = path.join(__dirname, 'config.json');
        // Usando 2 espacios para formato
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2)); 
        console.log('[CONFIG] Configuración guardada con éxito.');
    } catch (error) {
        console.error('[ERROR] Falló al guardar la configuración:', error.message);
    }
}

const delay = ms => new Promise(res => setTimeout(res, ms));

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

module.exports = {
    delay,
    getRandomInt,
    pickRandom,
    reportError,
    saveConfig
};
