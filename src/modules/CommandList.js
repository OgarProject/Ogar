// Imports
var GameMode = require('../gamemodes');
var Entity = require('../entity');
var ini = require('./ini.js');

function Commands() {
    this.list = {}; // Empty
}

module.exports = Commands;

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

// Commands

Commands.list = {
    help: function(gameServer, split) {
        console.log("[Console] ======================== HELP ======================");
        console.log("[Console] addbot [number]              : add bot to the server");
        console.log("[Console] kickbot [number]             : kick a number of bots");
        console.log("[Console] ban [PlayerID | IP]          : bans a(n) (player's) IP");
        console.log("[Console] banlist                      : get list of banned IPs.");
        console.log("[Console] board [string] [string] ...  : set scoreboard text");
        console.log("[Console] boardreset                   : reset scoreboard text");
        console.log("[Console] change [setting] [value]     : change specified settings");
        console.log("[Console] clear                        : clear console output");
        console.log("[Console] color [PlayerID] [R] [G] [B] : set cell(s) color by client ID");
        console.log("[Console] exit                         : stop the server");
        console.log("[Console] food [X] [Y] [mass]          : spawn food at specified Location");
        console.log("[Console] gamemode [id]                : change server gamemode");
        console.log("[Console] kick [PlayerID]              : kick player or bot by client ID");
        console.log("[Console] kickall                      : kick all players and bots");
        console.log("[Console] kill [PlayerID]              : kill cell(s) by client ID");
        console.log("[Console] killall                      : kill everyone");
        console.log("[Console] mass [PlayerID] [mass]       : set cell(s) mass by client ID");
        console.log("[Console] merge [PlayerID]             : merge all client's cells once");
        console.log("[Console] name [PlayerID] [name]       : change cell(s) name by client ID");
        console.log("[Console] playerlist                   : get list of players and bots");
        console.log("[Console] pause                        : pause game , freeze all cells");
        console.log("[Console] reload                       : reload config");
        console.log("[Console] status                       : get server status");
        console.log("[Console] tp [PlayerID] [X] [Y]        : teleport player to specified location");
        console.log("[Console] unban [IP]                   : unban an IP");
        console.log("[Console] virus [X] [Y] [mass]         : spawn virus at a specified Location");
        console.log("[Console] pl                           : alias for playerlist");
        console.log("[Console] st                           : alias for status");
        console.log("[Console] ====================================================");
    },
    addbot: function(gameServer, split) {
        var add = parseInt(split[1]);
        if (isNaN(add)) {
            add = 1; // Adds 1 bot if user doesnt specify a number
        }

        for (var i = 0; i < add; i++) {
            gameServer.bots.addBot();
        }
        console.log("[Console] Added " + add + " player bots");
    },
    ban: function (gameServer, split) {
        // Error message
        var logInvalid = "[Console] Please specify a valid player ID or IP address!";
        
        if (split[1] == null) {
            // If no input is given; added to avoid error
            console.log(logInvalid);
            return;
        }

        if (split[1].indexOf(".") >= 0) {
            // If input is an IP address
            var ip = split[1];
            var ipParts = ip.split(".");
            
            // Check for invalid decimal numbers of the IP address
            for (var i in ipParts) {
                // If not numerical or if it's not between 0 and 255
                // TODO: Catch string "e" as it means "10^".
                if (isNaN(ipParts[i]) || ipParts[i] < 0 || ipParts[i] >= 256) {
                    console.log(logInvalid);
                    return;
                }
            }
            
            if (ipParts.length != 4) {
                // an IP without 3 decimals
                console.log(logInvalid);
                return;
            }
            
            gameServer.banIp(ip);
            return;
        }
        // if input is a Player ID
        var id = parseInt(split[1]);
        if (isNaN(id)) {
            // If not numerical
            console.log(logInvalid);
            return;
        }
        var ip = null;
        for (var i in gameServer.clients) {
            var client = gameServer.clients[i];
            if (client == null || !client.isConnected)
                continue;
            if (client.playerTracker.pID == id) {
                ip = client._socket.remoteAddress;
                break;
            }
        }
        if (ip)
            gameServer.banIp(ip);
        else
            console.log("[Console] Player ID " + id + " not found!");
    },
    banlist: function(gameServer, split) {
        console.log("[Console] Showing " + gameServer.ipBanList.length + " banned IPs: ");
        console.log(" IP              | IP ");
        console.log("-----------------------------------");
        for (var i = 0; i < gameServer.ipBanList.length; i += 2) {
            console.log(" " + fillChar(gameServer.ipBanList[i], " ", 15) + " | " 
                    + (gameServer.ipBanList.length === i+1 ? "" : gameServer.ipBanList[i+1] )
            );
        }
    },
    kickbot: function(gameServer, split) {
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
    board: function(gameServer, split) {
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
            gameServer.leaderboardType = 48;
        };
        console.log("[Console] Successfully changed leaderboard values");
    },
    boardreset: function(gameServer) {
        // Gets the current gamemode
        var gm = GameMode.get(gameServer.gameMode.ID);

        // Replace functions
        gameServer.gameMode.packetLB = gm.packetLB;
        gameServer.gameMode.updateLB = gm.updateLB;
        console.log("[Console] Successfully reset leaderboard");
    },
    change: function(gameServer, split) {
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
    clear: function() {
        process.stdout.write("\u001b[2J\u001b[0;0H");
    },
    color: function(gameServer, split) {
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
    exit: function(gameServer, split) {
        console.log("[Console] Closing server...");
        gameServer.socketServer.close();
        process.exit(1);
    },
    food: function(gameServer, split) {
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
    gamemode: function(gameServer, split) {
        try {
            var n = parseInt(split[1]);
            var gm = GameMode.get(n); // If there is an invalid gamemode, the function will exit
            gameServer.gameMode.onChange(gameServer); // Reverts the changes of the old gamemode
            gameServer.gameMode = gm; // Apply new gamemode
            gameServer.gameMode.onServerInit(gameServer); // Resets the server
            console.log("[Game] Changed game mode to " + gameServer.gameMode.name);
        } catch (e) {
            console.log("[Console] Invalid game mode selected");
        }
    },
    kick: function(gameServer, split) {
        var id = parseInt(split[1]);
        if (isNaN(id)) {
            console.log("[Console] Please specify a valid player ID!");
            return;
        }
        gameServer.kickId(id);
    },
    kickall: function (gameServer, split) {
        gameServer.kickId(0);
    },
    kill: function(gameServer, split) {
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
    killall: function(gameServer, split) {
        var count = 0;
        var len = gameServer.nodesPlayer.length;
        for (var i = 0; i < len; i++) {
            gameServer.removeNode(gameServer.nodesPlayer[0]);
            count++;
        }
        console.log("[Console] Removed " + count + " cells");
    },
    mass: function(gameServer, split) {
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
                    client.cells[j].setMass(amount);
                }

                console.log("[Console] Set mass of " + client.name + " to " + amount);
                break;
            }
        }
    },
    merge: function(gameServer, split) {
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
        if (set == "true") {
            client.mergeOverride = true;
            client.mergeOverrideDuration = 100;
            state = true;
        } else if (set == "false") {
            client.mergeOverride = false;
            client.mergeOverrideDuration = 0;
            state = false;
        } else {
            if (client.mergeOverride) {
                client.mergeOverride = false;
                client.mergeOverrideDuration = 0;
            } else {
                client.mergeOverride = true;
                client.mergeOverrideDuration = 100;
            }

            state = client.mergeOverride;
        }

        // Log
        if (state) console.log("[Console] Player " + id + " is now force merging");
        else console.log("[Console] Player " + id + " isn't force merging anymore");
    },
    name: function(gameServer, split) {
        // Validation checks
        var id = parseInt(split[1]);
        if (isNaN(id)) {
            console.log("[Console] Please specify a valid player ID!");
            return;
        }

        var name = split.slice(2, split.length).join(' ');
        if (typeof name == 'undefined') {
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
    unban: function(gameServer, split) {
        if (split.length < 2 || split[1] == null || split[1].trim().length < 1) {
            console.log("[Console] Please specify a valid IP!");
            return;
        }
        gameServer.unbanIp(split[1].trim());
    },
    playerlist: function(gameServer, split) {
        console.log("[Console] Showing " + gameServer.clients.length + " players: ");
        console.log(" ID     | IP              | P | " + fillChar('NICK', ' ', gameServer.config.playerMaxNickLength) + " | CELLS | SCORE  | POSITION    "); // Fill space
        console.log(fillChar('', '-', ' ID     | IP              |   |  | CELLS | SCORE  | POSITION    '.length + gameServer.config.playerMaxNickLength));
        for (var i = 0; i < gameServer.clients.length; i++) {
            var socket = gameServer.clients[i];
            var client = socket.playerTracker;

            // ID with 3 digits length
            var id = fillChar((client.pID), ' ', 6, true);

            // Get ip (15 digits length)
            var ip = "[BOT]";
            if (socket.isConnected != null) {
                ip = socket.remoteAddress;
            }
            ip = fillChar(ip, ' ', 15);
            var protocol = gameServer.clients[i].packetHandler.protocol;
            if (protocol == null)
                protocol = "?"
            // Get name and data
            var nick = '',
                cells = '',
                score = '',
                position = '',
                data = '';
            if (socket.closeReason != null) {
                // Disconnected
                var reason = "[DISCONNECTED] ";
                if (socket.closeReason.code)
                    reason += "[" + socket.closeReason.code + "] ";
                if (socket.closeReason.message)
                    reason += socket.closeReason.message;
                console.log(" " + id + " | " + ip + " | " + protocol + " | " + reason);
            } else if (!socket.packetHandler.protocol && socket.isConnected) {
                console.log(" " + id + " | " + ip + " | " + protocol + " | " + "[CONNECTING]");
            }else if (client.spectate) {
                try {
                    nick = gameServer.largestClient.getFriendlyName();
                } catch (e) {
                    // Specating in free-roam mode
                    nick = "in free-roam";
                }
                data = fillChar("SPECTATING: " + nick, '-', ' | CELLS | SCORE  | POSITION    '.length + gameServer.config.playerMaxNickLength, true);
                console.log(" " + id + " | " + ip + " | " + protocol + " | " + data);
            } else if (client.cells.length > 0) {
                nick = fillChar(client.getFriendlyName(), ' ', gameServer.config.playerMaxNickLength);
                cells = fillChar(client.cells.length, ' ', 5, true);
                score = fillChar(client.getScore() >> 0, ' ', 6, true);
                position = fillChar(client.centerPos.x >> 0, ' ', 5, true) + ', ' + fillChar(client.centerPos.y >> 0, ' ', 5, true);
                console.log(" " + id + " | " + ip + " | " + protocol + " | " + nick + " | " + cells + " | " + score + " | " + position);
            } else {
                // No cells = dead player or in-menu
                data = fillChar('DEAD OR NOT PLAYING', '-', ' | CELLS | SCORE  | POSITION    '.length + gameServer.config.playerMaxNickLength, true);
                console.log(" " + id + " | " + ip + " | " + protocol + " | " + data);
            }
        }
    },
    pause: function(gameServer, split) {
        gameServer.run = !gameServer.run; // Switches the pause state
        var s = gameServer.run ? "Unpaused" : "Paused";
        console.log("[Console] " + s + " the game.");
    },
    reload: function(gameServer) {
        gameServer.loadConfig();
        gameServer.loadIpBanList();
        console.log("[Console] Reloaded the config file successfully");
    },
    status: function(gameServer, split) {
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
        console.log("[Console] Server has been running for " + Math.floor(process.uptime()/60) + " minutes");
        console.log("[Console] Current memory usage: " + Math.round(process.memoryUsage().heapUsed / 1048576 * 10)/10 + "/" + Math.round(process.memoryUsage().heapTotal / 1048576 * 10)/10 + " mb");
        console.log("[Console] Current game mode: " + gameServer.gameMode.name);
        console.log("[Console] Current update time: " + gameServer.updateTimeAvg.toFixed(3) + " [ms]  (" + ini.getLagMessage(gameServer.updateTimeAvg) + ")");
    },
    tp: function(gameServer, split) {
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
                    client.cells[j].setPosition(pos.x, pos.y);
                    gameServer.updateNodeQuad(client.cells[j]);
                }

                console.log("[Console] Teleported " + client.name + " to (" + pos.x + " , " + pos.y + ")");
                break;
            }
        }
    },
    virus: function(gameServer, split) {
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
    //Aliases
    st: function (gameServer, split) {
        Commands.list.status(gameServer, split);
    },
    pl: function(gameServer, split){
        Commands.list.playerlist(gameServer, split);
    }
};
