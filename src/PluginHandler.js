var ini = require('./modules/ini'),
    fs = require('fs'),
    CommandList = require('./modules/CommandList'),
    GamemodeList = require('./gamemodes/GamemodeList');

function PluginHandler(gameServer) {
    this.gameServer = gameServer;
    this.options; // Will be loaded first
    this.loadedPlugins = [];
    this.commands = new CommandList();
    this.gamemodes = new GamemodeList(this);
}

module.exports = PluginHandler;

PluginHandler.prototype.readOptions = function() {
    try {
        this.options = ini.parse(fs.readFileSync('./plugins/options.ini', 'utf-8'));
    } catch(e) {
        // File probably not available
        console.log("[Info] options.ini not found, creating one");
        fs.writeFileSync('./plugins/options.ini', "; Add the plugin names here.\n; Set the value to 0/1 to enable/disable the plugin.\n\n", 'utf-8');
    }
};

PluginHandler.prototype.loadPlugins = function() {
    var options = Object.keys(this.options);
    for (var i = 0; i < options.length; i++) {
        if (this.options[options[i]] <= 0) continue;

        try {
            var plugin = require('./plugins/' + options[i] + '/index');
        } catch (e) {
            console.log("[Warning] Could not find plugin " + options[i] + ", skipping");
            continue;
        }

        var load = new plugin(this.gameServer);
        this.loadedPlugins.push(load);
    }
};

PluginHandler.prototype.startPlugins = function() {
    for (var i = 0; i < this.loadedPlugins.length; i++) {
        this.loadedPlugins[i].start();
    }
};

PluginHandler.prototype.executeCommand = function(name, split) {
    var command = this.commands.list[name];
    if (typeof command != 'undefined') {
        try {
            command.f(this.gameServer, split);
        } catch (e) {
            console.log("[Error] Error while executing command " + name + ": " + e);
        }
    } else {
        console.log("[Console] Invalid command " + name + "! Type help for all commands.");
    }
};

PluginHandler.prototype.onHelpCommand = function() {
    for (var i in this.commands.list) {
        var a = this.commands.list[i];
        var first = a.name + " " + a.vars;
        console.log("[Help] " + first + (new Array(30 - first.length)).join(" ") + ": " + a.desc);
    }
};

// Plugins can call these functions.

PluginHandler.prototype.addCommand = function(name, func, description, variables) {
    name = name.toLowerCase();
    if (this.commands.list[name] instanceof Object) throw new Error("Plugin error: adding already existing command");
    this.commands.list[name] = {
        f: func,
        name: name,
        desc: description,
        vars: variables
    };
};

PluginHandler.prototype.addGamemode = function(modeClass) {
    var id = modeClass.ID;
    if (this.gamemodes[id] != undefined) throw new Error("Plugin error: assigning gamemode on already existing ID");
    this.gamemodes[id] = modeClass;
};

// In case plugins have incompatibility issues, this can save the day
PluginHandler.prototype.isPluginLoaded = function(name) {
    // First test - check by plugin's name
    for (var i = 0; i < this.loadedPlugins.length; i++) {
        if (this.loadedPlugins[i].name.toLowerCase() == name.toLowerCase()) return true;
    }
    // Second test - check by options' name
    for (var i in this.options) {
        if (this.options[i] >= 1 && i.toLowerCase() == name.toLowerCase()) return true;
    }
    return false;
};
