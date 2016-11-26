// Library imports
var WebSocket = require('ws');
var http = require('http');
var fs = require('fs');
var ini = require('./modules/ini.js');

// Project imports
var Packet = require('./packet');
var PlayerTracker = require('./PlayerTracker');
var PacketHandler = require('./PacketHandler');
var Entity = require('./entity');
var BotLoader = require('./ai/BotLoader');
var Logger = require('./modules/log');
var CollisionHandler = require('./CollisionHandler');
var NodeHandler = require('./NodeHandler');
var PlayerHandler = require('./PlayerHandler');
var Vector = require('./modules/Vector');
var Rectangle = require('./modules/Rectangle');
var QuadTree = require('./modules/QuadTree');
var PluginHandler = require('./PluginHandler');

function getTime(a) {
    return a[0] * 1000 + a[1] / 1000000;
}

// GameServer implementation
function GameServer() {
    // Startup
    this.run = true;

    this.lastPlayerId = 1;
    this.clients = [];

    // Handlers
    this.collisionHandler = new CollisionHandler(this);
    this.nodeHandler = new NodeHandler(this, this.collisionHandler);
    this.playerHandler = new PlayerHandler(this);
    this.pluginHandler = new PluginHandler(this);

    // Nodes
    this.lastNodeId = 1;
    this.nodes = [];
    this.nonPlayerNodes = []; // All nodes except player nodes
    this.nodesVirus = []; // Virus nodes
    this.nodesFood = []; // Food nodes (only that are spawned by server)
    this.nodesEjected = []; // Ejected mass nodes
    this.nodesPlayer = []; // Nodes controlled by players

    this.leaderboard = [];
    this.largestClient; // Required for spectators

    this.updateLoopBind = null;
    this.updateProcessingBind = null;

    this.bots = new BotLoader(this);
    this.log = new Logger();

    // Config
    this.config = { // Border - Right: X increases, Down: Y increases (as of 2015-05-20)
        serverMaxConnections: 64, // Maximum amount of connections to the server.
        serverPort: 443, // Server port
        serverGamemode: 0, // Gamemode, 0 = FFA, 1 = Teams
        serverBots: 0, // Amount of player bots to spawn
        serverViewBaseX: 1024, // Base view distance of players. Warning: high values may cause lag
        serverViewBaseY: 592,
        serverStatsPort: 88, // Port for stats server. Having a negative number will disable the stats server.
        serverStatsUpdate: 60, // Amount of seconds per update for the server stats
        serverLogLevel: 1, // Logging level of the server. 0 = No logs, 1 = Logs the console, 2 = Logs console and ip connections
        serverTeamingAllowed: 1, // Toggles anti-teaming. 0 = Anti-team enabled, 1 = Anti-team disabled
        serverMaxLB: 10, //	Controls the maximum players displayed on the leaderboard.
        serverDiscardForeignClients: 0, // Discards connections from foreign domains. Only agar.io is accepted. Default is 1.
        serverRestartInterval: 0, // serverRestartInterval: In minutes, full server restarting interval. Set to 0 or below to disable. Default is 0.
        scrambleCoords: 1, // Toggles scrambling of coordinates. 0 = No scrambling, 1 = scrambling. Default is 1.
        scrambleMinimaps: 1, // Toggles scrambling of borders to render maps unusable. 0 = No scrambling, 1 = scrambling. Default is 1.rray
        scrambleIDs: 1,
        scrambleColors: 0,
        borderLeft: 0, // Left border of map (Vanilla value: 0)
        borderRight: 6000, // Right border of map (Vanilla value: 14142.135623730952)
        borderTop: 0, // Top border of map (Vanilla value: 0)
        borderBottom: 6000, // Bottom border of map (Vanilla value: 14142.135623730952)
        spawnInterval: 20, // The interval between each food cell spawn in ticks (1 tick = 50 ms)
        foodSpawnAmount: 10, // The amount of food to spawn per interval
        foodStartAmount: 100, // The starting amount of food in the map
        foodMaxAmount: 500, // Maximum food cells on the map
        foodMass: 1, // Starting food size (In mass)
        foodMassGrow: 1, // Enable food mass grow ?
        foodMassGrowPossibility: 50, // Chance for a food to has the ability to be self growing
        foodMassLimit: 5, // Maximum mass for a food can grow
        foodMassTimeout: 120, // The amount of interval for a food to grow its mass (in seconds)
        virusMinAmount: 10, // Minimum amount of viruses on the map.
        virusMaxAmount: 50, // Maximum amount of viruses on the map. If this amount is reached, then ejected cells will pass through viruses.
        virusStartMass: 100, // Starting virus size (In mass)
        virusFeedAmount: 7, // Amount of times you need to feed a virus to shoot it
        ejectMass: 13, // Mass of ejected cells
        ejectMassCooldown: 100, // Time until a player can eject mass again
        ejectMassLoss: 15, // Mass lost when ejecting cells
        ejectSpeed: 100, // Base speed of ejected cells
        ejectSpawnPlayer: 50, // Chance for a player to spawn from ejected mass
        playerStartMass: 10, // Starting mass of the player cell.
        playerBotGrowEnabled: 1, // If 0, eating a cell with less than 17 mass while cell has over 625 wont gain any mass
        playerMaxMass: 22500, // Maximum mass a player can have
        playerMinMassEject: 32, // Mass required to eject a cell
        playerMinMassSplit: 36, // Mass required to split
        playerMaxCells: 16, // Max cells the player is allowed to have
        playerRecombineTime: 30, // Base amount of seconds before a cell is allowed to recombine
        playerMassAbsorbed: 1.0, // Fraction of player cell's mass gained upon eating
        playerMassDecayRate: .002, // Amount of mass lost per second
        playerMinMassDecay: 9, // Minimum mass for decay to occur
        playerMaxNickLength: 15, // Maximum nick length
        playerSpeed: 30, // Player base speed
        playerDisconnectTime: 60, // The amount of seconds it takes for a player cell to be removed after disconnection (If set to -1, cells are never removed)
        tourneyMaxPlayers: 12, // Maximum amount of participants for tournament style game modes
        tourneyPrepTime: 10, // Amount of ticks to wait after all players are ready (1 tick = 1000 ms)
        tourneyEndTime: 30, // Amount of ticks to wait after a player wins (1 tick = 1000 ms)
        tourneyTimeLimit: 20, // Time limit of the game, in minutes.
        tourneyAutoFill: 0, // If set to a value higher than 0, the tournament match will automatically fill up with bots after this amount of seconds
        tourneyAutoFillPlayers: 1, // The timer for filling the server with bots will not count down unless there is this amount of real players
    };
    // Parse config
    this.loadConfig();

    // Load options
    this.pluginHandler.readOptions();

    // Start plugins
    this.pluginHandler.loadPlugins();
    this.pluginHandler.startPlugins();
    console.log("[Game] Loaded " + this.pluginHandler.loadedPlugins.length + " plugin(s)");

    // Gamemodes
    this.gameMode = this.pluginHandler.gamemodes.retrieveGamemode(this.config.serverGamemode);
}

