// commands.js

const { pickRandom } = require('./utils');
const { globalState } = require('./pokemonHandler');
const { config, spamMessages, pokemonList, configPath, pokemonListPath } = require('./config'); 
const fs = require('fs');
const path = require('path');

// Definition of saveConfig, using configPath from ./config
function saveConfig(currentConfig) {
    fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 2));
}

let currentPage = 1;
let client = null;

function setupCommands(discordClient) {
    client = discordClient;
}

function showList(page = 1) {
    currentPage = Math.max(1, Math.min(page, Math.ceil(pokemonList.length / config.settings.itemsPerPage)));
    const startIdx = (currentPage - 1) * config.settings.itemsPerPage;
    const endIdx = startIdx + config.settings.itemsPerPage;
    const pageItems = pokemonList.slice(startIdx, endIdx);
    // ENGLISH: List title and pagination
    let listStr = `**Pokémon List (Page ${currentPage}/${Math.ceil(pokemonList.length / config.settings.itemsPerPage)})**\n\n`;
    pageItems.forEach((pokemon, idx) => {
        listStr += `${startIdx + idx + 1}. ${pokemon}\n`;
    });
    // ENGLISH: List summary
    listStr += `\n**Total: ${pokemonList.length} | **\n`;
    listStr += `**Use !next/!back or !next X/!back X to navigate**`;
    return listStr;
}

