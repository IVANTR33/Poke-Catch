// utils.js
const fs = require('fs');
const path = require('path');
const { configPath } = require('./config'); // Asegurarse de que configPath esté accesible o se defina aquí.


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


function saveConfig(config) {
    try {
        
        const configPathLocal = path.join(__dirname, 'config.json'); 
        
        
        fs.writeFileSync(configPathLocal, JSON.stringify(config, null, 2)); 
        console.log('[CONFIG] Configuration saved successfully.');
    } catch (error) {
        console.error('[ERROR] Failed to save settings:', error.message);
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
    reportError,
    saveConfig,
    delay,
    getRandomInt,
    pickRandom
};