module.exports = GameServer;

GameServer.prototype.start = function() {
    // Logging
    this.log.setup(this);

    // Gamemode configurations
    this.gameMode.onServerInit(this);

    // Create quadtree
    this.quadTree = new QuadTree(null, this.rangeBorders(), 128, 12);

    // Start the server
    this.socketServer = new WebSocket.Server({
        port: this.config.serverPort,
        perMessageDeflate: false
    }, function() {
        // Spawn starting food
        this.nodeHandler.addFood(this.config.foodStartAmount);

        // Setup ticking
        this.time = new Date();
        this.startTime = this.time;
        this.internalClock = 0;
        this.lastUpdate = -40;
        this.tickLB = 0; // 40 ms ticks, 4 - update leaderboard
        this.updateLog = { };

        // Start loop
        this.updateLoopBind = this.updateLoop.bind(this);
        this.updateProcessingBind = this.update.bind(this);
        this.updateLoop();

        // Queue restart
        if (this.config.serverRestartInterval > 0) {
            console.log("[Game] Restart scheduled for " + this.config.serverRestartInterval + " minutes");
            this.restartHandle(this.config.serverRestartInterval * 60000);
        }

        // Done
        console.log("[Game] Listening on port " + this.config.serverPort);
        console.log("[Game] Current game mode is " + this.gameMode.name);

        // Add starting bots
        if (this.config.serverBots > 0) {
            for (var i = 0; i < this.config.serverBots; i++) {
                this.bots.addBot();
            }
            console.log("[Game] Loaded " + this.config.serverBots + " player bots");
        }

    }.bind(this));

    this.socketServer.on('connection', connectionEstablished.bind(this));

    // Properly handle errors because some people are too lazy to read the readme
    this.socketServer.on('error', function err(e) {
        switch (e.code) {
            case "EADDRINUSE":
                console.log("[Error] Server could not bind to port! Please close out of Skype or change 'serverPort' in gameserver.ini to a different number.");
                break;
            case "EACCES":
                console.log("[Error] Please make sure you are running Ogar with root privileges.");
                break;
            default:
                console.log("[Error] Unhandled error code: " + e.code);
                break;
        }
        process.exit(1); // Exits the program
    });

    function connectionEstablished(ws) {
        if (this.clients.length >= this.config.serverMaxConnections) { // Server full
            ws.close();
            return;
        }

        // ----- Client authenticity check code -----
        // !!!!! WARNING !!!!!
        // THE BELOW SECTION OF CODE CHECKS TO ENSURE THAT CONNECTIONS ARE COMING
        // FROM THE OFFICIAL AGAR.IO CLIENT. IF YOU REMOVE OR MODIFY THE BELOW
        // SECTION OF CODE TO ALLOW CONNECTIONS FROM A CLIENT ON A DIFFERENT DOMAIN,
        // YOU MAY BE COMMITTING COPYRIGHT INFRINGEMENT AND LEGAL ACTION MAY BE TAKEN
        // AGAINST YOU. THIS SECTION OF CODE WAS ADDED ON JULY 9, 2015 AT THE REQUEST
        // OF THE AGAR.IO DEVELOPERS.
        var origin = ws.upgradeReq.headers.origin;
        if ((origin != 'http://agar.io' &&
            origin != 'https://agar.io' &&
            origin != 'http://localhost' &&
            origin != 'https://localhost' &&
            origin != 'http://127.0.0.1' &&
            origin != 'https://127.0.0.1') && this.config.serverDiscardForeignClients >= 1) {

            ws.close();
            return;
        }
        // -----/Client authenticity check code -----

        function close(error) {
            // Log disconnections
            this.server.log.onDisconnect(this.socket.remoteAddress);

            var client = this.socket.playerTracker;
            var len = this.socket.playerTracker.cells.length;
            for (var i = 0; i < len; i++) {
                var cell = this.socket.playerTracker.cells[i];
                if (!cell) continue;

                cell.move = function() { return; }; // Clear function so that the cell cant move
                //this.server.removeNode(cell);
            }

            client.disconnect = this.server.config.playerDisconnectTime * 25;
            this.socket.sendPacket = function() { return; }; // Clear function so no packets are sent
        }

        ws.remoteAddress = ws._socket.remoteAddress;
        ws.remotePort = ws._socket.remotePort;
        this.log.onConnect(ws.remoteAddress); // Log connections

        ws.playerTracker = new PlayerTracker(this, ws);
        ws.packetHandler = new PacketHandler(this, ws);
        ws.on('message', ws.packetHandler.handleMessage.bind(ws.packetHandler));

        var bindObject = {
            server: this,
            socket: ws
        };
        ws.on('error', close.bind(bindObject));
        ws.on('close', close.bind(bindObject));
        this.clients.push(ws);
    }

    this.startStatsServer(this.config.serverStatsPort);
};

