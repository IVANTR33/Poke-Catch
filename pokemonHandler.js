// pokemonHandler.js

const { reportError, delay, pickRandom } = require('./utils');
const { solveHint } = require('pokehint');
const fs = require('fs');
const path = require('path');

let config = require('./config').config;
let pokemonList = require('./config').pokemonList;
let pokemonListPath = require('./config').pokemonListPath;


let pokemonAliases = {};
try {
    const rawAliases = JSON.parse(fs.readFileSync('./pokemon_aliases.json', 'utf8')); 

    for (const key in rawAliases) {
        if (rawAliases.hasOwnProperty(key)) {
            const normalizedKey = normalizeAliasKey(key); 
            pokemonAliases[normalizedKey] = rawAliases[key];
        }
    }
    
} catch (e) {
    console.error("[ERROR] Could not load pokemon_aliases.json. Using empty object.", e.message);
}

function normalizeAliasKey(name) {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '');
}

function getCatchNameAlias(standardName) {
    const normalizedKey = normalizeAliasKey(standardName);
    
    if (pokemonAliases[normalizedKey] && Array.isArray(pokemonAliases[normalizedKey]) && pokemonAliases[normalizedKey].length > 0) {
        const alias = pickRandom(pokemonAliases[normalizedKey]);
        console.log(`[ALIAS] Selected alias '${alias}' for '${standardName}'.`);
        return alias; 
    }
    
    if (standardName.length > 0) {
        const capitalizedName = standardName.charAt(0).toUpperCase() + standardName.slice(1);
        return capitalizedName;
    }
    return standardName;
}


function isCaptureAllowed(guildId, config) {
    if (!guildId) return false; 
    
    const isUniversalMode = config.serverAllMode ?? false;

    if (isUniversalMode) {
        return true;
    }

    const allowedServers = config.allowedServers || [];
    return allowedServers.includes(guildId);
}


let globalState = {
    paused: config.paused || false,
    catchAll: config.catchAll || false, 
    spamming: config.spamming || false
};
const channelStates = new Map();