function formatPokemonName(name) {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

// --- HELP TEXT FUNCTIONS ---

/** Function to split and send long messages (like !help). */
async function sendLongMessage(channel, text) {
    const MAX_CHARS = 1950;
    const chunks = [];
    for (let i = 0; i < text.length; i += MAX_CHARS) {
        chunks.push(text.substring(i, i + MAX_CHARS));
    }
    for (const chunk of chunks) {
        await channel.send(chunk);
    }
}

/** Help text for server commands. */
function getServerHelpText(config) {
    const currentServerMode = config.serverAllMode ?? false; 
    let helpText = `--- 🌐 Server Commands ---\n`;
    helpText += `**Server Mode:** \`${currentServerMode ? 'Universal (ON)' : 'Restricted (OFF)'}\`\n\n`;
    helpText += '`!server list` → Shows the numbered list of servers.\n';
    helpText += '`!server set 1, 5` → **ADDS** servers to the catch list (only in Restricted mode).\n';
    helpText += '`!server all on/off` → Activates/Deactivates Universal Server Mode.\n';
    helpText += '`!server clear` → Clears the list of assigned servers.\n';
    return helpText;
}

/** Help text for spam commands. */
function getSpamHelpText(config) {
    const currentSpamMode = config.spamming ?? false;
    return [
        "--- 📩 Spam Commands ---",
        "**Usage Instructions:**",
        "`!spam #channel` → Configures the spam channel. **Example:** `!spam #general`",
        "`!spam on/off` → Activates/deactivates the spamming loop (Current: " + (currentSpamMode ? 'ON' : 'OFF') + ")",
    ].join('\n');
}

/** Help text for Pokémon List commands. */
function getListHelpText(config) {
    const currentCatchMode = config.catchAll ?? false;
    return [
        "--- 📋 Pokémon List Commands ---",
        "**Usage Instructions:**",
        "**Search & Catch:**",
        "`!add <pokemon>` → Adds a Pokémon to the list. **Example:** `!add Pikachu, Bulbasaur` (multiple names separated by comma)",
        "`!remove <pokemon>` → Removes a Pokémon from the list. **Example:** `!remove Pikachu, Bulbasaur` (multiple names separated by comma)",
        "`!catchall on/off` → Catches all Pokémon (Current: " + (currentCatchMode ? 'ON' : 'OFF') + ")",
        "**List Management:**",
        "`!list` → Shows the current list (25/pg).",
        "`!list clear` → Clears the entire Pokémon list.",
        "`!next`/`!back` → Navigates list pages.",
        "🔸 **Tip:** Use quotes \"alolan raichu\" for names with spaces."
    ].join('\n');
}

// --- SERVER COMMAND FUNCTIONS ---

async function handleServerCommands(client, config, message, args) {
    const command = args[0] ? args[0].toLowerCase() : '';

    switch (command) {
        case 'list':
            return serverListCommand(client, config, message);
        case 'set':
            return serverSetCommand(config, message, args.slice(1));
        case 'all':
            return serverAllCommand(config, message, args.slice(1));
        case 'clear': 
            return serverClearCommand(config, message);
        default:
            return message.channel.send(getServerHelpText(config));
    }
}

async function serverListCommand(client, config, message) {
    const guilds = Array.from(client.guilds.cache.values()); 
    
    const isUniversalMode = config.serverAllMode ?? false;
    const mode = isUniversalMode ? 'Universal (ON)' : 'Restricted (OFF)';
    const allowedCount = config.allowedServers ? config.allowedServers.length : 0;
    
    let header = `**🌐 SERVER LIST**\n\n`;
    header += `**Server Mode:** \`${mode}\`\n`;
    header += `**Allowed Servers:** \`${allowedCount}\`\n\n`;
    header += `Use the numbers to **assign** with \`!server set 1, 3, 5\`.\n\n`;
    
    const guildList = guilds.map((guild, index) =>
        `**[${index + 1}]** ${guild.name}`
    ).join('\n');

    const footer = `\nTotal Servers: ${guilds.length}`;

    const fullMessage = header + guildList + footer;
    
    await sendLongMessage(message.channel, fullMessage);
}

async function serverSetCommand(config, message, args) {
    if (args.length === 0) {
        return message.reply("❌ **ERROR:** You must specify server numbers.\n\n" + getServerHelpText(config)); 
    }

    const guilds = Array.from(message.client.guilds.cache.values());
    const indicesString = args.join('');
    const indices = indicesString
        .split(',')
        .map(s => parseInt(s.trim()))
        .filter(n => !isNaN(n) && n > 0 && n <= guilds.length);

    if (indices.length === 0) {
        return message.reply("❌ Invalid numbers. You must use the numbers from the list (`!server list`) separated by commas. Example: `1, 3, 5`.");
    }
    
    const newServerIds = indices.map(index => guilds[index - 1].id);
    const newServerNames = indices.map(index => guilds[index - 1].name);

    const existingServerIds = new Set(config.allowedServers || []);
    newServerIds.forEach(id => existingServerIds.add(id)); 

    config.allowedServers = Array.from(existingServerIds);
    config.serverAllMode = false; 
    
    saveConfig(config); 

    const namesList = newServerNames.map(g => `\`${g}\``).join(', ');
    
    await message.channel.send(
        `✅ **Servers added/assigned** for catching (Restricted Mode).\n` +
        `Servers added: ${namesList}\n` +
        `Total allowed servers: **${config.allowedServers.length}**.`
    );
}

async function serverClearCommand(config, message) {
    config.allowedServers = [];
    config.serverAllMode = false; 
    saveConfig(config); 
    await message.channel.send("🧹 **Allowed Servers List Cleared**. The designated server catch list is now empty. Server Mode: **Restricted (OFF)**.");
}


async function serverAllCommand(config, message, args) {
    const mode = args[0] ? args[0].toLowerCase() : '';
    
    const currentMode = config.serverAllMode ?? false;

    if (mode === 'on') {
        config.serverAllMode = true;
        saveConfig(config); 
        await message.channel.send("✅ **Universal Server Mode Activated**. The bot will catch on **ALL** servers.");
    } else if (mode === 'off') {
        config.serverAllMode = false;
        saveConfig(config); 
        const serverCount = config.allowedServers ? config.allowedServers.length : 0;
        await message.channel.send(
            `❌ **Restricted Server Mode Activated**.\n` +
            `The bot will only catch on the **${serverCount}** assigned servers (see \`!server list\`).`
        );
    } else {
        return message.reply(`Usage: \`!server all <on|off>\`. Current Server Mode: **${currentMode ? 'ON' : 'OFF'}**.`);
    }
}

async function catchAllCommand(config, message, args) {
    const mode = args[0] ? args[0].toLowerCase() : '';
    
    const currentMode = config.catchAll ?? false;

    if (mode === 'on') {
        config.catchAll = true;
        globalState.catchAll = true; 
        saveConfig(config); 
        await message.channel.send("✅ **Universal Pokémon Mode Activated**. The bot will catch **ALL** Pokémon that appear (list ignored).");
    } else if (mode === 'off') {
        config.catchAll = false;
        globalState.catchAll = false;
        saveConfig(config); 
        
        let localPokemonList = [];
        try {
            localPokemonList = JSON.parse(fs.readFileSync(pokemonListPath, 'utf8'));
        } catch (e) {
            console.error("Error reading pokemonListPath:", e);
        }
        const listCount = localPokemonList.length;
        
        await message.channel.send(
            `❌ **Restricted Pokémon Mode Activated**.\n` +
            `The bot will only catch the **${listCount}** Pokémon on your list.`
        );
    } else {
        return message.reply('❌ **ERROR:** Invalid mode. ' + getListHelpText(config));
    }
}
// --- END SERVER COMMAND AND UTILITY FUNCTIONS ---

async function handleCommand(message, prefix) {
    if (!message.content.startsWith(prefix)) return;
    const { OwnerIDs } = require('./config').config;
    if (!Array.isArray(OwnerIDs) || !OwnerIDs.includes(message.author.id)) return;
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    switch (command) {
        case 'server': 
            return handleServerCommands(client, config, message, args);
        
        case 'catchall':
            return catchAllCommand(config, message, args);
        
        case 'error': {
            if (!args.length) {
                const channelInfo = config.errorChannel ? `<#${config.errorChannel}>` : 'Not configured';
                return message.reply(`ℹ️ Current error channel: ${channelInfo}\n\n**Usage:** \`!error #channel\` → Configures the channel where the bot will send detailed messages of any internal error.`);
            }
            const errorChannelMention = message.mentions.channels.first();
            if (!errorChannelMention) {
                return message.reply('❌ You must mention a valid channel. Example: `!error #channel`');
            }
            config.errorChannel = errorChannelMention.id;
            saveConfig(config);
            message.reply(`✅ Error channel set to: <#${errorChannelMention.id}>`);
            break;
        }
        case 'p': {
            if (!args.length) return message.reply('❌ You must type the command to send.\n\n**Usage:** `!p <command>` → Sends a command to Pokétwo by automatically mentioning it. **Example:** `!p pokedex` will send `@poketwo pokedex`.');
            const poketwoMention = `<@${config.POKETWO_ID}>`;
            const text = args.join(' ');
            message.channel.send(`${poketwoMention} ${text}`);
            break;
        }
        case 'add': {
            if (!args.length) return message.reply('❌ You must specify a Pokémon name to add.\n\n' + getListHelpText(config));
            
            const inputString = args.join(' ');
            const namesToAdd = inputString
                .split(',')
                .map(name => name.trim())
                .filter(name => name.length > 0);

            let addedNames = [];
            let alreadyInList = [];

            for (const name of namesToAdd) {
                const formattedName = formatPokemonName(name);

                // Omite si el nombre está vacío después del formato
                if (!formattedName) continue;

                // Comprueba duplicados y los agrega a la lista principal si no están
                if (pokemonList.includes(formattedName)) {
                    alreadyInList.push(formattedName);
                    continue;
                }

                pokemonList.push(formattedName);
                addedNames.push(formattedName);
            }

            if (addedNames.length > 0) {
                fs.writeFileSync(pokemonListPath, JSON.stringify(pokemonList, null, 2));

                let replyMessage = `✅ **${addedNames.length} Pokémon added.**\nAdded: ${addedNames.join(', ')}\n`;
                if (alreadyInList.length > 0) {
                     replyMessage += `(Skipped, already in list: ${alreadyInList.join(', ')})\n`;
                }
                replyMessage += `Total: **${pokemonList.length}**`;
                return message.reply(replyMessage);

            } else if (alreadyInList.length > 0) {
                return message.reply(`ℹ️ All specified Pokémon were already on the list. Total: ${pokemonList.length}`);
            } else {
                return message.reply('❌ No valid Pokémon names were provided.');
            }
        }
        case 'remove': {
            if (!args.length) return message.reply('❌ You must specify a Pokémon name to remove.\n\n' + getListHelpText(config));

            const inputString = args.join(' ');
            const namesToRemove = inputString
                .split(',')
                .map(name => name.trim())
                .filter(name => name.length > 0);

            let removedNames = [];
            let notInList = [];
            let listModified = false;

            for (const name of namesToRemove) {
                const formattedName = formatPokemonName(name);

                if (!formattedName) continue;

                // Encontrar y remover la primera aparición
                const index = pokemonList.indexOf(formattedName);

                if (index !== -1) {
                    pokemonList.splice(index, 1); // Remove from list
                    removedNames.push(formattedName);
                    listModified = true;
                } else {
                    notInList.push(formattedName);
                }
            }

            if (listModified) {
                fs.writeFileSync(pokemonListPath, JSON.stringify(pokemonList, null, 2));

                let replyMessage = `✅ **${removedNames.length} Pokémon removed.**\nRemoved: ${removedNames.join(', ')}\n`;
                if (notInList.length > 0) {
                     replyMessage += `(Skipped, not found: ${notInList.join(', ')})\n`;
                }
                replyMessage += `Total: **${pokemonList.length}**`;
                return message.reply(replyMessage);

            } else if (notInList.length > 0) {
                return message.reply(`ℹ️ None of the specified Pokémon were on the list. Total: ${pokemonList.length}`);
            } else {
                return message.reply('❌ No valid Pokémon names were provided for removal.');
            }
        }
        case 'list': 
            if (args[0] && args[0].toLowerCase() === 'clear') {
                pokemonList.length = 0; 
                fs.writeFileSync(pokemonListPath, JSON.stringify(pokemonList, null, 2));
                return message.reply(`🧹 **Pokémon List Cleared**. Total: **${pokemonList.length}**.`);
            } else if (args.length) {
                const page = parseInt(args[0]);
                // If it's a page number, proceed to show the list, otherwise, show help.
                if (!isNaN(page) && page > 0) {
                    message.reply(showList(page));
                    break;
                }
                // If argument is not 'clear' and not a valid number, show list help
                return message.reply('❌ **ERROR:** Invalid argument.\n\n' + getListHelpText(config));
            }
            // Default: show list page 1
            message.reply(showList());
            break;
        case 'next': {
            const nextPage = args[0] ? parseInt(args[0]) : currentPage + 1;
            message.reply(showList(nextPage));
            break;
        }
        case 'back': {
            const prevPage = args[0] ? parseInt(args[0]) : currentPage - 1;
            message.reply(showList(prevPage));
            break;
        }
        case 'spam': {
            if (!args.length) {
                // Change: Show help instructions instead of sending a random spam message
                return message.reply(getSpamHelpText(config));
            }
            const subCommand = args[0].toLowerCase();
            if (subCommand === 'on') {
                config.spamming = true;
                globalState.spamming = true;
                saveConfig(config);
                message.reply('✅ Spam activated');
            } else if (subCommand === 'off') {
                config.spamming = false;
                globalState.spamming = false;
                saveConfig(config);
                message.reply('✅ Spam stopped');
            } else {
                const channelMention = message.mentions.channels.first();
                if (!channelMention) {
                    return message.reply('❌ You must mention a valid channel.\n\n' + getSpamHelpText(config));
                }
                config.spamChannel = channelMention.id;
                saveConfig(config);
                message.reply(`✅ Spam channel set to: <#${channelMention.id}>`);
            }
            break;
        }
        case 'log': {
            if (!args.length) {
                const channelInfo = config.logChannel ? `<#${config.logChannel}>` : 'Not configured';
                return message.reply(`ℹ️ Current log channel: ${channelInfo}\n\n**Usage:** \`!log #channel\` → Configures the log channel for activity reports.`);
            }
            const logChannelMention = message.mentions.channels.first();
            if (!logChannelMention) {
                return message.reply('❌ You must mention a valid channel. Example: `!log #channel`');
            }
            config.logChannel = logChannelMention.id;
            saveConfig(config);
            message.reply(`✅ Log channel set to: <#${logChannelMention.id}>`);
            break;
        }
case 'resume': {
            const wasPaused = config.paused;
            
            if (!wasPaused) {
                // Nueva respuesta si no estaba pausado
                return message.reply('ℹ️ **El sistema ya estaba activo (No Pausado).** No se necesita reanudar.');
            }
            
            // Si sí estaba pausado, proceder a reanudar
            config.paused = false;
            globalState.paused = false;
            saveConfig(config);
            
            // Verificar si el canal de logs está configurado para evitar el 404
            if (!config.logChannel) {
                return message.reply('✅ Sistema reanudado. **Advertencia:** El canal de log no está configurado, no se pudo reanudar el incienso. Use `!log #channel` para configurarlo.');
            }

            const channel = await client.channels.fetch(config.logChannel).catch(e => {
                console.error(`[WARN] No se pudo obtener el canal de log ID ${config.logChannel}: ${e.message}`);
                return null; // Devolver null si falla la búsqueda del canal
            });

            if (channel) {
                await message.reply('✅ **Sistema reanudado.** Los inciensos se reanudarán en el canal de logs.');
                console.log("[INFO] El bot ha reanudado. Intentando reanudar incensos en el canal de log.");
                try {
                    await channel.send(`<@${config.POKETWO_ID}> inc r all`);
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
                            console.log(`[${channel.id}] ✅ 'Confirm' button for incense resume clicked.`);
                        }
                    }, 1500);
                } catch (e) {
                    console.error(`[${channel.id}] ❌ Could not send the command to resume incenses. Error: ${e.message}`);
                }
            } else {
                // Si la búsqueda del canal falló, pero sí estaba pausado:
                await message.reply('✅ Sistema reanudado. **Advertencia:** El canal de log no es accesible (ID inválido o canal eliminado), no se pudo reanudar el incienso. Use `!log #channel` para configurar uno válido.');
                console.log(`[WARN] Canal de log configurado pero no accesible. No se pudo reanudar el incienso.`);
            }

            break;
        }
        case 'click': { // Changed from 'trade'
            if (!client) return message.reply('❌ The bot is not initialized correctly.');
            (async () => {
                const fetched = await message.channel.messages.fetch({ limit: 20 });
                const poketwoMessages = fetched.filter(m => m.author.id === config.POKETWO_ID && m.components && m.components.length > 0).first(5);
                if (!poketwoMessages.length) return message.reply('❌ No recent Pokétwo messages with buttons found.');

                // Handling !click <number>
                if (args.length === 1 && !isNaN(args[0])) {
                    const idx = parseInt(args[0], 10) - 1;
                    const mostRecentMsg = poketwoMessages[0];
                    let allButtons = [];
                    mostRecentMsg.components.forEach(row => {
                        row.components.forEach(btn => {
                            allButtons.push({msg: mostRecentMsg, btn});
                        });
                    });
                    if (!allButtons[idx]) return message.reply('❌ Invalid option.');
                    try {
                        await allButtons[idx].msg.clickButton(allButtons[idx].btn.customId);
                    } catch (e) {
                        return message.reply('❌ Error clicking the button.');
                    }
                    return;
                }

                // Handling !click <button name>
                if (args.length) {
                    const buttonLabel = args.join(' ').toLowerCase();
                    let found = null;
                    for (const msg of poketwoMessages) {
                        for (const row of msg.components) {
                            for (const btn of row.components) {
                                if (btn.label && btn.label.toLowerCase().includes(buttonLabel)) {
                                    found = {msg, btn};
                                    break;
                                }
                            }
                            if (found) break;
                        }
                        if (found) break;
                    }
                    if (!found) return message.reply('❌ No button matching that name was found in recent messages.');
                    try {
                        await found.msg.clickButton(found.btn.customId);
                    } catch (e) {
                        return message.reply('❌ Error clicking the button.');
                    }
                    return;
                }

                // Handling !click (show list)
                let allButtons = [];
                poketwoMessages.forEach((msg) => {
                    msg.components.forEach(row => {
                        row.components.forEach(btn => {
                            allButtons.push({msg, btn});
                        });
                    });
                });
                if (!allButtons.length) return message.reply('❌ No buttons found in recent messages.');
                let optionsMsg = '**The following buttons were found:**\n';
                allButtons.forEach((m, i) => {
                    optionsMsg += `${i+1}. ${m.btn.label}\n`;
                });
                optionsMsg += '\nReply with !confirm <number> to click the corresponding button.';
                if (!globalThis.pendingButtonClicks) globalThis.pendingButtonClicks = {};
                globalThis.pendingButtonClicks[message.author.id] = allButtons;
                return message.reply(optionsMsg);
            })();
            break;
        }
        case 'confirm': {
            (async () => {
                if (!globalThis.pendingButtonClicks || !globalThis.pendingButtonClicks[message.author.id]) {
                    return message.reply('❌ There is no pending action to confirm.');
                }
                if (!args.length || isNaN(args[0])) return message.reply('❌ You must provide the option number. Example: `!confirm 1`');
                const idx = parseInt(args[0], 10) - 1;
                const pending = globalThis.pendingButtonClicks[message.author.id];
                if (!pending[idx]) return message.reply('❌ Invalid option.');
                try {
                    await pending[idx].msg.clickButton(pending[idx].btn.customId);
                } catch (e) {
                    return message.reply('❌ Error clicking the button.');
                }
                delete globalThis.pendingButtonClicks[message.author.id];
                return;
            })();
            break;
        }
        case 'c': {
            if (!args.length) return message.reply('❌ You must specify the text to copy.\n\n**Usage:** `!c <text>` → Will write whatever you type in the command. **Example:** `!c @poketwo pf old`');
            const textToCopy = args.join(' ');
            message.channel.send(textToCopy);
            break;
        }
        case 'help': {
            const currentCatchMode = config.catchAll ?? false;
            const currentServerMode = config.serverAllMode ?? false;

            // Help Message 1
            const helpMsg1 = [
                "**🎮 MAIN COMMANDS**",
                "🔍 **SEARCH & CATCH**",
                "`!add <pokemon>` → Adds to list. **Example:** `!add Bulbasaur, Charmander` (multiple names separated by comma)", // UPDATED
                "`!remove <pokemon>` → Removes from list. **Example:** `!remove Bulbasaur, Charmander` (multiple names separated by comma)", // UPDATED
                "`!catchall on/off` → Catches all (Current: " + (currentCatchMode ? 'ON' : 'OFF') + ")",
                "",
                "🌐 **SERVER CONTROL**",
                "`!server list` → Shows list of guilds with numbers.",
                "`!server set 1, 5` → **ADDS** guilds for capture (Current Server Mode: " + (currentServerMode ? 'Universal' : 'Restricted') + ")",
                "`!server all on/off` → Activates/Deactivates universal capture (Current: " + (currentServerMode ? 'ON' : 'OFF') + ")",
                "`!server clear` → Clears the list of assigned servers.", 
                "",
                "📋 **LIST MANAGEMENT**",
                "`!list` → Shows list (25/pg)",
                "`!list clear` → Clears the Pokémon list.", 
                "`!next`/`!back` → Navigates pages",
                "`!next 3`/`!back 2` → Jumps to page X",
                "",
                "⚙️ **CONFIGURATION**",
                "`!spam #channel` → Configures spam",
                "`!spam on/off` → Activates/deactivates",
                "`!log #channel` → Configures logs",
                "`!resume` → Resumes after CAPTCHA",
                "`!error #channel` → Configures the channel where the bot will send detailed messages of any internal error (permissions, access, etc)",
                "",
                "🟩 **BUTTON INTERACTION**",
                "`!click <button>` → Directly clicks the most recent Pokétwo button that matches the specified text. Example: `!click Accept`",
                "`!click <number>` → Directly clicks button N (from left to right) of the most recent Pokétwo message with buttons. Example: `!click 1` for the first button (usually Accept), `!click 2` for the second, etc.",
                "`!click` → Shows the list of all available buttons in recent Pokétwo messages for you to choose one.",
                "`!confirm <number>` → Clicks the selected button from the list shown by !click.",
                "",
                "♻ **MIRROR COMMAND**",
                "`!c <text>` → Will write whatever you type in the command",
                "",
                " **POKETWO COMMAND**",
                "`!p <command>` → Sends a command to Pokétwo by automatically mentioning it. Example: `!p pokedex` will send `@poketwo pokedex`."
            ].join('\n');

            // Help Message 2 (Examples)
            const helpMsg2 = [
                "",
                "📌 **EXAMPLES**",
                "• `!add \"Roaring Moon\", Pikachu, Zekrom` → Adds multiple Pokémon (compound names with quotes or simple names, separated by comma).", // MODIFIED EXAMPLE
                "• `!remove Charmander, Squirtle` → Removes multiple Pokémon.", // NEW EXAMPLE
                "• `!next 3` → Jumps to page 3",
                "• `!c @poketwo pf old` → shows the profile ",
                "• `!spam #general` → Spam in #general",
                "• `!server all off` → Activates Restricted Server Mode", 
                "• `!server list` → Shows server list", 
                "• `!server set 1, 5` → **ADDS** the 1st and 5th server for catching.", 
                "• `!server clear` → Clears the list of assigned servers.", 
                "• `!list clear` → Clears the Pokémon list.", 
                "• `!click Accept` → Directly clicks the most recent 'Accept' button from Pokétwo",
                "• `!click 1` → Clicks the first button (left) of the most recent Pokétwo message",
                "• `!click` → Shows the list of available buttons to choose from",
                "• `!confirm 1` → Clicks the first option from the list shown by !click",
                "• `!p pokedex` → Sends `@poketwo pokedex` to the channel",
                "",
                '🔸 **Tip:** Use quotes "alolan raichu" for names with spaces',
                "🛠️ **Support:** Contact the developer  Ivantree9096"
            ].join('\n');

            await sendLongMessage(message.channel, helpMsg1);
            await sendLongMessage(message.channel, helpMsg2);
            break;
        }
        default:
            message.reply('❓ Unrecognized command. Use `!help` to see available commands.');
    }
}

module.exports = {
    handleCommand,
    setupCommands
};