GameServer.prototype.borders = function() {
    return {
        left: this.config.borderLeft,
        right: this.config.borderRight,
        top: this.config.borderTop,
        bottom: this.config.borderBottom
    };
};

GameServer.prototype.rangeBorders = function() {
    var w = this.config.borderRight - this.config.borderLeft,
        h = this.config.borderBottom - this.config.borderTop;
    return new Rectangle(
        this.config.borderLeft + w / 2,
        this.config.borderTop + w / 2,
        w / 2,
        h / 2
    );
};

GameServer.prototype.getMode = function() {
    return this.gameMode;
};

GameServer.prototype.getNextNodeId = function() {
    // Resets integer
    if (this.lastNodeId > 2147483647) {
        this.lastNodeId = 1;
    }
    return this.lastNodeId++;
};

GameServer.prototype.getNewPlayerID = function() {
    // Resets integer
    if (this.lastPlayerId > 2147483647) {
        this.lastPlayerId = 1;
    }
    return this.lastPlayerId++;
};

GameServer.prototype.getRandomColor = function() {
    var colorRGB = [0xFF, 0x07, (Math.random() * 256) >> 0];
    colorRGB.sort(function() {
        return 0.5 - Math.random();
    });
    return {
        r: colorRGB[0],
        g: colorRGB[1],
        b: colorRGB[2]
    };
};

