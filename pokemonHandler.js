// pokemonHandler.js

const { reportError } = require('./utils');
const { solveHint } = require('pokehint');
const fs = require('fs');
const path = require('path');

let config = require('./config').config;
let pokemonList = require('./config').pokemonList;
let pokemonListPath = require('./config').pokemonListPath;

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
    // Tomar solo el contenido de la primera línea para ignorar pings, IDs o textos secundarios.
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

        let genero = '¿?';
        let nivel = '¿?';
        let iv = '¿?';
        let match = captureMessage.match(/Level (\d+)/i);
        if (match) nivel = match[1];

        match = captureMessage.match(/([♂️♀️])/);
        if (match) {
            genero = match[1];
        } else if (captureMessage.includes(':male:')) {
            genero = '♂️';
        } else if (captureMessage.includes(':female:')) {
            genero = '♀️';
        }
        match = captureMessage.match(/\((\d{1,3}\.\d+)%\)/);
        if (match) iv = match[1] + '%';

        const fecha = new Date();
        const fechaStr = fecha.toLocaleString('es-ES', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true
        });

        let guildName = '¿?';
        let channelName = '¿?';
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
            `| Captura exitosa 🎉`,
            `| Servidor: **${guildName}**`,
            `| Canal: ${channelClickable}`,
            (msgLink ? `| [**ir al mensaje de captura**](${msgLink})` : ''),
            `| **Género:** ${genero}`,
            `| **Nivel:** ${nivel}`,
            `| **IV:** ${iv}`,
            `| **fecha:** ${fechaStr}`
        ].filter(Boolean).join('\n');
    console.log(`[LOG] Enviando log de captura: ${pokemonName} | Servidor: ${guildName} | Canal: #${channelName}`);
    await channel.send(logMessage);
    } catch (error) {
        await reportError(`Error al enviar log de captura (${pokemonName}) al canal de log: ${error && error.message ? error.message : error}`,
            globalThis.client, config);
    }
}

