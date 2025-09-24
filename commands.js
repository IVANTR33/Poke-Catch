// commands.js

const { pickRandom } = require('./utils');
const { globalState } = require('./pokemonHandler');
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
    let listStr = `**Pokémon List (Page ${currentPage}/${Math.ceil(pokemonList.length / config.settings.itemsPerPage)})**\n\n`;
    pageItems.forEach((pokemon, idx) => {
        listStr += `${startIdx + idx + 1}. ${pokemon}\n`;
    });
    listStr += `\n**Total: ${pokemonList.length} | Delay: 1500ms**\n`;
    listStr += `**Use !next/!back or !next X/!back X to navigate**`;
    return listStr;
}

function formatPokemonName(name) {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

// CHANGE HERE: The function is now 'async'
async function handleCommand(message, prefix) {
    if (!message.content.startsWith(prefix)) return;
    // Only owners can run commands
    const { OwnerIDs } = require('./config').config;
    if (!Array.isArray(OwnerIDs) || !OwnerIDs.includes(message.author.id)) return;
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    switch (command) {
        case 'error': {
            if (!args.length) {
                const channelInfo = config.errorChannel ? `<#${config.errorChannel}>` : 'Not configured';
                return message.reply(`ℹ️ Current error channel: ${channelInfo}`);
            }
            const errorChannelMention = message.mentions.channels.first();
            if (!errorChannelMention) {
                return message.reply('❌ You must mention a valid channel. Example: `!error #channel`');
            }
            config.errorChannel = errorChannelMention.id;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            message.reply(`✅ Error channel set to: <#${errorChannelMention.id}>`);
            break;
        }
        case 'p': {
            if (!args.length) return message.reply('❌ You must type the command to send. Example: `!p pokedex`');
            const poketwoMention = `<@${config.POKETWO_ID}>`;
            const text = args.join(' ');
            message.channel.send(`${poketwoMention} ${text}`);
            break;
        }
        case 'add': {
            if (!args.length) return message.reply('❌ You must specify a Pokémon. Example: `!add Pikachu`');
            const pokemonToAdd = formatPokemonName(args.join(' '));
            if (pokemonList.includes(pokemonToAdd)) return message.reply(`ℹ️ ${pokemonToAdd} is already on the list.`);
            pokemonList.push(pokemonToAdd);
            const { pokemonListPath } = require('./config');
            const fs = require('fs');
            fs.writeFileSync(pokemonListPath, JSON.stringify(pokemonList, null, 2));
            message.reply(`✅ ${pokemonToAdd} added. Total: ${pokemonList.length}`);
            break;
        }
        case 'remove': {
            if (!args.length) return message.reply('❌ You must specify a Pokémon. Example: `!remove Pikachu`');
            const pokemonToRemove = formatPokemonName(args.join(' '));
            const index = pokemonList.indexOf(pokemonToRemove);
            if (index === -1) return message.reply(`ℹ️ ${pokemonToRemove} is not on the list.`);
            pokemonList.splice(index, 1);
            const { pokemonListPath } = require('./config');
            const fs = require('fs');
            fs.writeFileSync(pokemonListPath, JSON.stringify(pokemonList, null, 2));
            message.reply(`✅ ${pokemonToRemove} removed. Total: ${pokemonList.length}`);
            break;
        }
        case 'catchall': {
            if (!args.length) return message.reply(`ℹ️ Current Catch-all mode: ${globalState.catchAll ? 'ON' : 'OFF'}`);
            const newValue = args[0].toLowerCase() === 'on';
            globalState.catchAll = newValue;
            config.catchAll = newValue;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            message.reply(`✅ Catch-all mode ${globalState.catchAll ? 'activated' : 'deactivated'}`);
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
                globalState.spamming = true;
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                message.reply('✅ Spam activated');
            } else if (subCommand === 'off') {
                config.spamming = false;
                globalState.spamming = false;
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                message.reply('✅ Spam stopped');
            } else {
                const channelMention = message.mentions.channels.first();
                if (!channelMention) {
                    return message.reply('❌ You must mention a valid channel. Example: `!spam #channel`');
                }
                config.spamChannel = channelMention.id;
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
                message.reply(`✅ Spam channel set to: <#${channelMention.id}>`);
            }
            break;
        }
        case 'log': {
            if (!args.length) {
                const channelInfo = config.logChannel ? `<#${config.logChannel}>` : 'Not configured';
                return message.reply(`ℹ️ Current log channel: ${channelInfo}`);
            }
            const logChannelMention = message.mentions.channels.first();
            if (!logChannelMention) {
                return message.reply('❌ You must mention a valid channel. Example: `!log #channel`');
            }
            config.logChannel = logChannelMention.id;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            message.reply(`✅ Log channel set to: <#${logChannelMention.id}>`);
            break;
        }
        case 'resume': {
            config.paused = false;
            globalState.paused = false;
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            
            // Logic to resume incenses in the log channel
            const channel = await client.channels.fetch(config.logChannel);

            if (channel) {
                await message.reply('✅ System resumed. Incenses will be resumed in the log channel.');
                console.log("[INFO] The bot has resumed. Attempting to resume incenses in the log channel.");
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
                await message.reply('✅ System resumed. **Warning:** Log channel is not configured, could not resume incense. Use `!log #channel` to configure it.');
                console.log(`[WARN] Log channel not configured. Could not resume incense.`);
            }

            break;
        }
        case 'trade': {
            if (!client) return message.reply('❌ The bot is not initialized correctly.');
            (async () => {
                const fetched = await message.channel.messages.fetch({ limit: 20 });
                const poketwoMessages = fetched.filter(m => m.author.id === config.POKETWO_ID && m.components && m.components.length > 0).first(5);
                if (!poketwoMessages.length) return message.reply('❌ No recent Pokétwo messages with buttons found.');

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
            if (!args.length) return message.reply('❌ You must specify the text to copy. Example: `!c Hello world`');
            const textToCopy = args.join(' ');
            message.channel.send(textToCopy);
            break;
        }
        case 'help': {
            const helpMsg1 = [
                "**🎮 MAIN COMMANDS**",
                "🔍 **SEARCH & CATCH**",
                "`!add <pokemon>` → Adds to list",
                "`!remove <pokemon>` → Removes from list",
                "`!catchall <on/off>` → Catches all",
                "",
                "📋 **LIST MANAGEMENT**",
                "`!list` → Shows list (25/pg)",
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
                "`!trade <button>` → Directly clicks the most recent Pokétwo button that matches the specified text. Example: `!trade Accept`",
                "`!trade <number>` → Directly clicks button N (from left to right) of the most recent Pokétwo message with buttons. Example: `!trade 1` for the first button (usually Accept), `!trade 2` for the second, etc.",
                "`!trade` → Shows the list of all available buttons in recent Pokétwo messages for you to choose one.",
                "`!confirm <number>` → Clicks the selected button from the list shown by !trade.",
                "",
                "♻ **MIRROR COMMAND**",
                "`!c <text>` → Will write whatever you type in the command",
                "",
                " **POKETWO COMMAND**",
                "`!p <command>` → Sends a command to Pokétwo by automatically mentioning it. Example: `!p pokedex` will send `@poketwo pokedex`."
            ].join('\n');

            const helpMsg2 = [
                "",
                "📌 **EXAMPLES**",
                "• `!add \"Roaring Moon\"` → Compound names",
                "• `!next 3` → Jumps to page 3",
                "• `!c @poketwo pf old` → shows the profile ",
                "• `!spam #general` → Spam in #general",
                "• `!trade Accept` → Directly clicks the most recent 'Accept' button from Pokétwo",
                "• `!trade 1` → Clicks the first button (left) of the most recent Pokétwo message",
                "• `!trade` → Shows the list of available buttons to choose from",
                "• `!confirm 1` → Clicks the first option from the list shown by !trade",
                "• `!p pokedex` → Sends `@poketwo pokedex` to the channel",
                "",
                '🔸 **Tip:** Use quotes "alolan raichu" for names with spaces',
                "🛠️ **Support:** Contact the developer  Ivantree9096"
            ].join('\n');

            message.reply(helpMsg1);
            message.reply(helpMsg2);
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