GameServer.prototype.addNode = function(node) {
    this.nodes.push(node);
    if (node.cellType != 0 && node.cellType != 1) this.nonPlayerNodes.push(node);

    // Adds to the owning player's screen excluding ejected cells
    if (node.owner && node.cellType != 3) {
        node.setColor(node.owner.color);
        node.owner.cells.push(node);
        node.owner.socket.sendPacket(new Packet.AddNode(node, node.owner.scrambleID));
    }

    // Special on-add actions
    node.onAdd(this);
    this.quadTree.add(node);

    // Add to visible nodes
    for (var i = 0; i < this.clients.length; i++) {
        var client = this.clients[i].playerTracker;
        if (!client) continue;

        client.nodeAdditionQueue.push(node);
    }
};

GameServer.prototype.removeNode = function(node) {
    // Remove from main nodes list
    var index = this.nodes.indexOf(node);
    if (index != -1) {
        this.nodes.splice(index, 1);
    }

    if (node.cellType != 0) {
        // Remove from non-player node list
        index = this.nonPlayerNodes.indexOf(node);
        if (index != -1) this.nonPlayerNodes.splice(index, 1);
    }

    this.nodeHandler.movingNodes.remove(node);

    // Special on-remove actions
    node.eaten = true;
    node.onRemove(this);
    this.quadTree.remove(node);

    // Animation when eating
    for (var i = 0; i < this.clients.length; i++) {
        var client = this.clients[i].playerTracker;
        if (!client) continue;

        // Remove from client
        client.nodeDestroyQueue.push(node);
    }
};

GameServer.prototype.updateTime = function() {
    var now = new Date();
    var change = now - this.time;
    this.internalClock += change;
    this.updateLog['update-time-change'] = change;
    this.time = now;
};

GameServer.prototype.updateLoop = function() {
    // Time regulation
    this.updateTime();

    var left = 40 - (this.internalClock - this.lastUpdate);
    this.updateLog['loop-remaining-ticks'] = left;

    if (left <= -200) {
        // Desync, log the skip
        if (this.updateLog['loop-skipped-updates']) this.updateLog['loop-skipped-updates'] += 5;
        else this.updateLog['loop-skipped-updates'] = 5;

        this.lastUpdate += 200;

        this.queueUpdate(40);
        return;
    }

    if (left == 1) {
        // Queue update before everything next tick
        process.nextTick(this.updateProcessingBind);

        var nextUpdate = 40 - (this.internalClock - this.lastUpdate + 40);
        this.queueUpdate(nextUpdate);
        return;
    } else if (left <= 0) {
        // Immediate update
        this.update();

        this.updateTime();

        // Make the lag moments as smooth as possible
        var a = this.internalClock - this.lastUpdate;
        var nextUpdate = 40 - a + 40;
        this.queueUpdate(nextUpdate);
    } else {
        // Do nothing and just queue another update
        var nextUpdate = 39 - (this.internalClock - this.lastUpdate);
        if (nextUpdate < 0) console.log(nextUpdate + " c");
        this.queueUpdate(nextUpdate);
    }
};

GameServer.prototype.queueUpdate = function(ticks) {
    this.updateLog['loop-sleep'] = ticks;
    setTimeout(this.updateLoopBind, ticks);
}

GameServer.prototype.update = function() {
    var ts = process.hrtime();
    this.tickLB++;

    var hr1s = process.hrtime();
    if (this.run) this.nodeHandler.update();
    var hr1e = process.hrtime(hr1s),

        hr2s = process.hrtime();
    this.playerHandler.update();
    var hr2e = process.hrtime(hr2s),

        hr3s = process.hrtime();
    this.gameMode.onTick(this);
    var hr3e = process.hrtime(hr3s);

    var hr4s = process.hrtime();
    if (this.run && this.tickLB == 5) this.updateLeaderboard();
    var hr4e = process.hrtime(hr4s);

    this.lastUpdate += 40;
    this.updateLog['loop-cl-update'] = getTime(hr1e);
    this.updateLog['loop-pl-update'] = getTime(hr2e);
    this.updateLog['loop-gm-update'] = getTime(hr3e);
    this.updateLog['loop-lb-update'] = getTime(hr4e);
    var te = process.hrtime(ts);
    this.updateLog['loop-E0-time'] = getTime(te);
}

