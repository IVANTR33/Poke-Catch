// index.js
const Discord = require("discord.js-selfbot-v13");
const { config, spamMessages, pokemonList } = require("./config");
const { getRandomInt, pickRandom } = require("./utils");
const { handleCommand, setupCommands } = require("./commands");
const { handlePokemonMessage } = require("./pokemonHandler");

const globalState = {
    paused: false,
    catchAll: config.catchAll,
    spamming: config.spamming
};
// --- SISTEMA DE SPAM AUTOMÁTICO ---
let spamInterval = null;
async function startSpam(client) {
    if (spamInterval) return;
    async function spamLoop() {
        while (config.spamming && config.spamChannel) {
            // Detener spam si el bot está pausado (por captcha)
            if (globalState.paused) {
                console.log("[SPAM] Pausado por captcha. No se enviarán mensajes de spam hasta reanudar.");
                break;
            }
            try {
                const channel = await client.channels.fetch(config.spamChannel);
                if (channel) {
                    const msg = pickRandom(spamMessages);
                    await channel.send(msg);
                }
            } catch (e) { /* ignorar errores */ }
            const delay = getRandomInt(config.settings.spamMinDelay, config.settings.spamMaxDelay);
            await new Promise(res => setTimeout(res, delay));
        }
        spamInterval = null;
    }
    spamInterval = spamLoop();
}
function stopSpam() {
    config.spamming = false;
    spamInterval = null;
}

const client = new Discord.Client({
    checkUpdate: false,
    intents: [
        Discord.Intents.FLAGS.GUILDS,
        Discord.Intents.FLAGS.GUILD_MESSAGES,
        Discord.Intents.FLAGS.DIRECT_MESSAGES,
        Discord.Intents.FLAGS.GUILD_MEMBERS,
        Discord.Intents.FLAGS.GUILD_PRESENCES
    ]
});

client.on("ready", () => {
    // Hacer el cliente global para otros módulos (logs, DMs, etc)
    globalThis.client = client;
    setupCommands(client);

    // Iniciar spam si está activado
    if (config.spamming && config.spamChannel) {
        startSpam(client);
    }

    const totalGuilds = client.guilds.cache.size;
    const totalChannels = client.channels.cache.size;
    const botUptime = new Date().toLocaleTimeString();

    console.log(`
╔════════════════════════════════════════════╗
║   🟢 ${client.user.tag} CONECTADO.           
╠════════════════════════════════════════════╣
║   📊 ESTADÍSTICAS:                                           
║   🗄️ Servidores: ${totalGuilds.toString().padEnd(15)}         
║   📺 Canales: ${totalChannels.toString().padEnd(16)}          
║   ⌚ Hora de inicio: ${botUptime.padEnd(14)}                 
╠════════════════════════════════════════════╣
║   ⚙️ CONFIGURACIÓN:
║   🎯 Catch-all: ${globalState.catchAll ? 'ON'.padEnd(19) : 'OFF'.padEnd(18)} 
║   📝 Lista de Nombres: ${pokemonList.length.toString().padEnd(10)} 
║   📬 Canal de spam: ${config.spamChannel ? 'Configurado'.padEnd(12) : 'No configurado'.padEnd(12)} 
║   🗒️ Canal de log: ${config.logChannel ? 'Configurado'.padEnd(14) : 'No configurado'.padEnd(14)} 
║   🛑 Canal de error: ${config.errorChannel ? 'Configurado'.padEnd(12) : 'No configurado'.padEnd(12)}
║   📩 Spam: ${globalState.spamming ? 'ACTIVO'.padEnd(19) : 'INACTIVO'.padEnd(18)} 
╠════════════════════════════════════════════╣
║   ℹ️ Auto-Catcher v2.0 -  Catch Pokemon
║   🔹 Tipo: Selfbot lista personalizada 
║   🔹 Delay configurado: ${config.settings.reactionTime}ms
╚════════════════════════════════════════════╝
    `);
});

client.on("messageCreate", async (message) => {
    if (Array.isArray(config.OwnerIDs) && config.OwnerIDs.includes(message.author.id) && message.content.startsWith('!')) {
        // Interceptar comandos de spam para iniciar/detener el bucle
        const args = message.content.slice(1).trim().split(/ +/);
        const command = args.shift().toLowerCase();
        if (command === 'spam') {
            const sub = args[0]?.toLowerCase();
            if (sub === 'on') {
                config.spamming = true;
                if (config.spamChannel && !globalState.paused) startSpam(client);
            } else if (sub === 'off') {
                stopSpam();
            }
        }
        handleCommand(message, '!');
        return;
    }
    handlePokemonMessage(message);

    // Si el bot se reanuda manualmente (por comando), reactivar spam si corresponde
    if (!globalState.paused && config.spamming && config.spamChannel && !spamInterval) {
        startSpam(client);
    }
});

client.login(config.TOKEN)
    .catch(error => {
        console.error("💀 ERROR FATAL AL INICIAR:", error);
        process.exit(1);
    });