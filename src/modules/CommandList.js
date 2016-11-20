// Imports
var Entity = require('../entity');

// Utils
var fillChar = function(data, char, fieldLength, rTL) {
    var result = data.toString();
    if (rTL === true) {
        for (var i = result.length; i < fieldLength; i++)
            result = char.concat(result);
    } else {
        for (var i = result.length; i < fieldLength; i++)
            result = result.concat(char);
    }
    return result;
};

function Commands() {
    this.list = {
        help: {
            f: function(gameServer, split) {
                console.log("[Help] ======================== HELP ======================");
                console.log("[Help] <x> is a required field, [x] is an optional field.");
                gameServer.pluginHandler.onHelpCommand();
                console.log("[Help] ====================================================");
            },
            name: "help",
            desc: "Shows all commands and their info",
            vars: ""
        },
        addbot: {
            f: function(gameServer, split) {
                var add = parseInt(split[1]);
                if (isNaN(add)) {
                    add = 1; // Adds 1 bot if user doesnt specify a number
                }

                for (var i = 0; i < add; i++) {
                    setTimeout(gameServer.bots.addBot.bind(gameServer.bots), i);
                }
                console.log("[Console] Added " + add + " player bots");
            },
            name: "addbot",
            desc: "Adds a number of bots",
            vars: "[n]"
        },
        kickbot: {
            f: function(gameServer, split) {
                var toRemove = parseInt(split[1]);
                if (isNaN(toRemove)) {
                    toRemove = -1; // Kick all bots if user doesnt specify a number
                }

                var removed = 0;
                var i = 0;
                while (i < gameServer.clients.length && removed != toRemove) {
                    if (typeof gameServer.clients[i].remoteAddress == 'undefined') { // if client i is a bot kick him
                        var client = gameServer.clients[i].playerTracker;
                        var len = client.cells.length;
                        for (var j = 0; j < len; j++) {
                            gameServer.removeNode(client.cells[0]);
                        }
                        client.socket.close();
                        removed++;
                    } else
                        i++;
                }
                if (toRemove == -1)
                    console.log("[Console] Kicked all bots (" + removed + ")");
                else if (toRemove == removed)
                    console.log("[Console] Kicked " + toRemove + " bots");
                else
                    console.log("[Console] Only " + removed + " bots could be kicked");
            },
            name: "kickbot",
            desc: "Kicks a number of bots",
            vars: "[n]"
        },
        /*
        TODO: Fix board and boardreset commands.
        board: {
            f: function(gameServer, split) {
                var newLB = [];
                for (var i = 1; i < split.length; i++) {
                    if (split[i]) {
                        newLB[i - 1] = split[i];
                    } else {
                        newLB[i - 1] = " ";
                    }
                }

                // Clears the update leaderboard function and replaces it with our own
                gameServer.gameMode.packetLB = 48;
                gameServer.gameMode.specByLeaderboard = false;
                gameServer.gameMode.updateLB = function(gameServer) {
                    gameServer.leaderboard = newLB;
                };
                console.log("[Console] Successfully changed leaderboard values");
            }
        },
        boardreset: {
            function(gameServer) {
                // Gets the current gamemode
                var gm = GameMode.get(gameServer.gameMode.ID);

                // Replace functions
                gameServer.gameMode.packetLB = gm.packetLB;
                gameServer.gameMode.updateLB = gm.updateLB;
                console.log("[Console] Successfully reset leaderboard");
            }
        },
        */
        change: {
            f: function(gameServer, split) {
                var key = split[1];
                var value = split[2];

                // Check if int/float
                if (value.indexOf('.') != -1) {
                    value = parseFloat(value);
                } else {
                    value = parseInt(value);
                }

                if (typeof gameServer.config[key] != 'undefined') {
                    gameServer.config[key] = value;
                    console.log("[Console] Set " + key + " to " + value);
                } else {
                    console.log("[Console] Invalid config value");
                }
            },
            name: "change",
            desc: "Temporarily changes a config value",
            vars: "<name> <value>"
        },
        clear: {
            f: function() {
                process.stdout.write("\u001b[2J\u001b[0;0H");
            },
            name: "clear",
            desc: "Clears the console.",
            vars: ""
        },
        color: {
            f: function(gameServer, split) {
                // Validation checks
                var id = parseInt(split[1]);
                if (isNaN(id)) {
                    console.log("[Console] Please specify a valid player ID!");
                    return;
                }

                var color = {
                    r: 0,
                    g: 0,
                    b: 0
                };
                color.r = Math.max(Math.min(parseInt(split[2]), 255), 0);
                color.g = Math.max(Math.min(parseInt(split[3]), 255), 0);
                color.b = Math.max(Math.min(parseInt(split[4]), 255), 0);

                // Sets color to the specified amount
                for (var i in gameServer.clients) {
                    if (gameServer.clients[i].playerTracker.pID == id) {
                        var client = gameServer.clients[i].playerTracker;
                        client.setColor(color); // Set color
                        for (var j in client.cells) {
                            client.cells[j].setColor(color);
                        }
                        break;
                    }
                }
            },
            name: "color",
            desc: "Changes color of a player.",
            vars: "<id> <r> <g> <b>"
        },
        exit: {
            f: function(gameServer, split) {
                console.log("[Console] Closing server...");
                gameServer.socketServer.close();
                process.exit(1);
            },
            name: "exit",
            desc: "Stops the server.",
            vars: ""
        },
        food: {
            f: function(gameServer, split) {
                var pos = {
                    x: parseInt(split[1]),
                    y: parseInt(split[2])
                };
                var mass = parseInt(split[3]);

                // Make sure the input values are numbers
                if (isNaN(pos.x) || isNaN(pos.y)) {
                    console.log("[Console] Invalid coordinates");
                    return;
                }

                if (isNaN(mass)) {
                    mass = gameServer.config.foodStartMass;
                }

                // Spawn
                var f = new Entity.Food(gameServer.getNextNodeId(), null, pos, mass, gameServer);
                f.setColor(gameServer.getRandomColor());
                gameServer.addNode(f);
                gameServer.currentFood++;
                console.log("[Console] Spawned 1 food cell at (" + pos.x + " , " + pos.y + ")");
            },
            name: "food",
            desc: "Spawns a food pellet in the game.",
            vars: "<x> <y> [mass]"
        },
        gamemode: {
            f: function(gameServer, split) {
                try {
                    var n = parseInt(split[1]);
                    var gm = gameServer.pluginHandler.gamemodes.retrieveGamemode(n); // If there is an invalid gamemode, the function will exit
                    gameServer.gameMode.onChange(gameServer); // Reverts the changes of the old gamemode
                    gameServer.gameMode = gm; // Apply new gamemode
                    gameServer.gameMode.onServerInit(gameServer); // Resets the server
                    console.log("[Game] Changed game mode to " + gameServer.gameMode.name);
                } catch (e) {
                    console.log("[Console] Invalid game mode selected");
                }
            },
            name: "gamemode",
            desc: "Changes the gamemode.",
            vars: "<id>"
        },
        kick: {
            f: function(gameServer, split) {
                var id = parseInt(split[1]);
                if (isNaN(id)) {
                    console.log("[Console] Please specify a valid player ID!");
                    return;
                }

                for (var i in gameServer.clients) {
                    if (gameServer.clients[i].playerTracker.pID == id) {
                        var client = gameServer.clients[i].playerTracker;
                        var len = client.cells.length;
                        for (var j = 0; j < len; j++) {
                            gameServer.removeNode(client.cells[0]);
                        }
                        client.socket.close();
                        console.log("[Console] Kicked " + client.name);
                        break;
                    }
                }
            },
            name: "kick",
            desc: "Kicks a player by player ID.",
            vars: "<id>"
        },
        kickall: {
            f: function(gameServer, split) {
                for (var i in gameServer.clients) {
                    var client = gameServer.clients[i].playerTracker;
                    var len = client.cells.length;
                    for (var j = 0; j < len; j++) {
                        gameServer.removeNode(client.cells[0]);
                    }
                    client.socket.close();
                    console.log("[Console] Kicked " + client.name);
                }
            },
            name: "kickall",
            desc: "Kicks all players and bots in the game.",
            vars: ""
        },
        kill: {
                f: function(gameServer, split) {
                var id = parseInt(split[1]);
                if (isNaN(id)) {
                    console.log("[Console] Please specify a valid player ID!");
                    return;
                }

                var count = 0;
                for (var i in gameServer.clients) {
                    if (gameServer.clients[i].playerTracker.pID == id) {
                        var client = gameServer.clients[i].playerTracker;
                        var len = client.cells.length;
                        for (var j = 0; j < len; j++) {
                            gameServer.removeNode(client.cells[0]);
                            count++;
                        }

                        console.log("[Console] Removed " + count + " cells");
                        break;
                    }
                }
            },
            name: "kill",
            desc: "Removes player's cells from a game.",
            vars: "<id>"
        },
        killall: {
            f: function(gameServer, split) {
                var count = 0;
                var len = gameServer.nodesPlayer.length;
                for (var i = 0; i < len; i++) {
                    gameServer.removeNode(gameServer.nodesPlayer[0]);
                    count++;
                }
                console.log("[Console] Removed " + count + " cells");
            },
            name: "killall",
            desc: "Removes all players from the game.",
            vars: ""
        },
        map: {
            f: function(gameServer, split) {
                var id = parseInt(split[1]);
                if (isNaN(id)) {
                    console.log("[Console] Please specify a valid player ID!");
                    return;
                }

                for (var i in gameServer.clients) {
                    if (gameServer.clients[i].playerTracker.pID == id) {
                        var client = gameServer.clients[i].playerTracker;
                        if (!client) return;
                        console.log("Bot brain\nInput neurons: " + client.inputNeurons);
                        console.log("Hidden neurons: " + client.hiddenNeurons);
                        console.log("Output neurons: " + client.outputNeurons);
                        console.log("Hidden neuron triggering value: " + client.hiddenNeuronTriggering);
                        console.log("\nOutput neuron triggering value: " + client.hiddenNeuronTriggering);

                        return;
                    }
                }
                console.log("[Console] Could not find bot with ID + " + id + "!");
            },
            name: "map",
            desc: "Prints out a bot's neural network.",
            vars: "<id>"
        },
        mass: {
            f: function(gameServer, split) {
                // Validation checks
                var id = parseInt(split[1]);
                if (isNaN(id)) {
                    console.log("[Console] Please specify a valid player ID!");
                    return;
                }

                var amount = Math.max(parseInt(split[2]), 9);
                if (isNaN(amount)) {
                    console.log("[Console] Please specify a valid number");
                    return;
                }

                // Sets mass to the specified amount
                for (var i in gameServer.clients) {
                    if (gameServer.clients[i].playerTracker.pID == id) {
                        var client = gameServer.clients[i].playerTracker;
                        for (var j in client.cells) {
                            client.cells[j].mass = amount;
                        }

                        console.log("[Console] Set mass of " + client.name + " to " + amount);
                        break;
                    }
                }
            },
            name: "mass",
            desc: "Sets player's cells' mass to specified number.",
            vars: "<id> <mass>"
        },
        merge: {
            f: function(gameServer, split) {
                // Validation checks
                var id = parseInt(split[1]);
                var set = split[2];
                if (isNaN(id)) {
                    console.log("[Console] Please specify a valid player ID!");
                    return;
                }

                // Find client with same ID as player entered
                var client;
                for (var i = 0; i < gameServer.clients.length; i++) {
                    if (id == gameServer.clients[i].playerTracker.pID) {
                        client = gameServer.clients[i].playerTracker;
                        break;
                    }
                }

                if (!client) {
                    console.log("[Console] Client is nonexistent!");
                    return;
                }

                if (client.cells.length == 1) {
                    console.log("[Console] Client already has one cell!");
                    return;
                }

                // Set client's merge override
                var state;
                if (set == "true" || set == "yes" || set == "1") {
                    client.mergeOverride = true;
                    state = true;
                } else if (set == "false" || set == "no" || set == "0") {
                    client.mergeOverride = false;
                    state = false;
                } else {
                    if (client.mergeOverride) {
                        client.mergeOverride = false;
                    } else {
                        client.mergeOverride = true;
                    }

                    state = client.mergeOverride;
                }

                // Log
                if (state) console.log("[Console] Player " + id + " is now force merging");
                else console.log("[Console] Player " + id + " isn't force merging anymore");
            },
            name: "merge",
            desc: "Toggles or sets force merging on player.",
            vars: "<id> [state]"
        },
        name: {
            f: function(gameServer, split) {
                // Validation checks
                var id = parseInt(split[1]);
                if (isNaN(id)) {
                    console.log("[Console] Please specify a valid player ID!");
                    return;
                }

                var name = split.slice(2, split.length).join(' ');
                if (name == undefined) {
                    console.log("[Console] Please type a valid name");
                    return;
                }

                // Change name
                for (var i = 0; i < gameServer.clients.length; i++) {
                    var client = gameServer.clients[i].playerTracker;

                    if (client.pID == id) {
                        console.log("[Console] Changing " + client.name + " to " + name);
                        client.name = name;
                        return;
                    }
                }

                // Error
                console.log("[Console] Player " + id + " was not found");
            },
            name: "name",
            desc: "Changes the name of a player.",
            vars: "<id> <name>"
        },
        playerlist: {
            f: function(gameServer, split) {
                console.log("[Console] Showing " + gameServer.clients.length + " players: ");
                console.log(" ID         | IP              | " + fillChar('NICK', ' ', gameServer.config.playerMaxNickLength) + " | CELLS | SCORE  | POSITION    "); // Fill space
                console.log(fillChar('', '-', ' ID         | IP              |  | CELLS | SCORE  | POSITION    '.length + gameServer.config.playerMaxNickLength));
                for (var i = 0; i < gameServer.clients.length; i++) {
                    var client = gameServer.clients[i].playerTracker;

                    // ID with 3 digits length
                    var id = fillChar((client.pID), ' ', 10, true);

                    // Get ip (15 digits length)
                    var ip = "Bot";
                    if (typeof gameServer.clients[i].remoteAddress != 'undefined') {
                        ip = gameServer.clients[i].remoteAddress;
                    }
                    ip = fillChar(ip, ' ', 15);

                    // Get name and data
                    var nick = '',
                        cells = '',
                        score = '',
                        position = '',
                        data = '';
                    if (client.spectate) {
                        try {
                            nick = gameServer.largestClient.name;
                        } catch (e) {
                            // Specating in free-roam mode
                            nick = "in free-roam";
                        }
                        nick = (nick == "") ? "An unnamed cell" : nick;
                        data = fillChar("Spectating " + nick, '-', ' | CELLS | SCORE  | POSITION    '.length + gameServer.config.playerMaxNickLength, true);
                        console.log(" " + id + " | " + ip + " | " + data);
                    } else if (client.cells.length > 0) {
                        nick = fillChar((client.name == "") ? "An unnamed cell" : client.name, ' ', gameServer.config.playerMaxNickLength);
                        cells = fillChar(client.cells.length, ' ', 5, true);
                        score = fillChar(client.getScore(true), ' ', 6, true);
                        position = fillChar(client.centerPos.x >> 0, ' ', 5, true) + ', ' + fillChar(client.centerPos.y >> 0, ' ', 5, true);
                        console.log(" " + id + " | " + ip + " | " + nick + " | " + cells + " | " + score + " | " + position);
                    } else {
                        // No cells = dead player or in-menu
                        data = fillChar('Dead or not playing', '-', ' | CELLS | SCORE  | POSITION    '.length + gameServer.config.playerMaxNickLength, true);
                        console.log(" " + id + " | " + ip + " | " + data);
                    }
                }
            },
            name: "playerlist",
            desc: "Shows info about players.",
            vars: ""
        },
        pause: {
            f: function(gameServer, split) {
                gameServer.run = !gameServer.run; // Switches the pause state
                var s = gameServer.run ? "Unpaused" : "Paused";
                console.log("[Console] " + s + " the game.");
            },
            name: "pause",
            desc: "Toggles pause of the game.",
            vars: ""
        },
        reload: {
            f: function(gameServer) {
                gameServer.loadConfig();
                console.log("[Console] Reloaded the config file successfully");
            },
            name: "reload",
            desc: "Reloads the configuration file.",
            vars: ""
        },
        resetantiteam: {
            f: function(gameServer, split) {
                // Validation checks
                var id = parseInt(split[1]);
                if (isNaN(id)) {
                    console.log("[Console] Please specify a valid player ID!");
                    return;
                }

                for (var i in gameServer.clients) {
                    var client = gameServer.clients[i];
                    if (!client) continue; // Nonexistent

                    if (client.playerTracker.pID == id) {
                        // Found client
                        client.playerTracker.massGainMult = 0;
                        client.playerTracker.massLossMult = 0;
                        console.log("[Console] Successfully reset client's anti-team effect");
                        return;
                    }
                }
            },
            name: "resetantiteam",
            desc: "Resets anti-teaming effect on a player.",
            vars: "<id>"
        },
        status: {
            f: function(gameServer, split) {
                // Get amount of humans/bots
                var humans = 0,
                    bots = 0;
                for (var i = 0; i < gameServer.clients.length; i++) {
                    if ('_socket' in gameServer.clients[i]) {
                        humans++;
                    } else {
                        bots++;
                    }
                }

                console.log("[Console] Connected players: " + gameServer.clients.length + "/" + gameServer.config.serverMaxConnections);
                console.log("[Console] Players: " + humans + " - Bots: " + bots);
                console.log("[Console] Server has been running for " + Math.floor(process.uptime() / 60) + " minutes");
                console.log("[Console] Current memory usage: " + Math.round(process.memoryUsage().heapUsed / 1048576 * 10) * 0.1 + "/" + Math.round(process.memoryUsage().heapTotal / 1048576 * 10) * 0.1 + " mb");
                console.log("[Console] Current game mode: " + gameServer.gameMode.name);
                console.log("[Console] Node amount: " + gameServer.nodes.length + ", quadtree node amount: " + gameServer.quadTree.getNodes().length + ", branch count: " + gameServer.quadTree.getBranches());
                console.log("[Console] Running " + (gameServer.internalClock - gameServer.lastUpdate) + " ticks behind");
            },
            name: "status",
            desc: "Gives status about the server.",
            vars: ""
        },
        delay: {
            f: function(gameServer, split) {
                gameServer.internalClock += 2000;
            },
            name: "delay",
            desc: "Lags the game.",
            vars: ""
        },
        debug: {
            f: function(gameServer, split) {
                console.log(gameServer.updateLog);
                console.log(gameServer.nodes.length + " nodes, " + gameServer.quadTree.getNodes().length + " in quad");
            },
            name: "debug",
            desc: "Gives debug information.",
            vars: ""
        },
        tp: {
            f: function(gameServer, split) {
                var id = parseInt(split[1]);
                if (isNaN(id)) {
                    console.log("[Console] Please specify a valid player ID!");
                    return;
                }

                // Make sure the input values are numbers
                var pos = {
                    x: parseInt(split[2]),
                    y: parseInt(split[3])
                };
                if (isNaN(pos.x) || isNaN(pos.y)) {
                    console.log("[Console] Invalid coordinates");
                    return;
                }

                // Spawn
                for (var i in gameServer.clients) {
                    if (gameServer.clients[i].playerTracker.pID == id) {
                        var client = gameServer.clients[i].playerTracker;
                        for (var j in client.cells) {
                            client.cells[j].position.x = pos.x;
                            client.cells[j].position.y = pos.y;
                        }

                        console.log("[Console] Teleported " + client.name + " to (" + pos.x + " , " + pos.y + ")");
                        break;
                    }
                }
            },
            name: "tp",
            desc: "Teleports a player to specified coordinates",
            vars: "<id> <x> <y>",
        },
        virus: {
            f: function(gameServer, split) {
                var pos = {
                    x: parseInt(split[1]),
                    y: parseInt(split[2])
                };
                var mass = parseInt(split[3]);

                // Make sure the input values are numbers
                if (isNaN(pos.x) || isNaN(pos.y)) {
                    console.log("[Console] Invalid coordinates");
                    return;
                }
                if (isNaN(mass)) {
                    mass = gameServer.config.virusStartMass;
                }

                // Spawn
                var v = new Entity.Virus(gameServer.getNextNodeId(), null, pos, mass);
                gameServer.addNode(v);
                console.log("[Console] Spawned 1 virus at (" + pos.x + " , " + pos.y + ")");
            },
            name: "virus",
            desc: "Spawns a virus at given coordinates.",
            vars: "<x> <y> [mass]"
        },
        //Aliases
        st: {
            f: function (gameServer, split) {
                gameServer.pluginHandler.executeCommand("status", split);
            },
            name: "st",
            desc: "Alias for status.",
            vars: ""
        },
        pl: {
            f: function (gameServer, split) {
                gameServer.pluginHandler.executeCommand("playerlist", split);
            },
            name: "pl",
            desc: "Alias for playerlist.",
            vars: ""
        },
    };
}

module.exports = Commands;
