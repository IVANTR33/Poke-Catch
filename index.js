// index.js
const Discord = require("discord.js-selfbot-v13");
const { config, spamMessages, pokemonList } = require("./config");
const { getRandomInt, pickRandom } = require("./utils");
const { handleCommand, setupCommands } = require("./commands");
const { handlePokemonMessage, globalState } = require("./pokemonHandler");

// --- AUTOMATIC SPAM SYSTEM ---
let spamInterval = null;
async function startSpam(client) {
    if (spamInterval) return;
    async function spamLoop() {
        while (config.spamming && config.spamChannel) {
            // Stop spam if the bot is paused (due to captcha)
            if (globalState.paused) {
                console.log("[SPAM] Paused for captcha. No spam messages will be sent until resumed.");
                break;
            }
            try {
                const channel = await client.channels.fetch(config.spamChannel);
                if (channel) {
                    const msg = pickRandom(spamMessages);
                    await channel.send(msg);
                }
            } catch (e) { /* ignore errors */ }
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
    checkUpdate: false
    // Se eliminó la propiedad 'intents' para evitar el DeprecationWarning
});

client.on("ready", () => {
    // Make the client global for other modules (logs, DMs, etc)
    globalThis.client = client;
    setupCommands(client);

    // Start spam if it's enabled
    if (config.spamming && config.spamChannel) {
        startSpam(client);
    }

    const totalGuilds = client.guilds.cache.size;
    const totalChannels = client.channels.cache.size;
    const botUptime = new Date().toLocaleTimeString();
    
    // Obtener estado del modo servidor (Server Mode)
    const currentServerMode = config.serverAllMode ?? false;

    console.log(`
╔════════════════════════════════════════════╗
║   🟢 ${client.user.tag} CONNECTED.
╠════════════════════════════════════════════╣
║   📊 STATISTICS:
║   🗄️ Guilds: ${totalGuilds.toString().padEnd(15)}
║   📺 Channels: ${totalChannels.toString().padEnd(16)}
║   ⌚ Start time: ${botUptime.padEnd(14)}
╠════════════════════════════════════════════╣
║   ⚙️ CONFIGURATION:
║   🎯 Catch-all: ${globalState.catchAll ? 'ON'.padEnd(19) : 'OFF'.padEnd(18)}
║   🎛 Servers-all: ${currentServerMode ? 'ON'.padEnd(16) : 'OFF'.padEnd(15)}
║   📝 Name List: ${pokemonList.length.toString().padEnd(10)}
║   📬 Spam Channel: ${config.spamChannel ? 'Configured'.padEnd(12) : 'Not configured'.padEnd(12)}
║   🗒️ Log Channel: ${config.logChannel ? 'Configured'.padEnd(14) : 'Not configured'.padEnd(14)}
║   🛑 Error Channel: ${config.errorChannel ? 'Configured'.padEnd(12) : 'Not configured'.padEnd(12)}
║   📩 Spam: ${globalState.spamming ? 'ACTIVE'.padEnd(19) : 'INACTIVE'.padEnd(18)}
╠════════════════════════════════════════════╣
║   ℹ️ Auto-Catcher v2.0 - Catch Pokemon
║   🔹 Type: Custom list Selfbot
║   🔹 Discord_Contact: Ivantree9096
║   🔹 Prefix (!)  Write:  ( !help )
╚════════════════════════════════════════════╝
    `);
});

client.on("messageCreate", async (message) => {
    if (Array.isArray(config.OwnerIDs) && config.OwnerIDs.includes(message.author.id) && message.content.startsWith('!')) {
        // Intercept spam commands to start/stop the loop
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

    // If the bot is manually resumed (by command), reactivate spam if applicable
    if (!globalState.paused && config.spamming && config.spamChannel && !spamInterval) {
        startSpam(client);
    }
});

client.login(config.TOKEN)
    .catch(error => {
        console.error("💀 FATAL ERROR ON STARTUP:", error);
        process.exit(1);
    });