GameServer.prototype.updateLeaderboard = function() {
    // Update leaderboard with the gamemode's method
    this.leaderboard = [];
    this.gameMode.updateLB(this);

    if (!this.gameMode.specByLeaderboard && this.clients.length > 0) {
        // Get client with largest score if gamemode doesn't have a leaderboard
        var clients = this.clients.slice(0);

        // Use sort function
        clients.sort(function(a, b) {
            return b.playerTracker.getScore(true) - a.playerTracker.getScore(true);
        });
        this.largestClient = clients[0].playerTracker;
    } else this.largestClient = this.gameMode.rankOne;
    this.tickLB = 0;
}

GameServer.prototype.spawnPlayer = function(player, pos, mass) {
    if (mass == null) { // Get starting mass
        mass = this.config.playerStartMass;
    }

    if (pos == null) { // Get random pos
        pos = this.nodeHandler.getRandomSpawn();
    }

    // Reset player's lose multiplier for sake of playability
    player.massLossMult = 0;

    // Reset player's scramblers
    player.resetScramble();

    // Spawn player and add to world
    var cell = new Entity.PlayerCell(this.getNextNodeId(), player, pos, mass, this);
    player.mouse = new Vector(pos.x, pos.y);

    this.addNode(cell);
};

GameServer.prototype.loadConfig = function() {
    try {
        // Load the contents of the config file
        var load = ini.parse(fs.readFileSync('./gameserver.ini', 'utf-8'));

        // Replace all the default config's values with the loaded config's values
        for (var obj in load) {
            this.config[obj] = load[obj];
        }
    } catch (err) {
        // No config
        console.log("[Game] Config not found... Generating new config");

        // Create a new config
        fs.writeFileSync('./gameserver.ini', ini.stringify(this.config));
    }
};

// Stats server

GameServer.prototype.startStatsServer = function(port) {
    // Do not start the server if the port is negative
    if (port < 1) {
        return;
    }

    // Create stats
    this.stats = "Test";
    this.getStats();

    // Show stats
    this.httpServer = http.createServer(function(req, res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.writeHead(200);
        res.end(this.stats);
    }.bind(this));

    this.httpServer.listen(port, function() {
        // Stats server
        console.log("[Game] Loaded stats server on port " + port);
        setInterval(this.getStats.bind(this), this.config.serverStatsUpdate * 1000);
    }.bind(this));
};

GameServer.prototype.getStats = function() {
    var players = 0;
    this.clients.forEach(function(client) {
        if (client.playerTracker && client.playerTracker.cells.length > 0)
            players++;
    });
    var s = {
        'current_players': this.clients.length,
        'alive': players,
        'spectators': this.clients.length - players,
        'max_players': this.config.serverMaxConnections,
        'gamemode': this.gameMode.name,
        'uptime': Math.round((new Date().getTime() - this.startTime) / 1000 / 60) + " m",
        'start_time': this.startTime
    };
    this.stats = JSON.stringify(s);
};

// Custom prototype functions
WebSocket.prototype.sendPacket = function(packet) {
    function getBuf(data) {
        var array = new Uint8Array(data.buffer || data);
        var l = data.byteLength || data.length;
        var o = data.byteOffset || 0;
        var buffer = new Buffer(l);

        for (var i = 0; i < l; i++) {
            buffer[i] = array[o + i];
        }

        return buffer;
    }

    //if (this.readyState == WebSocket.OPEN && (this._socket.bufferSize == 0) && packet.build) {
    if (this.readyState == WebSocket.OPEN && packet.build) {
        var buf = packet.build();
        this.send(buf, { binary: true });
    } else if (!packet.build) {
        // Do nothing
    } else {
        this.readyState = WebSocket.CLOSED;
        this.emit('close');
        this.removeAllListeners();
    }
};

Array.prototype.remove = function(item) {
    var index = this.indexOf(item);
    if (index > -1) this.splice(index, 1);
    return index > -1;
};
