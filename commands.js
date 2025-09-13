// commands.js


const { pickRandom } = require('./utils');
const { config, spamMessages, pokemonList, configPath } = require('./config');
const fs = require('fs');
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
    let listStr = `**Lista de Pokémon (Página ${currentPage}/${Math.ceil(pokemonList.length / config.settings.itemsPerPage)})**\n\n`;
    pageItems.forEach((pokemon, idx) => {
        listStr += `${startIdx + idx + 1}. ${pokemon}\n`;
    });
    listStr += `\n**Total: ${pokemonList.length} | Delay: 1500ms**\n`;
    listStr += `**Usa !next/!back o !next X/!back X para navegar**`;
    return listStr;
}

function formatPokemonName(name) {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

function handleCommand(message, prefix) {
    if (!message.content.startsWith(prefix)) return;
    // Solo owners pueden ejecutar comandos
    const { OwnerIDs } = require('./config').config;
    if (!Array.isArray(OwnerIDs) || !OwnerIDs.includes(message.author.id)) return;
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    switch (command) {
        case 'error': {
            if (!args.length) {
                const channelInfo = config.errorChannel ? `<#${config.errorChannel}>` : 'No configurado';
                return message.reply(`ℹ️ Canal de errores actual: ${channelInfo}`);
            }
            const errorChannelMention = message.mentions.channels.first();
            if (!errorChannelMention) {
                return message.reply('❌ Debes mencionar un canal válido. Ejemplo: `!error #canal`');
            }
            config.errorChannel = errorChannelMention.id;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            message.reply(`✅ Canal de errores establecido a: <#${errorChannelMention.id}>`);
            break;
        }
        case 'p': {
            if (!args.length) return message.reply('❌ Debes escribir el comando a enviar. Ejemplo: `!p pokedex`');
            const poketwoMention = `<@${config.POKETWO_ID}>`;
            const text = args.join(' ');
            message.channel.send(`${poketwoMention} ${text}`);
            break;
        }
        case 'add': {
            if (!args.length) return message.reply('❌ Debes especificar un Pokémon. Ejemplo: `!add Pikachu`');
            const pokemonToAdd = formatPokemonName(args.join(' '));
            if (pokemonList.includes(pokemonToAdd)) return message.reply(`ℹ️ ${pokemonToAdd} ya está en la lista.`);
            pokemonList.push(pokemonToAdd);
            // Guardar en archivo
            const { pokemonListPath } = require('./config');
            const fs = require('fs');
            fs.writeFileSync(pokemonListPath, JSON.stringify(pokemonList, null, 2));
            message.reply(`✅ ${pokemonToAdd} añadido. Total: ${pokemonList.length}`);
            break;
        }
        case 'remove': {
            if (!args.length) return message.reply('❌ Debes especificar un Pokémon. Ejemplo: `!remove Pikachu`');
            const pokemonToRemove = formatPokemonName(args.join(' '));
            const index = pokemonList.indexOf(pokemonToRemove);
            if (index === -1) return message.reply(`ℹ️ ${pokemonToRemove} no está en la lista.`);
            pokemonList.splice(index, 1);
            // Guardar en archivo
            const { pokemonListPath } = require('./config');
            const fs = require('fs');
            fs.writeFileSync(pokemonListPath, JSON.stringify(pokemonList, null, 2));
            message.reply(`✅ ${pokemonToRemove} eliminado. Total: ${pokemonList.length}`);
            break;
        }
        case 'catchall': {
            if (!args.length) return message.reply(`ℹ️ Modo Catch-all actual: ${config.catchAll ? 'ON' : 'OFF'}`);
            const newValue = args[0].toLowerCase() === 'on';
            config.catchAll = newValue;
            // Sincronizar con globalState si existe (para que el handler lo respete de inmediato)
            if (global.globalState) global.globalState.catchAll = newValue;
            if (globalThis.globalState) globalThis.globalState.catchAll = newValue;
            // Guardar en config.json para persistencia
            const { configPath } = require('./config');
            const fs = require('fs');
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            message.reply(`✅ Modo Catch-all ${config.catchAll ? 'activado' : 'desactivado'}`);
            break;
        }
        case 'list':
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
                message.reply(pickRandom(spamMessages));
                break;
            }
            const subCommand = args[0].toLowerCase();
            if (subCommand === 'on') {
                config.spamming = true;
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                message.reply('✅ Spam activado');
            } else if (subCommand === 'off') {
                config.spamming = false;
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                message.reply('✅ Spam detenido');
            } else {
                // Extraer el ID del canal de la mención
                const channelMention = message.mentions.channels.first();
                if (!channelMention) {
                    return message.reply('❌ Debes mencionar un canal válido. Ejemplo: `!spam #canal`');
                }
                config.spamChannel = channelMention.id;
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                message.reply(`✅ Canal de spam establecido a: <#${channelMention.id}>`);
            }
            break;
        }
        case 'log': {
            if (!args.length) {
                const channelInfo = config.logChannel ? `<#${config.logChannel}>` : 'No configurado';
                return message.reply(`ℹ️ Canal de log actual: ${channelInfo}`);
            }
            const logChannelMention = message.mentions.channels.first();
            if (!logChannelMention) {
                return message.reply('❌ Debes mencionar un canal válido. Ejemplo: `!log #canal`');
            }
            config.logChannel = logChannelMention.id;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            message.reply(`✅ Canal de log establecido a: <#${logChannelMention.id}>`);
            break;
        }
        case 'resume': {
            config.paused = false;
            // Sincronizar con globalState para reanudar catcher y spam en tiempo real
            if (global.globalState) global.globalState.paused = false;
            if (globalThis.globalState) globalThis.globalState.paused = false;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            message.reply('✅ Sistema reanudado.');
            break;
        }
        case 'trade': {
            if (!client) return message.reply('❌ El bot no está inicializado correctamente.');
            (async () => {
                const fetched = await message.channel.messages.fetch({ limit: 20 });
                const poketwoMessages = fetched.filter(m => m.author.id === config.POKETWO_ID && m.components && m.components.length > 0).first(5);
                if (!poketwoMessages.length) return message.reply('❌ No se encontraron mensajes recientes de Pokétwo con botones.');

                // Si el argumento es un número, hace click en el botón correspondiente del mensaje más reciente
                if (args.length === 1 && !isNaN(args[0])) {
                    const idx = parseInt(args[0], 10) - 1;
                    const mostRecentMsg = poketwoMessages[0];
                    let allButtons = [];
                    mostRecentMsg.components.forEach(row => {
                        row.components.forEach(btn => {
                            allButtons.push({msg: mostRecentMsg, btn});
                        });
                    });
                    if (!allButtons[idx]) return message.reply('❌ Opción inválida.');
                    try {
                        await allButtons[idx].msg.clickButton(allButtons[idx].btn.customId);
                    } catch (e) {
                        return message.reply('❌ Error al presionar el botón.');
                    }
                    return;
                }

                // Si el argumento es un texto, busca el botón más reciente que coincida
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
                    if (!found) return message.reply('❌ No se encontró ningún botón que coincida con ese nombre en los mensajes recientes.');
                    try {
                        await found.msg.clickButton(found.btn.customId);
                    } catch (e) {
                        return message.reply('❌ Error al presionar el botón.');
                    }
                    return;
                }

                // Si no hay argumentos, muestra la lista de todos los botones disponibles
                let allButtons = [];
                poketwoMessages.forEach((msg) => {
                    msg.components.forEach(row => {
                        row.components.forEach(btn => {
                            allButtons.push({msg, btn});
                        });
                    });
                });
                if (!allButtons.length) return message.reply('❌ No se encontraron botones en los mensajes recientes.');
                let optionsMsg = '**Se encontraron los siguientes botones:**\n';
                allButtons.forEach((m, i) => {
                    optionsMsg += `${i+1}. ${m.btn.label}\n`;
                });
                optionsMsg += '\nResponde con !confirm <número> para hacer clic en el botón correspondiente.';
                if (!globalThis.pendingButtonClicks) globalThis.pendingButtonClicks = {};
                globalThis.pendingButtonClicks[message.author.id] = allButtons;
                return message.reply(optionsMsg);
            })();
            break;
        }
        case 'confirm': {
            (async () => {
                if (!globalThis.pendingButtonClicks || !globalThis.pendingButtonClicks[message.author.id]) {
                    return message.reply('❌ No hay ninguna acción pendiente de confirmación.');
                }
                if (!args.length || isNaN(args[0])) return message.reply('❌ Debes indicar el número de opción. Ejemplo: `!confirm 1`');
                const idx = parseInt(args[0], 10) - 1;
                const pending = globalThis.pendingButtonClicks[message.author.id];
                if (!pending[idx]) return message.reply('❌ Opción inválida.');
                try {
                    await pending[idx].msg.clickButton(pending[idx].btn.customId);
                } catch (e) {
                    return message.reply('❌ Error al presionar el botón.');
                }
                delete globalThis.pendingButtonClicks[message.author.id];
                return;
            })();
            break;
        }
        case 'c': {
            if (!args.length) return message.reply('❌ Debes especificar el texto a copiar. Ejemplo: `!c Hola mundo`');
            const textToCopy = args.join(' ');
            message.channel.send(textToCopy);
            break;
        }
        case 'help': {
            const helpMsg1 = [
                "**🎮 COMANDOS PRINCIPALES**",
                "🔍 **BÚSQUEDA Y CAPTURA**",
                "`!add <pokémon>` → Añade a lista",
                "`!remove <pokémon>` → Elimina de lista",
                "`!catchall <on/off>` → Captura todo",
                "",
                "📋 **GESTIÓN DE LISTA**",
                "`!list` → Muestra lista (25/pág)",
                "`!next`/`!back` → Navega páginas",
                "`!next 3`/`!back 2` → Salto a página X",
                "",
                "⚙️ **CONFIGURACIÓN**",
                "`!spam #canal` → Configura spam",
                "`!spam on/off` → Activa/desactiva",
                "`!log #canal` → Configura logs",
                "`!resume` → Reanuda tras CAPTCHA",
                "`!error #canal` → Configura el canal donde el bot enviará mensajes detallados de cualquier error interno (permisos, acceso, etc)",
                "",
                "🟩 **INTERACCIÓN CON BOTONES**",
                "`!trade <botón>` → Hace clic directamente en el botón más reciente de Pokétwo que coincida con el texto indicado. Ejemplo: `!trade Accept`",
                "`!trade <número>` → Hace clic directamente en el botón N (de izquierda a derecha) del mensaje más reciente de Pokétwo con botones. Ejemplo: `!trade 1` para el primer botón (usualmente Accept), `!trade 2` para el segundo, etc.",
                "`!trade` → Muestra la lista de todos los botones disponibles en los mensajes recientes de Pokétwo para que elijas uno.",
                "`!confirm <número>` → Hace clic en el botón seleccionado de la lista mostrada por !trade.",
                "",
                "♻ **COMANDO MIRROR**",
                "`!c <texto>` → Escribirá lo que tu escribas en el comando",
                "",
                "� **COMANDO POKETWO**",
                "`!p <comando>` → Envía un comando a Pokétwo mencionándolo automáticamente. Ejemplo: `!p pokedex` enviará `@poketwo pokedex`."
            ].join('\n');

            const helpMsg2 = [
                "",
                "�📌 **EJEMPLOS**",
                "• `!add \"Roaring Moon\"` → Nombres compuestos",
                "• `!next 3` → Salta a página 3",
                "• `!c @poketwo pf old` → muestra el perfil ",
                "• `!spam #general` → Spam en #general",
                "• `!trade Accept` → Hace clic directamente en el botón 'Accept' más reciente de Pokétwo",
                "• `!trade 1` → Hace clic en el primer botón (izquierda) del mensaje más reciente de Pokétwo",
                "• `!trade` → Muestra la lista de botones disponibles para elegir",
                "• `!confirm 1` → Hace clic en la primera opción de la lista mostrada por !trade",
                "• `!p pokedex` → Envía `@poketwo pokedex` al canal",
                "",
                '🔸 **Consejo:** Usa comillas "alolan raichu" para nombres con espacios',
                "🛠️ **Soporte:** Contacta al desarrollador  Ivantree9096"
            ].join('\n');

            message.reply(helpMsg1);
            message.reply(helpMsg2);
            break;
        }
        default:
            message.reply('❓ Comando no reconocido. Usa `!help` para ver los comandos disponibles.');
    }
}

module.exports = {
    handleCommand,
    setupCommands
};
