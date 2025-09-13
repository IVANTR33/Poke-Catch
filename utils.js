/**
 * Envía un error al canal configurado en config.errorChannel, o a consola si falla.
 * @param {string} errorMsg - El mensaje de error a enviar
 * @param {object} client - El cliente de Discord
 * @param {object} config - El objeto de configuración
 */
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
// utils.js
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
    reportError
};
