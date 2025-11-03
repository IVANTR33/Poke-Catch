// config.js
const fs = require('fs');
const path = require('path');

const configPath = path.join(__dirname, 'config.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
// Compatibilidad: si OwnerIDs no existe, crearlo desde OwnerID
if (!config.OwnerIDs && config.OwnerID) config.OwnerIDs = [config.OwnerID];

const messagesPath = path.join(__dirname, 'messages.txt');
let spamMessages = [];
try {
    spamMessages = fs.readFileSync(messagesPath, 'utf8').split('\n').filter(msg => msg.trim());
} catch (err) {
    fs.writeFileSync(messagesPath, "¡Hola! :)\n¿Cómo están?\n¡Que tengan un buen día!");
    spamMessages = ["¡Hola! :)", "¿Cómo están?", "¡Que tengan un buen día!"];
}

const pokemonListPath = path.join(__dirname, 'pokemon_list.json');
let pokemonList = [];
try {
    pokemonList = JSON.parse(fs.readFileSync(pokemonListPath, 'utf8'));
} catch (err) {
    fs.writeFileSync(pokemonListPath, '[]');
}

module.exports = {
    config,
    spamMessages,
    pokemonList,
    configPath,
    messagesPath,
    pokemonListPath
};