function normalizeName(name) {
    return name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s.'-]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractPokemonName(content) {
    let firstLineContent = content.split('\n')[0];

    let cleanContent = firstLineContent
        .replace(/^(Poké-Name APP:)\s*/i, '')
        .replace(/:\s*\d{1,3}\.\d+%/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/【.*?】/g, '')
        .replace(/〈.*?〉/g, '')
        .replace(/❨.*?❩/g, '')
        .replace(/⦗.*?⦘/g, '')
        .replace(/<a?:.+?:\d+>/g, '')
        .replace(/[\u{1F600}-\u{1F6FF}]/gu, '')
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
        .replace(/\*\*/g, '')
        .replace(/гҖҗ.*?гҖ‘/g, '')
        .replace(/<:_:\d+>/g, '')
        .replace(/:flag_[a-z]{2}:/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (!cleanContent) return null;

    const patterns = [
        /The pokémon is (.+)/i,
        /Possible Pokémon: ([^,\n]+)/i,
        /^([^гҖҗ\[]+)/,
        /^(\d+\)\s*)?([^(]+)/,
        /([a-zA-ZÁÉÍÓÚáéíóúÑñ][a-zA-ZÁÉÍÓÚáéíóúÑñ\s.'-]+)/ 
    ];

    for (const pattern of patterns) {
        const match = cleanContent.match(pattern);
        if (match && match[1]) {
            const rawName = match[1].replace(/_/g, ' ').trim();
            return rawName.replace(/^[\d#\s]+/, '').trim();
        }
    }
    return cleanContent || null;
}

function getChannelState(channelId) {
    if (!channelStates.has(channelId)) {
        channelStates.set(channelId, {
            lastSpawn: 0,
            pokemon: null,
            attempts: 0,
            waitingForName: false,
            failedNames: new Set()
        });
    }
    return channelStates.get(channelId);
}

async function sendLog(pokemonName, channelId, captureMessage) {
    if (!config.logChannel) return;
    try {
        const channel = await globalThis.client.channels.fetch(config.logChannel);
        if (!channel) return;

        let gender = '??';
        let level = '??';
        let iv = '??';
        let match = captureMessage.match(/Level (\d+)/i);
        if (match) level = match[1];

        match = captureMessage.match(/([♂️♀️])/);
        if (match) {
            gender = match[1];
        } else if (captureMessage.includes(':male:')) {
            gender = '♂️';
        } else if (captureMessage.includes(':female:')) {
            gender = '♀️';
        }
        match = captureMessage.match(/\((\d{1,3}\.\d+)%\)/);
        if (match) iv = match[1] + '%';

        const date = new Date();
        const dateStr = date.toLocaleString('en-US', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
        });

        let guildName = '??';
        let channelName = '??';
        let msgLink = '';
        let channelClickable = '';
        if (globalThis.lastCaptureMsg) {
            msgLink = `https://discord.com/channels/${globalThis.lastCaptureMsg.guildId}/${globalThis.lastCaptureMsg.channelId}/${globalThis.lastCaptureMsg.id}`;
            try {
                const guild = globalThis.client.guilds.cache.get(globalThis.lastCaptureMsg.guildId);
                if (guild) guildName = guild.name;
                const ch = guild?.channels.cache.get(globalThis.lastCaptureMsg.channelId);
                if (ch) channelName = ch.name;
            } catch {}
            channelClickable = `<#${globalThis.lastCaptureMsg.channelId}>`;
        } else {
            msgLink = '';
            try {
                const ch = globalThis.client.channels.cache.get(channelId);
                if (ch) channelName = ch.name;
                if (ch && ch.guild) guildName = ch.guild.name;
            } catch {}
            channelClickable = `<#${channelId}>`;
        }

        const logMessage = [
            `# * 🔶 ${pokemonName}`,
            `| Successful capture 🎉`,
            `| Server: **${guildName}**`,
            `| Channel: ${channelClickable}`,
            (msgLink ? `| [**go to capture message**](${msgLink})` : ''),
            `| **Gender:** ${gender}`,
            `| **Level:** ${level}`,
            `| **IV:** ${iv}`,
            `| **Date:** ${dateStr}`
        ].filter(Boolean).join('\n');
    console.log(`[LOG] Sending capture log: ${pokemonName} | Server: ${guildName} | Channel: #${channelName}`);
    await channel.send(logMessage);
    } catch (error) {
        await reportError(`Error sending capture log (${pokemonName}) to log channel: ${error && error.message ? error.message : error}`,
            globalThis.client, config);
    }
}


async function handlePokemonMessage(message) {
    if (globalState.paused) return;
    if (message.author.bot && message.author.id !== config.POKETWO_ID && !config.nameBots.includes(message.author.id)) return;

    if (!message.guild || !isCaptureAllowed(message.guild.id, config)) {
        return; 
    }
    // -----------------------------------------------------------

    let localPokemonList = [];
    try {
        localPokemonList = JSON.parse(fs.readFileSync(path.join(__dirname, 'pokemon_list.json'), 'utf8'));
    } catch (err) {
        localPokemonList = [];
    }
    const channelId = message.channel.id;
    const state = getChannelState(channelId);
    
    const CAPTCHA_TRIGGERS_CONTENT = [
        "Whoa there. Please tell us you're human!",
        "https://verifypoketwo.net/captcha/",
        "select all",
        "verification",
        "human",
        "captcha"
    ];
    
    function isCaptchaMessage(msg) {
        if (msg.author.id !== config.POKETWO_ID) return false;
        if (!msg.embeds || msg.embeds.length === 0) {
            return CAPTCHA_TRIGGERS_CONTENT.some(trigger => msg.content.toLowerCase().includes(trigger.toLowerCase()));
        }
        
        const embed = msg.embeds[0];
        return (embed.title && embed.title.includes('Verification required')) || 
               (embed.description && embed.description.includes('are you human'));
    }

    if (isCaptchaMessage(message)) {
        console.log(`[${channelId}] ⚠️ CAPTCHA DETECTED. Bot paused.`);
        globalState.paused = true;

        const channel = message.channel;
        try {
            await channel.send(`<@${config.POKETWO_ID}> inc p all`);
            
            setTimeout(async () => {
                const fetched = await channel.messages.fetch({ limit: 10 });
                const confirmMsg = fetched.find(m =>
                    m.author.id === config.POKETWO_ID &&
                    m.components.length > 0 &&
                    m.components[0].components.some(c => c.label && c.label.toLowerCase() === 'confirm')
                );
                if (confirmMsg) {
                    const confirmButton = confirmMsg.components[0].components.find(c => c.label && c.label.toLowerCase() === 'confirm');
                    // Necesitarás una implementación de clickButton si no está en tu selfbot-v13. Asumiendo que sí.
                    await confirmMsg.clickButton(confirmButton.customId); 
                    console.log(`[${channelId}] ✅ 'Confirm' button for pausing incense pressed.`);
                }
            }, 1500); 
        } catch (e) {
            console.error(`[${channelId}] ❌ Could not send command to pause incenses. Error: ${e.message}`);
        }


        if (Array.isArray(config.OwnerIDs) && globalThis.client) {
            (async () => {
                for (const ownerId of config.OwnerIDs) {
                    try {
                        const user = await globalThis.client.users.fetch(ownerId);
                        if (user) {
                            const captchaLink = `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`;
                            await user.send(`⚠️ CAPTCHA DETECTED. The bot has been automatically paused.\n\n[Click here to solve it](${captchaLink})\n\nUse \`!resume\` after solving.`);
                        }
                    } catch (e) { /* ignore DM error */ }
                }
            })();
        }
        return;
    }



    if (message.author.id === config.POKETWO_ID &&
        (message.content.includes("A wild pokémon has appeared!") ||
         message.embeds.some(e => e.description?.includes("Guess the pokémon")))) {
        console.log(`[${channelId}] 🔶 Spawn detected`);
        state.lastSpawn = Date.now();
        state.pokemon = null;
        state.attempts = 0;
        state.waitingForName = true;
        state.failedNames = new Set();
        setTimeout(() => {
            if (state.waitingForName && !state.pokemon) {
                console.log(`[${channelId}] ⏳ Name not received, requesting hint...`);
                message.channel.send(`<@${config.POKETWO_ID}> h`);
                state.waitingForName = false;
            }
        }, config.settings.nameWaitTime);
        return;
    }
    
    if (config.nameBots.includes(message.author.id) && state.waitingForName) {
        const name = extractPokemonName(message.content);
        if (!name) {
            console.log(`[${channelId}] ⚠️ Could not extract name from Name Bot. Aborting...`);
            return;
        }
        const normalizedName = normalizeName(name);
        console.log(`[${channelId}] 🔄 Analyzing Name: ${normalizedName}`);
        
        let shouldCatch = globalState.catchAll;
        if (!shouldCatch) {
            shouldCatch = localPokemonList.some(p => normalizeName(p) === normalizedName);
        }

        if (!shouldCatch) {
            console.log(`[${channelId}] 🛑 No match (CatchAll: ${globalState.catchAll ? 'ON' : 'OFF'}). ${normalizedName} ignored.`);
            state.waitingForName = false;
            return;
        }
        if (state.failedNames.has(normalizedName)) {
            console.log(`[${channelId}] ⚠️ ${normalizedName} failed in this spawn, ignoring...`);
            state.waitingForName = false;
            return;
        }
        
        const nameToSend = getCatchNameAlias(normalizedName);
        
        state.pokemon = normalizedName;
        state.attempts = 1;
        state.waitingForName = false;
        

        await delay(config.settings.reactionTime);

        try {
            console.log(`[${channelId}] 🎣 Catching ${normalizedName} as '${nameToSend}' (NameBots)`);
            await message.channel.send(`<@${config.POKETWO_ID}> c ${nameToSend}`);
        } catch (error) {
            console.error(`[${channelId}] ❌ Error sending capture message: ${error.message}`);
            await reportError(`Permission error during capture. Channel: <#${channelId}>. Make sure the bot has permission to send messages in that channel.`,
                globalThis.client, config);
            state.pokemon = null;
        }
        return;
    }

    // --- 5. CAPTURA FALLIDA (Lógica original) ---
    if (message.author.id === config.POKETWO_ID && message.content.includes("That is the wrong pokémon!")) {
        if (!state.pokemon) return;
        console.log(`[${channelId}] ❌ Capture failed <${state.pokemon}>`);
        state.failedNames.add(state.pokemon);
        if (state.attempts < config.settings.maxAttempts) {
            state.attempts++;
            state.pokemon = null;
            setTimeout(async () => {
                try {
                    console.log(`[${channelId}] 📝 Requesting new hint (Attempt ${state.attempts}/${config.settings.maxAttempts})...`);
                    await message.channel.send(`<@${config.POKETWO_ID}> h`);
                } catch (error) {
                    console.error(`[${channelId}] ❌ Error requesting hint: ${error.message}`);
                    await reportError(`Permission error requesting hint. Channel: <#${channelId}>. Make sure the bot has permission to send messages in that channel.`,
                        globalThis.client, config);
                    state.pokemon = null;
                }
            }, config.settings.reactionTime);
        } else {
            console.log(`[${channelId}] 🛑 Attempt limit reached`);
            state.pokemon = null;
            state.attempts = 0;
        }
        return;
    }

    if (message.author.id === config.POKETWO_ID && message.content.includes("The pokémon is")) {
        if (state.pokemon) return;

        const [pokemonName] = await solveHint(message); 
        if (!pokemonName) {
            console.log(`[${channelId}] ⚠️ Could not solve hint message.`);
            return;
        }
        const normalizedName = normalizeName(pokemonName);
        console.log(`[${channelId}] 📩 Hint solved: ${normalizedName}`);
        
        let shouldCatch = globalState.catchAll;
        if (!shouldCatch) {
            shouldCatch = localPokemonList.some(p => normalizeName(p) === normalizedName);
        }

        if (!shouldCatch) {
            console.log(`[${channelId}] ❌ No match in list (Hint) (CatchAll: ${globalState.catchAll ? 'ON' : 'OFF'})`);
            return;
        }
        if (state.failedNames.has(normalizedName)) {
            console.log(`[${channelId}] ⚠️ ${normalizedName} failed in this spawn, ignoring...`);
            return;
        }
        
        const nameToSend = getCatchNameAlias(normalizedName);
        
        state.pokemon = normalizedName;
        state.attempts++;
        
        // Aplicar retraso para el comando
        await delay(config.settings.reactionTime);

        try {
            console.log(`[${channelId}] 🎣 Catching from hint: ${normalizedName} as '${nameToSend}'`);
            await message.channel.send(`<@${config.POKETWO_ID}> c ${nameToSend}`);
        } catch (error) {
            console.error(`[${channelId}] ❌ Error sending capture message from hint: ${error.message}`);
            await reportError(`Permission error during capture (hint). Channel: <#${channelId}>. Make sure the bot has permission to send messages.`,
                globalThis.client, config);
            state.pokemon = null;
        }
        return;
    }

    if (message.author.id === config.POKETWO_ID &&
        (message.content.includes("Congratulations") || message.content.includes("You caught a"))) {
        if (!state.pokemon) return;
        console.log(`[${channelId}] 🎉 Successful capture <${state.pokemon}>`);
        globalThis.lastCaptureMsg = message;
        sendLog(state.pokemon, channelId, message.content);
        state.pokemon = null;
        state.attempts = 0;
    }
}

module.exports = {
    handlePokemonMessage,
    globalState,
    isCaptureAllowed
};