async function handlePokemonMessage(message) {
    if (globalState.paused) return;
    if (message.author.bot && message.author.id !== config.POKETWO_ID && !config.nameBots.includes(message.author.id)) return;

    let localPokemonList = [];
    try {
        localPokemonList = JSON.parse(fs.readFileSync(path.join(__dirname, 'pokemon_list.json'), 'utf8'));
    } catch (err) {
        localPokemonList = [];
    }
    const channelId = message.channel.id;
    const state = getChannelState(channelId);

    if (message.author.id === config.POKETWO_ID &&
        (message.content.includes("A wild pokémon has appeared!") ||
         message.embeds.some(e => e.description?.includes("Guess the pokémon")))) {
        console.log(`[${channelId}] 🔶 spawn detectado`);
        state.lastSpawn = Date.now();
        state.pokemon = null;
        state.attempts = 0;
        state.waitingForName = true;
        state.failedNames = new Set();
        setTimeout(() => {
            if (state.waitingForName && !state.pokemon) {
                console.log(`[${channelId}] ⏳ No se recibió nombre, solicitando pista...`);
                message.channel.send(`<@${config.POKETWO_ID}> h`);
                state.waitingForName = false;
            }
        }, config.settings.nameWaitTime);
        return;
    }

    if (config.nameBots.includes(message.author.id) && state.waitingForName) {
        const name = extractPokemonName(message.content);
        if (!name) {
            console.log(`[${channelId}] ⚠️ No se pudo extraer el nombre. Abortando...`);
            return;
        }
        const normalizedName = normalizeName(name);
        console.log(`[${channelId}] 🔄 Analizando: ${normalizedName}`);
        let shouldCatch = false;
        if (globalState.catchAll) {
            shouldCatch = true;
        } else {
            shouldCatch = localPokemonList.some(p => normalizeName(p) === normalizedName);
        }
        if (!shouldCatch) {
            console.log(`[${channelId}] 🛑 No hay coincidencia en lista`);
            console.log(`[${channelId}] 🚫 ${normalizedName} ignorado`);
            state.waitingForName = false;
            return;
        }
        if (state.failedNames.has(normalizedName)) {
            console.log(`[${channelId}] ⚠️ ${normalizedName} falló en este spawn, ignorando...`);
            state.waitingForName = false;
            return;
        }
        if (!globalState.catchAll) {
            console.log(`[${channelId}] 🟢 Coincidencia Detectada`);
        }
        state.pokemon = normalizedName;
        state.attempts = 1;
        state.waitingForName = false;
        setTimeout(async () => {
            try {
                console.log(`[${channelId}] 🎣 Capturando ${normalizedName}`);
                await message.channel.send(`<@${config.POKETWO_ID}> c ${normalizedName}`);
            } catch (error) {
                console.error(`[${channelId}] ❌ Error al enviar mensaje de captura: ${error.message}`);
                await reportError(`Error de permisos al capturar. Canal: <#${channelId}>. Asegúrate de que el bot tenga permiso para enviar mensajes en ese canal.`,
                    globalThis.client, config);
                state.pokemon = null;
            }
        }, config.settings.reactionTime);
        return;
    }

    if (message.author.id === config.POKETWO_ID && message.content.includes("That is the wrong pokémon!")) {
        if (!state.pokemon) return;
        console.log(`[${channelId}] ❌ Captura fallida <${state.pokemon}>`);
        state.failedNames.add(state.pokemon);
        if (state.attempts < config.settings.maxAttempts) {
            state.attempts++;
            state.pokemon = null;
            setTimeout(async () => {
                try {
                    console.log(`[${channelId}] 📝 Solicitando nueva pista...`);
                    await message.channel.send(`<@${config.POKETWO_ID}> h`);
                } catch (error) {
                    console.error(`[${channelId}] ❌ Error al solicitar pista: ${error.message}`);
                    await reportError(`Error de permisos al solicitar pista. Canal: <#${channelId}>. Asegúrate de que el bot tenga permiso para enviar mensajes en ese canal.`,
                        globalThis.client, config);
                    state.pokemon = null;
                }
            }, config.settings.reactionTime);
        } else {
            console.log(`[${channelId}] 🛑 Límite de intentos alcanzado`);
            state.pokemon = null;
            state.attempts = 0;
        }
        return;
    }

    if (message.author.id === config.POKETWO_ID && message.content.includes("The pokémon is")) {
        if (state.pokemon) return;
        const [pokemonName] = await solveHint(message);
        if (!pokemonName) return;
        const normalizedName = normalizeName(pokemonName);
        console.log(`[${channelId}] 📩 Hint resuelto: ${normalizedName}`);
        let shouldCatch = false;
        if (globalState.catchAll) {
            shouldCatch = true;
        } else {
            shouldCatch = localPokemonList.some(p => normalizeName(p) === normalizedName);
        }
        if (!shouldCatch) {
            console.log(`[${channelId}] ❌ No hay coincidencia en lista (Hint)`);
            console.log(`[${channelId}] 🚫 ${normalizedName} ignorado`);
            return;
        }
        if (state.failedNames.has(normalizedName)) {
            console.log(`[${channelId}] ⚠️ ${normalizedName} falló en este spawn, ignorando...`);
            return;
        }
        if (!globalState.catchAll) {
            console.log(`[${channelId}] 📗 Coincidencia en lista (Hint)`);
        }
        state.pokemon = normalizedName;
        state.attempts++;
        setTimeout(async () => {
            try {
                console.log(`[${channelId}] 🎣 Capturando desde hint: ${normalizedName}`);
                await message.channel.send(`<@${config.POKETWO_ID}> c ${normalizedName}`);
            } catch (error) {
                console.error(`[${channelId}] ❌ Error al enviar mensaje de captura desde hint: ${error.message}`);
                await reportError(`Error de permisos al capturar (hint). Canal: <#${channelId}>. Asegúrate de que el bot tenga permiso para enviar mensajes.`,
                    globalThis.client, config);
                state.pokemon = null;
            }
        }, config.settings.reactionTime);
        return;
    }

    if (message.author.id === config.POKETWO_ID &&
        (message.content.includes("Congratulations") || message.content.includes("You caught a"))) {
        if (!state.pokemon) return;
        console.log(`[${channelId}] 🎉 Captura exitosa <${state.pokemon}>`);
        globalThis.lastCaptureMsg = message;
        sendLog(state.pokemon, channelId, message.content);
        state.pokemon = null;
        state.attempts = 0;
    }

    const CAPTCHA_TRIGGERS = [
        "Whoa there. Please tell us you're human!",
        "https://verifypoketwo.net/captcha/",
        "select all",
        "verification",
        "human",
        "captcha"
    ];
    if (message.author.id === config.POKETWO_ID &&
        CAPTCHA_TRIGGERS.some(trigger => message.content.toLowerCase().includes(trigger.toLowerCase()))) {
        console.log(`[${channelId}] ⚠️ CAPTCHA DETECTADO. Bot pausado.`);
        globalState.paused = true;

        // NUEVO: Pausar inciensos automáticamente
        const channel = message.channel;
        try {
            await channel.send(`<@${config.POKETWO_ID}> inc p all`);
            // Esperar un momento para que Pokétwo responda con el botón
            setTimeout(async () => {
                const fetched = await channel.messages.fetch({ limit: 10 });
                const confirmMsg = fetched.find(m =>
                    m.author.id === config.POKETWO_ID &&
                    m.components.length > 0 &&
                    m.components[0].components.some(c => c.label && c.label.toLowerCase() === 'confirm')
                );
                if (confirmMsg) {
                    const confirmButton = confirmMsg.components[0].components.find(c => c.label && c.label.toLowerCase() === 'confirm');
                    await confirmMsg.clickButton(confirmButton.customId);
                    console.log(`[${channelId}] ✅ Botón 'Confirm' para pausar incienso presionado.`);
                }
            }, 1500); // 1.5 segundos de espera
        } catch (e) {
            console.error(`[${channelId}] ❌ No se pudo enviar el comando para pausar inciensos. Error: ${e.message}`);
        }

        if (Array.isArray(config.OwnerIDs) && globalThis.client) {
            (async () => {
                for (const ownerId of config.OwnerIDs) {
                    try {
                        const user = await globalThis.client.users.fetch(ownerId);
                        if (user) {
                            const captchaLink = `https://discord.com/channels/${message.guildId}/${message.channelId}/${message.id}`;
                            await user.send(`⚠️ CAPTCHA DETECTADO. El bot ha sido pausado automáticamente.\n\n[Haz clic aquí para resolverlo](${captchaLink})\n\nUsa \`!resume\` tras resolverlo.`);
                        }
                    } catch (e) { /* ignorar error de DM */ }
                }
            })();
        }
    }
}

module.exports = {
    handlePokemonMessage,
    globalState
};
