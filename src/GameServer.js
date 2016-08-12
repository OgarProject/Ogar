// Library imports
var http = require('http');
var fs = require("fs");
var os = require('os');
var path = require('path');
var pjson = require('../package.json');
var ini = require('./modules/ini.js');
var QuadNode = require('quad-node');
var PlayerCommand = require('./modules/PlayerCommand');
var HttpsServer = require('./HttpsServer');

// Project imports
var Packet = require('./packet');
var PlayerTracker = require('./PlayerTracker');
var PacketHandler = require('./PacketHandler');
var Entity = require('./entity');
var Gamemode = require('./gamemodes');
var BotLoader = require('./ai/BotLoader');
var Logger = require('./modules/Logger');
var UserRoleEnum = require('./enum/UserRoleEnum');

// GameServer implementation
function GameServer() {
    this.httpServer = null;
    this.wsServer = null;
    
    // Startup
    this.run = true;
    this.lastNodeId = 1;
    this.lastPlayerId = 1;
    this.clients = [];
    this.socketCount = 0;
    this.largestClient; // Required for spectators
    this.nodes = [];
    this.nodesVirus = [];   // Virus nodes
    this.nodesEjected = []; // Ejected mass nodes
    this.quadTree = null;
    
    this.currentFood = 0;
    this.movingNodes = []; // For move engine
    this.leaderboard = [];
    this.leaderboardType = -1; // no type
    
    this.bots = new BotLoader(this);
    this.commands; // Command handler
    
    // Main loop tick
    this.startTime = Date.now();
    this.stepDateTime = 0;
    this.timeStamp = 0;
    this.updateTime = 0;
    this.updateTimeAvg = 0;
    this.timerLoopBind = null;
    this.mainLoopBind = null;
    
    this.tickCounter = 0;
    
    this.setBorder(10000, 10000);
    
    // Config
    this.config = {
        logVerbosity: 4,            // Console log level (0=NONE; 1=FATAL; 2=ERROR; 3=WARN; 4=INFO; 5=DEBUG)
        logFileVerbosity: 5,        // File log level
        
        serverTimeout: 300,         // Seconds to keep connection alive for non-responding client
        serverWsModule: 'ws',       // WebSocket module: 'ws' or 'uws' (install npm package before using uws)
        serverMaxConnections: 64,   // Maximum number of connections to the server. (0 for no limit)
        serverIpLimit: 4,           // Maximum number of connections from the same IP (0 for no limit)
        serverMinionIgnoreTime: 30, // minion detection disable time on server startup [seconds]
        serverMinionThreshold: 10,  // max connections within serverMinionInterval time period, which will not be marked as minion
        serverMinionInterval: 1000, // minion detection interval [milliseconds]
        serverPort: 443,            // Server port
        serverBind: '0.0.0.0',      // Network interface binding
        serverTracker: 0,           // Set to 1 if you want to show your server on the tracker http://ogar.mivabe.nl/master
        serverGamemode: 0,          // Gamemode, 0 = FFA, 1 = Teams
        serverBots: 0,              // Number of player bots to spawn
        serverViewBaseX: 1920,      // Base client screen resolution. Used to calculate view area. Warning: high values may cause lag
        serverViewBaseY: 1080,      // min value is 1920x1080
        serverMinScale: 0.15,       // Min scale for player (low value leads to lags due to large visible area)
        serverSpectatorScale: 0.4,  // Scale (field of view) used for free roam spectators (low value leads to lags, vanilla=0.4, old vanilla=0.25)
        serverStatsPort: 88,        // Port for stats server. Having a negative number will disable the stats server.
        serverStatsUpdate: 60,      // Update interval of server stats in seconds
        serverScrambleLevel: 2,     // Toggles scrambling of coordinates. 0 = No scrambling, 1 = lightweight scrambling. 2 = full scrambling (also known as scramble minimap); 3 - high scrambling (no border)
        serverMaxLB: 10,            // Controls the maximum players displayed on the leaderboard.
        serverChat: 1,              // Set to 1 to allow chat; 0 to disable chat.
        serverChatAscii: 1,         // Set to 1 to disable non-ANSI letters in the chat (english only mode)
        
        serverName: 'MultiOgar #1', // Server name
        serverWelcome1: 'Welcome to MultiOgar server!',      // First server welcome message
        serverWelcome2: '',         // Second server welcome message (for info, etc)
        
        borderWidth: 14142,         // Map border size (Vanilla value: 14142)
        borderHeight: 14142,        // Map border size (Vanilla value: 14142)
        
        foodMinSize: 10,            // Minimum food size (vanilla 10)
        foodMaxSize: 20,            // Maximum food size (vanilla 20)
        foodMinAmount: 1000,        // Minimum food cells on the map
        foodMaxAmount: 2000,        // Maximum food cells on the map
        foodSpawnAmount: 30,        // The number of food to spawn per interval
        foodMassGrow: 1,            // Enable food mass grow ?
        spawnInterval: 20,          // The interval between each food cell spawn in ticks (1 tick = 50 ms)
        
        virusMinSize: 100,          // Minimum virus size (vanilla 100)
        virusMaxSize: 140,          // Maximum virus size (vanilla 140)
        virusMinAmount: 50,         // Minimum number of viruses on the map.
        virusMaxAmount: 100,        // Maximum number of viruses on the map. If this number is reached, then ejected cells will pass through viruses.
        
        ejectSize: 38,              // Size of ejected cells (vanilla 38)
        ejectSizeLoss: 43,          // Eject size which will be substracted from player cell (vanilla 43?)
        ejectDistance: 780,         // vanilla 780
        ejectCooldown: 3,           // min ticks between ejects
        ejectSpawnPlayer: 1,        // if 1 then player may be spawned from ejected mass
        
        playerMinSize: 32,          // Minimym size of the player cell (mass = 32*32/100 = 10.24)
        playerMaxSize: 1500,        // Maximum size of the player cell (mass = 1500*1500/100 = 22500)
        playerMinSplitSize: 60,     // Minimum player cell size allowed to split (mass = 60*60/100 = 36) 
        playerStartSize: 64,        // Start size of the player cell (mass = 64*64/100 = 41)
        playerMaxCells: 16,         // Max cells the player is allowed to have
        playerSpeed: 1,             // Player speed multiplier
        playerDecayRate: .002,      // Amount of player cell size lost per second
        playerRecombineTime: 30,    // Base time in seconds before a cell is allowed to recombine
        playerMaxNickLength: 15,    // Maximum nick length
        playerDisconnectTime: 60,   // The time in seconds it takes for a player cell to be removed after disconnection (If set to -1, cells are never removed)
        
        tourneyMaxPlayers: 12,      // Maximum number of participants for tournament style game modes
        tourneyPrepTime: 10,        // Number of ticks to wait after all players are ready (1 tick = 1000 ms)
        tourneyEndTime: 30,         // Number of ticks to wait after a player wins (1 tick = 1000 ms)
        tourneyTimeLimit: 20,       // Time limit of the game, in minutes.
        tourneyAutoFill: 0,         // If set to a value higher than 0, the tournament match will automatically fill up with bots after this amount of seconds
        tourneyAutoFillPlayers: 1,  // The timer for filling the server with bots will not count down unless there is this amount of real players
    };
    
    this.ipBanList = [];
    this.minionTest = [];
    this.userList = [];
    this.badWords = [];
    
    // Parse config
    this.loadConfig();
    this.loadIpBanList();
    this.loadUserList();
    this.loadBadWords();
    
    this.setBorder(this.config.borderWidth, this.config.borderHeight);
    this.quadTree = new QuadNode(this.border, 64, 32);
    
    // Gamemodes
    this.gameMode = Gamemode.get(this.config.serverGamemode);
}

module.exports = GameServer;

GameServer.prototype.start = function () {
    this.timerLoopBind = this.timerLoop.bind(this);
    this.mainLoopBind = this.mainLoop.bind(this);
    
    // Gamemode configurations
    this.gameMode.onServerInit(this);
    
    var dirSsl = path.join(path.dirname(module.filename), '../ssl');
    var pathKey = path.join(dirSsl, 'key.pem');
    var pathCert = path.join(dirSsl, 'cert.pem');
    
    if (fs.existsSync(pathKey) && fs.existsSync(pathCert)) {
        // HTTP/TLS
        var options = {
            key: fs.readFileSync(pathKey, 'utf8'),
            cert: fs.readFileSync(pathCert, 'utf8')
        };
        Logger.info("TLS: supported");
        this.httpServer = HttpsServer.createServer(options);
    } else {
        // HTTP only
        Logger.warn("TLS: not supported (SSL certificate not found!)");
        this.httpServer = http.createServer();
    }
    var wsOptions = {
        server: this.httpServer, 
        perMessageDeflate: false,
        maxPayload: 4096
    };
    Logger.info("WebSocket: " + this.config.serverWsModule);
    WebSocket = require(this.config.serverWsModule);
    // Custom prototype functions^M
    WebSocket.prototype.sendPacket = function (packet) {
        if (packet == null) return;
        if (this.readyState == WebSocket.OPEN) {
            if (this._socket.writable != null && !this._socket.writable) {
                return;
            }
            var buffer = packet.build(this.playerTracker.socket.packetHandler.protocol);
            if (buffer != null) {
                this.send(buffer, { binary: true });
            }
        } else {
            this.readyState = WebSocket.CLOSED;
            this.emit('close');
        }
    };
    
    this.wsServer = new WebSocket.Server(wsOptions);
    this.wsServer.on('error', this.onServerSocketError.bind(this));
    this.wsServer.on('connection', this.onClientSocketOpen.bind(this));
    this.httpServer.listen(this.config.serverPort, this.config.serverBind, this.onHttpServerOpen.bind(this));
    
    this.startStatsServer(this.config.serverStatsPort);
};

GameServer.prototype.onHttpServerOpen = function () {
    // Spawn starting food
    this.startingFood();
    
    // Start Main Loop
    setTimeout(this.timerLoopBind, 1);
    
    // Done
    Logger.info("Listening on port " + this.config.serverPort);
    Logger.info("Current game mode is " + this.gameMode.name);
    
    // Player bots (Experimental)
    if (this.config.serverBots > 0) {
        for (var i = 0; i < this.config.serverBots; i++) {
            this.bots.addBot();
        }
        Logger.info("Added " + this.config.serverBots + " player bots");
    }
};

GameServer.prototype.onServerSocketError = function (error) {
    Logger.error("WebSocket: " + error.code + " - " + error.message);
    switch (error.code) {
        case "EADDRINUSE":
            Logger.error("Server could not bind to port " + this.config.serverPort + "!");
            Logger.error("Please close out of Skype or change 'serverPort' in gameserver.ini to a different number.");
            break;
        case "EACCES":
            Logger.error("Please make sure you are running Ogar with root privileges.");
            break;
    }
    process.exit(1); // Exits the program
};

GameServer.prototype.onClientSocketOpen = function (ws) {
    var logip = ws._socket.remoteAddress + ":" + ws._socket.remotePort;
    ws.on('error', function (err) {
        Logger.writeError("[" + logip + "] " + err.stack);
    });
    if (this.config.serverMaxConnections > 0 && this.socketCount >= this.config.serverMaxConnections) {
        ws.close(1000, "No slots");
        return;
    }
    if (this.checkIpBan(ws._socket.remoteAddress)) {
        ws.close(1000, "IP banned");
        return;
    }
    if (this.config.serverIpLimit > 0) {
        var ipConnections = 0;
        for (var i = 0; i < this.clients.length; i++) {
            var socket = this.clients[i];
            if (!socket.isConnected || socket.remoteAddress != ws._socket.remoteAddress)
                continue;
            ipConnections++;
        }
        if (ipConnections >= this.config.serverIpLimit) {
            ws.close(1000, "IP limit reached");
            return;
        }
    }
    ws.isConnected = true;
    ws.remoteAddress = ws._socket.remoteAddress;
    ws.remotePort = ws._socket.remotePort;
    ws.lastAliveTime = Date.now();
    Logger.write("CONNECTED    " + ws.remoteAddress + ":" + ws.remotePort + ", origin: \"" + ws.upgradeReq.headers.origin + "\"");
    
    ws.playerTracker = new PlayerTracker(this, ws);
    ws.packetHandler = new PacketHandler(this, ws);
    ws.playerCommand = new PlayerCommand(this, ws.playerTracker);
    
    var self = this;
    var onMessage = function (message) {
        self.onClientSocketMessage(ws, message);
    };
    var onError = function (error) {
        self.onClientSocketError(ws, error);
    };
    var onClose = function (reason) {
        self.onClientSocketClose(ws, reason);
    };
    ws.on('message', onMessage);
    ws.on('error', onError);
    ws.on('close', onClose);
    this.socketCount++;
    this.clients.push(ws);
    
    // Minion detection
    if (this.config.serverMinionThreshold) {
        if ((ws.lastAliveTime - this.startTime) / 1000 >= this.config.serverMinionIgnoreTime) {
            if (this.minionTest.length >= this.config.serverMinionThreshold) {
                ws.playerTracker.isMinion = true;
                for (var i = 0; i < this.minionTest.length; i++) {
                    var playerTracker = this.minionTest[i];
                    if (!playerTracker.socket.isConnected) continue;
                    playerTracker.isMinion = true;
                }
                if (this.minionTest.length) {
                    this.minionTest.splice(0, 1);
                }
            }
            this.minionTest.push(ws.playerTracker);
        }
    }
};

GameServer.prototype.onClientSocketClose = function (ws, code) {
    if (ws._socket.destroy != null && typeof ws._socket.destroy == 'function') {
        ws._socket.destroy();
    }
    if (this.socketCount < 1) {
        Logger.error("GameServer.onClientSocketClose: socketCount=" + this.socketCount);
    } else {
        this.socketCount--;
    }
    ws.isConnected = false;
    ws.sendPacket = function (data) { };
    ws.closeReason = { code: ws._closeCode, message: ws._closeMessage };
    ws.closeTime = Date.now();
    Logger.write("DISCONNECTED " + ws.remoteAddress + ":" + ws.remotePort + ", code: " + ws._closeCode + ", reason: \"" + ws._closeMessage + "\", name: \"" + ws.playerTracker.getName() + "\"");
    
    // disconnected effect
    var color = this.getGrayColor(ws.playerTracker.getColor());
    ws.playerTracker.setColor(color);
    ws.playerTracker.setSkin("");
    ws.playerTracker.cells.forEach(function (cell) {
        cell.setColor(color);
    }, this);
};

GameServer.prototype.onClientSocketError = function (ws, error) {
    ws.sendPacket = function (data) { };
};

GameServer.prototype.onClientSocketMessage = function (ws, message) {
    if (message.length == 0) {
        return;
    }
    if (message.length > 256) {
        ws.close(1009, "Spam");
        return;
    }
    ws.packetHandler.handleMessage(message);
};

GameServer.prototype.setBorder = function (width, height) {
    var hw = width / 2;
    var hh = height / 2;
    this.border = {
        minx: -hw,
        miny: -hh,
        maxx: hw,
        maxy: hh,
        width: width,
        height: height,
        centerx: 0,
        centery: 0
    };
};

GameServer.prototype.getTick = function () {
    return this.tickCounter;
};

GameServer.prototype.getMode = function () {
    return this.gameMode;
};

GameServer.prototype.getNextNodeId = function () {
    // Resets integer
    if (this.lastNodeId > 2147483647) {
        this.lastNodeId = 1;
    }
    return this.lastNodeId++ >>> 0;
};

GameServer.prototype.getNewPlayerID = function () {
    // Resets integer
    if (this.lastPlayerId > 2147483647) {
        this.lastPlayerId = 1;
    }
    return this.lastPlayerId++ >>> 0;
};

GameServer.prototype.getRandomPosition = function () {
    return {
        x: Math.floor(this.border.minx + this.border.width * Math.random()),
        y: Math.floor(this.border.miny + this.border.height * Math.random())
    };
};

GameServer.prototype.getGrayColor = function (rgb) {
    var luminance = Math.min(255, (rgb.r * 0.2125 + rgb.g * 0.7154 + rgb.b * 0.0721)) >>> 0;
    return {
        r: luminance,
        g: luminance,
        b: luminance
    };
};

GameServer.prototype.getRandomColor = function () {
    var h = 360 * Math.random();
    var s = 248 / 255;
    var v = 1;
    
    // hsv to rgb    
    var rgb = { r: v, g: v, b: v };    // achromatic (grey)
    if (s > 0) {
        h /= 60;			           // sector 0 to 5
        var i = Math.floor(h) >> 0;
        var f = h - i;			       // factorial part of h
        var p = v * (1 - s);
        var q = v * (1 - s * f);
        var t = v * (1 - s * (1 - f));
        switch (i) {
            case 0: rgb = { r: v, g: t, b: p }; break
            case 1: rgb = { r: q, g: v, b: p }; break
            case 2: rgb = { r: p, g: v, b: t }; break
            case 3: rgb = { r: p, g: q, b: v }; break
            case 4: rgb = { r: t, g: p, b: v }; break
            default: rgb = { r: v, g: p, b: q }; break
        }
    }
    // check color range
    rgb.r = Math.max(rgb.r, 0);
    rgb.g = Math.max(rgb.g, 0);
    rgb.b = Math.max(rgb.b, 0);
    rgb.r = Math.min(rgb.r, 1);
    rgb.g = Math.min(rgb.g, 1);
    rgb.b = Math.min(rgb.b, 1);
    return {
        r: (rgb.r * 255) >>> 0,
        g: (rgb.g * 255) >>> 0,
        b: (rgb.b * 255) >>> 0
    };
};

GameServer.prototype.updateNodeQuad = function (node) {
    var item = node.quadItem;
    if (item == null) {
        throw new TypeError("GameServer.updateNodeQuad: quadItem is null!");
    }
    var x = node.position.x;
    var y = node.position.y;
    var size = node.getSize();
    // check for change
    if (item.x === x && item.y === y && item.size === size) {
        return;
    }
    // update quad tree
    item.x = x;
    item.y = y;
    item.size = size;
    item.bound.minx = x - size;
    item.bound.miny = y - size;
    item.bound.maxx = x + size;
    item.bound.maxy = y + size;
    this.quadTree.update(item);
};


GameServer.prototype.addNode = function (node) {
    var x = node.position.x;
    var y = node.position.y;
    var size = node.getSize();
    node.quadItem = {
        cell: node,
        x: x,
        y: y,
        size: size,
        bound: { minx: x-size, miny: y-size, maxx: x+size, maxy: y+size }
    };
    this.quadTree.insert(node.quadItem);
    
    this.nodes.push(node);
    
    // Adds to the owning player's screen
    if (node.owner) {
        node.setColor(node.owner.getColor());
        node.owner.cells.push(node);
        node.owner.socket.sendPacket(new Packet.AddNode(node.owner, node));
    }
    
    // Special on-add actions
    node.onAdd(this);
};

GameServer.prototype.removeNode = function (node) {
    if (node.quadItem == null) {
        throw new TypeError("GameServer.removeNode: attempt to remove invalid node!");
    }
    node.isRemoved = true;
    this.quadTree.remove(node.quadItem);
    node.quadItem = null;
    
    // Remove from main nodes list
    var index = this.nodes.indexOf(node);
    if (index != -1) {
        this.nodes.splice(index, 1);
    }
    
    // Remove from moving cells list
    index = this.movingNodes.indexOf(node);
    if (index != -1) {
        this.movingNodes.splice(index, 1);
    }
    
    // Special on-remove actions
    node.onRemove(this);
};

GameServer.prototype.updateClients = function () {
    // check minions
    for (var i = 0; i < this.minionTest.length; ) {
        var playerTracker = this.minionTest[i];
        if (this.stepDateTime - playerTracker.connectedTime > this.config.serverMinionInterval) {
            this.minionTest.splice(i, 1);
        } else {
            i++;
        }
    }
    // check dead clients
    for (var i = 0; i < this.clients.length; ) {
        var playerTracker = this.clients[i].playerTracker;
        playerTracker.checkConnection();
        if (playerTracker.isRemoved) {
            // remove dead client
            this.clients.splice(i, 1);
        } else {
            i++;
        }
    }
    // update
    for (var i = 0; i < this.clients.length; i++) {
        this.clients[i].playerTracker.updateTick();
    }
    for (var i = 0; i < this.clients.length; i++) {
        this.clients[i].playerTracker.sendUpdate();
    }
};

GameServer.prototype.updateLeaderboard = function () {
    // Update leaderboard with the gamemode's method
    this.leaderboard = [];
    this.leaderboardType = -1;
    this.gameMode.updateLB(this);
    
    if (!this.gameMode.specByLeaderboard) {
        // Get client with largest score if gamemode doesn't have a leaderboard
        var clients = this.clients.valueOf();
        
        // Use sort function
        clients.sort(function (a, b) {
            return b.playerTracker.getScore() - a.playerTracker.getScore();
        });
        //this.largestClient = clients[0].playerTracker;
        this.largestClient = null;
        if (clients[0] != null)
            this.largestClient = clients[0].playerTracker;
    } else {
        this.largestClient = this.gameMode.rankOne;
    }
};

GameServer.prototype.onChatMessage = function (from, to, message) {
    if (message == null) return;
    message = message.trim();
    if (message == "") return;
    if (from && message.length > 0 && message[0] == '/') {
        // player command
        message = message.slice(1, message.length);
        from.socket.playerCommand.executeCommandLine(message);
        return;
    }
    if (!this.config.serverChat) {
        // chat is disabled
        return;
    }
    if (from && from.isMuted) {
        // player is muted
        return;
    }
    if (message.length > 64) {
        message = message.slice(0, 64);
    }
    if (this.config.serverChatAscii) {
        for (var i = 0; i < message.length; i++) {
            var c = message.charCodeAt(i);
            if (c < 0x20 || c > 0x7F) {
                if (from) {
                    this.sendChatMessage(null, from, "You can use ASCII text only!");
                }
                return;
            }
        }
    }
    if (this.checkBadWord(message)) {
        if (from) {
            this.sendChatMessage(null, from, "Stop insulting others! Keep calm and be friendly please");
        }
        return;
    }
    if (from) {
        Logger.writeDebug("[CHAT][" + from.socket.remoteAddress + ":" + from.socket.remotePort + "][" + from.getFriendlyName() + "] " + message);
    } else {
        Logger.writeDebug("[CHAT][][]: " + message);
    }
    this.sendChatMessage(from, to, message);
};

GameServer.prototype.sendChatMessage = function (from, to, message) {
    for (var i = 0; i < this.clients.length; i++) {
        var client = this.clients[i];
        if (client == null) continue;
        if (to == null || to == client.playerTracker)
            client.sendPacket(new Packet.ChatMessage(from, message));
    }
};

GameServer.prototype.timerLoop = function () {
    var timeStep = 40;
    
    var ts = Date.now();
    var dt = ts - this.timeStamp;
    if (dt < timeStep - 5) {
        setTimeout(this.timerLoopBind, ((timeStep - 5) - dt) >> 0);
        return;
    }
    if (dt < timeStep - 1) {
        setTimeout(this.timerLoopBind, 0);
        return;
    }
    if (dt < timeStep) {
        //process.nextTick(this.timerLoopBind);
        setTimeout(this.timerLoopBind, 0);
        return;
    }
    if (dt > 120) {
        // too high lag => resynchronize
        this.timeStamp = ts-timeStep;
    }
    // update average
    this.updateTimeAvg += 0.5 * (this.updateTime - this.updateTimeAvg);
    // calculate next
    if (this.timeStamp == 0)
        this.timeStamp = ts;
    this.timeStamp += timeStep;
    //process.nextTick(this.mainLoopBind);
    //process.nextTick(this.timerLoopBind);
    setTimeout(this.mainLoopBind, 0);
    setTimeout(this.timerLoopBind, 0);
};

GameServer.prototype.mainLoop = function () {
    this.stepDateTime = Date.now();
    var tStart = process.hrtime();
    
    // Loop main functions
    if (this.run) {
        this.updateMoveEngine();
        if ((this.getTick() % this.config.spawnInterval) == 0) {
            this.updateFood();  // Spawn food
            this.updateVirus(); // Spawn viruses
        }
        this.gameMode.onTick(this);
        if (((this.getTick() + 3) % (1000 / 40)) == 0) {
            // once per second
            this.updateMassDecay();
        }
    }
    
    this.updateClients();
    
    if (((this.getTick() + 7) % (1000 / 40)) == 0) {
        // once per second
        this.updateLeaderboard();
    }
    
    // ping server tracker
    if (this.config.serverTracker && (this.getTick() % (10000 / 40)) == 0) {
        // once per 30 seconds
        this.pingServerTracker();
    }
    
    if (this.run) {
        this.tickCounter++;
    }
    var tEnd = process.hrtime(tStart);
    this.updateTime = tEnd[0] * 1000 + tEnd[1] / 1000000;
};

GameServer.prototype.startingFood = function () {
    // Spawns the starting amount of food cells
    for (var i = 0; i < this.config.foodMinAmount; i++) {
        this.spawnFood();
    }
};

GameServer.prototype.updateFood = function () {
    var maxCount = this.config.foodMinAmount - this.currentFood;
    var spawnCount = Math.min(maxCount, this.config.foodSpawnAmount);
    for (var i = 0; i < spawnCount; i++) {
        this.spawnFood();
    }
};

GameServer.prototype.updateVirus = function () {
    var maxCount = this.config.virusMinAmount - this.nodesVirus.length;
    var spawnCount = Math.min(maxCount, 2);
    for (var i = 0; i < spawnCount; i++) {
        this.spawnVirus();
    }
};

GameServer.prototype.spawnFood = function () {
    var cell = new Entity.Food(this, null, this.getRandomPosition(), this.config.foodMinSize);
    if (this.config.foodMassGrow) {
        var size = cell.getSize();
        var maxGrow = this.config.foodMaxSize - size;
        size += maxGrow * Math.random();
        cell.setSize(size);
    }
    cell.setColor(this.getRandomColor());
    this.addNode(cell);
};

GameServer.prototype.spawnVirus = function () {
    // Spawns a virus
    var pos = this.getRandomPosition();
    if (this.willCollide(pos, this.config.virusMinSize)) {
        // cannot find safe position => do not spawn
        return;
    }
    var v = new Entity.Virus(this, null, pos, this.config.virusMinSize);
    this.addNode(v);
};

GameServer.prototype.spawnPlayer = function (player, pos, size) {
    // Check if can spawn from ejected mass
    if (!pos && this.config.ejectSpawnPlayer && this.nodesEjected.length > 0) {
        if (Math.random() >= 0.5) {
            // Spawn from ejected mass
            var index = (this.nodesEjected.length - 1) * Math.random() >>> 0;
            var eject = this.nodesEjected[index];
            if (!eject.isRemoved) {
                this.removeNode(eject);
                pos = {
                    x: eject.position.x,
                    y: eject.position.y
                };
                if (!size) {
                    size = Math.max(eject.getSize(), this.config.playerStartSize);
                }
            }
        }
    }
    if (pos == null) {
        // Get random pos
        var pos = this.getRandomPosition();
        // 10 attempts to find safe position
        for (var i = 0; i < 10 && this.willCollide(pos, this.config.playerMinSize); i++) {
            pos = this.getRandomPosition();
        }
    }
    if (size == null) {
        // Get starting mass
        size = this.config.playerStartSize;
    }
    
    // Spawn player and add to world
    var cell = new Entity.PlayerCell(this, player, pos, size);
    this.addNode(cell);
    
    // Set initial mouse coords
    player.mouse = {
        x: pos.x,
        y: pos.y
    };
};

GameServer.prototype.willCollide = function (pos, size) {
    // Look if there will be any collision with the current nodes
    var bound = {
        minx: pos.x - size,
        miny: pos.y - size,
        maxx: pos.x + size,
        maxy: pos.y + size
    };
    return this.quadTree.any(
        bound, 
        function (item) {
            return item.cell.cellType == 0; // check players only
        });
};

// Checks cells for collision.
// Returns collision manifold or null if there is no collision
GameServer.prototype.checkCellCollision = function (cell, check) {
    var r = cell.getSize() + check.getSize();
    var dx = check.position.x - cell.position.x;
    var dy = check.position.y - cell.position.y;
    var squared = dx * dx + dy * dy;         // squared distance from cell to check
    if (squared > r * r) {
        // no collision
        return null;
    }
    // create collision manifold
    return {
        cell1: cell,
        cell2: check,
        r: r,               // radius sum
        dx: dx,             // delta x from cell1 to cell2
        dy: dy,             // delta y from cell1 to cell2
        squared: squared    // squared distance from cell1 to cell2
    };
};

// Resolves rigid body collision
GameServer.prototype.resolveRigidCollision = function (manifold, border) {
    // distance from cell1 to cell2
    var d = Math.sqrt(manifold.squared);
    if (d <= 0) return;
    var invd = 1 / d;
    
    // normal
    var nx = ~~manifold.dx * invd;
    var ny = ~~manifold.dy * invd;
    
    // body penetration distance
    var penetration = manifold.r - d;
    if (penetration <= 0) return;
    
    // penetration vector = penetration * normal
    var px = penetration * nx;
    var py = penetration * ny;
    
    // body impulse
    var totalMass = manifold.cell1.getSizeSquared() + manifold.cell2.getSizeSquared();
    if (totalMass <= 0) return;
    var invTotalMass = 1 / totalMass;
    var impulse1 = manifold.cell2.getSizeSquared() * invTotalMass;
    var impulse2 = manifold.cell1.getSizeSquared() * invTotalMass;
    
    // apply extrusion force
    manifold.cell1.position.x -= px * impulse1;
    manifold.cell1.position.y -= py * impulse1;
    manifold.cell2.position.x += px * impulse2;
    manifold.cell2.position.y += py * impulse2;
    // clip to border bounds
    manifold.cell1.checkBorder(border);
    manifold.cell2.checkBorder(border);
};

// Checks if collision is rigid body collision
GameServer.prototype.checkRigidCollision = function (manifold) {
    if (!manifold.cell1.owner || !manifold.cell2.owner)
        return false;
    if (manifold.cell1.owner != manifold.cell2.owner) {
        // Different owners
        return this.gameMode.haveTeams && 
            manifold.cell1.owner.getTeam() == manifold.cell2.owner.getTeam();
    }
    // The same owner
    if (manifold.cell1.owner.mergeOverride)
        return false;
    var tick = this.getTick();
    if (manifold.cell1.getAge(tick) < 15 || manifold.cell2.getAge(tick) < 15) {
        // just splited => ignore
        return false;
    }
    return !manifold.cell1.canRemerge() || !manifold.cell2.canRemerge();
};

// Resolves non-rigid body collision
GameServer.prototype.resolveCollision = function (manifold) {
    var minCell = manifold.cell1;
    var maxCell = manifold.cell2;
    // check if any cell already eaten
    if (minCell.isRemoved || maxCell.isRemoved)
        return;
    if (minCell.getSize() > maxCell.getSize()) {
        minCell = manifold.cell2;
        maxCell = manifold.cell1;
    }
    
    // check distance
    var eatDistance = maxCell.getSize() - minCell.getSize() / 3;
    if (manifold.squared >= eatDistance * eatDistance) {
        // too far => can't eat
        return;
    }
    
    if (minCell.owner && minCell.owner == maxCell.owner) {
        // collision owned/owned => ignore or resolve or remerge
        
        var tick = this.getTick();
        if (minCell.getAge(tick) < 15 || maxCell.getAge(tick) < 15) {
            // just splited => ignore
            return;
        }
        if (!minCell.owner.mergeOverride) {
            // not force remerge => check if can remerge
            if (!minCell.canRemerge() || !maxCell.canRemerge()) {
                // cannot remerge
                return;
            }
        }
    } else {
        // collision owned/enemy => check if can eat
        
        // Team check
        if (this.gameMode.haveTeams && minCell.owner && maxCell.owner) {
            if (minCell.owner.getTeam() == maxCell.owner.getTeam()) {
                // cannot eat team member
                return;
            }
        }
        // Size check
        if (maxCell.getSize() <= minCell.getSize() * 1.15) {
            // too large => can't eat
            return;
        }
    }
    if (!maxCell.canEat(minCell)) {
        // maxCell don't want to eat
        return;
    }
    
    // Now maxCell can eat minCell
    minCell.isRemoved = true;
    
    // Disable mergeOverride on the last merging cell
    // We need to disable it before onCosume to prevent merging loop
    // (onConsume may cause split for big mass)
    if (minCell.owner && minCell.owner.cells.length <= 2) {
        minCell.owner.mergeOverride = false;
    }
    
    var isMinion = (maxCell.owner && maxCell.owner.isMinion) ||
        (minCell.owner && minCell.owner.isMinion);
    if (!isMinion) {
        // Consume effect
        maxCell.onEat(minCell);
        minCell.onEaten(maxCell);
        
        // update bounds
        this.updateNodeQuad(maxCell);
    }
    
    // Remove cell
    minCell.setKiller(maxCell);
    this.removeNode(minCell);
};

GameServer.prototype.updateMoveEngine = function () {
    var tick = this.getTick();
    // Move player cells
    for (var i in this.clients) {
        var client = this.clients[i].playerTracker;
        var checkSize = !client.mergeOverride || client.cells.length == 1;
        for (var j = 0; j < client.cells.length; j++) {
            var cell1 = client.cells[j];
            if (cell1.isRemoved)
                continue;
            cell1.updateRemerge(this);
            cell1.moveUser(this.border);
            cell1.move(this.border);

            // check size limit
            if (checkSize && cell1.getSize() > this.config.playerMaxSize && cell1.getAge(tick) >= 15) {
                if (client.cells.length >= this.config.playerMaxCells) {
                    // cannot split => just limit
                    cell1.setSize(this.config.playerMaxSize);
                } else {
                    // split
                    var maxSplit = this.config.playerMaxCells - client.cells.length;
                    var maxMass = this.config.playerMaxSize * this.config.playerMaxSize;
                    var count = (cell1.getSizeSquared() / maxMass) >> 0;
                    var count = Math.min(count, maxSplit);
                    var splitSize = cell1.getSize() / Math.sqrt(count + 1);
                    var splitMass = splitSize * splitSize / 100;
                    var angle = Math.random() * 2 * Math.PI;
                    var step = 2 * Math.PI / count;
                    for (var k = 0; k < count; k++) {
                        this.splitPlayerCell(client, cell1, angle, splitMass);
                        angle += step;
                    }
                }
            }
            this.updateNodeQuad(cell1);
        }
    }
    // Move moving cells
    for (var i = 0; i < this.movingNodes.length; ) {
        var cell1 = this.movingNodes[i];
        if (cell1.isRemoved)
            continue;
        cell1.move(this.border);
        this.updateNodeQuad(cell1);
        if (!cell1.isMoving)
            this.movingNodes.splice(i, 1);
        else
            i++;
    }
    
    // === check for collisions ===
    
    // Scan for player cells collisions
    var self = this;
    var rigidCollisions = [];
    var eatCollisions = [];
    for (var i in this.clients) {
        var client = this.clients[i].playerTracker;
        for (var j = 0; j < client.cells.length; j++) {
            var cell1 = client.cells[j];
            if (cell1 == null) continue;
            this.quadTree.find(cell1.quadItem.bound, function (item) {
                var cell2 = item.cell;
                if (cell2 == cell1) return;
                var manifold = self.checkCellCollision(cell1, cell2);
                if (manifold == null) return;
                if (self.checkRigidCollision(manifold))
                    rigidCollisions.push({ cell1: cell1, cell2: cell2 });
                else
                    eatCollisions.push({ cell1: cell1, cell2: cell2 });
            });
        }
    }
    
    // resolve rigid body collisions
    ////for (var z = 0; z < 2; z++) { // loop for better rigid body resolution quality (slow)
        for (var k = 0; k < rigidCollisions.length; k++) {
            var c = rigidCollisions[k];
            var manifold = this.checkCellCollision(c.cell1, c.cell2);
            if (manifold == null) continue;
            this.resolveRigidCollision(manifold, this.border);
        }
    ////}
    // Update quad tree
    for (var k = 0; k < rigidCollisions.length; k++) {
        var c = rigidCollisions[k];
        this.updateNodeQuad(c.cell1);
        this.updateNodeQuad(c.cell2);
    }
    rigidCollisions = null;
    
    // resolve eat collisions
    for (var k = 0; k < eatCollisions.length; k++) {
        var c = eatCollisions[k];
        var manifold = this.checkCellCollision(c.cell1, c.cell2);
        if (manifold == null) continue;
        this.resolveCollision(manifold);
    }
    eatCollisions = null;
    
    //this.gameMode.onCellMove(cell1, this);
    
    // Scan for ejected cell collisions (scan for ejected or virus only)
    rigidCollisions = [];
    eatCollisions = [];
    var self = this;
    for (var i = 0; i < this.movingNodes.length; i++) {
        var cell1 = this.movingNodes[i];
        if (cell1.isRemoved) continue;
        this.quadTree.find(cell1.quadItem.bound, function (item) {
            var cell2 = item.cell;
            if (cell2 == cell1)
                return;
            var manifold = self.checkCellCollision(cell1, cell2);
            if (manifold == null) return;
            if (cell1.cellType == 3 && cell2.cellType == 3) {
                // ejected/ejected
                rigidCollisions.push({ cell1: cell1, cell2: cell2 });
                // add to moving nodes if needed
                if (!cell1.isMoving) {
                    cell1.isMoving = true
                    self.movingNodes.push(cell1);
                }
                if (!cell2.isMoving) {
                    cell2.isMoving = true
                    self.movingNodes.push(cell2);
                }
            }
            else {
                eatCollisions.push({ cell1: cell1, cell2: cell2 });
            }
        });
    }
    
    // resolve rigid body collisions
    for (var k = 0; k < rigidCollisions.length; k++) {
        var c = rigidCollisions[k];
        var manifold = this.checkCellCollision(c.cell1, c.cell2);
        if (manifold == null) continue;
        this.resolveRigidCollision(manifold, this.border);
        // position changed! don't forgot to update quad-tree
    }
    // Update quad tree
    for (var k = 0; k < rigidCollisions.length; k++) {
        var c = rigidCollisions[k];
        this.updateNodeQuad(c.cell1);
        this.updateNodeQuad(c.cell2);
    }
    rigidCollisions = null;
    
    // resolve eat collisions
    for (var k = 0; k < eatCollisions.length; k++) {
        var c = eatCollisions[k];
        var manifold = this.checkCellCollision(c.cell1, c.cell2);
        if (manifold == null) continue;
        this.resolveCollision(manifold);
    }
};

// Returns masses in descending order
GameServer.prototype.splitMass = function (mass, count) {
    // min throw size (vanilla 44)
    var throwSize = this.config.playerMinSize + 12;
    var throwMass = throwSize * throwSize / 100;
    
    // check maxCount
    var maxCount = count;
    var curMass = mass;
    while (maxCount > 1 && curMass / (maxCount - 1) < throwMass) {
        maxCount = maxCount / 2 >>> 0;
    }
    if (maxCount < 2) {
        return [mass];
    }
    
    // calculate mass
    var minMass = this.config.playerMinSize * this.config.playerMinSize / 100;
    var splitMass = curMass / maxCount;
    if (splitMass < minMass) {
        return [mass];
    }
    var masses = [];
    if (maxCount < 3 || maxCount < count || curMass / throwMass <= 30) {
        // Monotone blow up
        for (var i = 0; i < maxCount; i++) {
            masses.push(splitMass);
        }
    } else {
        // Diverse blow up
        // Barbosik: draft version
        var restCount = maxCount;
        while (restCount > 2) {
            var splitMass = curMass / 2;
            if (splitMass <= throwMass) {
                break;
            }
            var max = curMass - throwMass * (restCount - 1);
            if (max <= throwMass || splitMass >= max) {
                break;
            }
            masses.push(splitMass);
            curMass -= splitMass;
            restCount--;
        }
        var splitMass = curMass / 4;
        if (splitMass > throwMass) {
            while (restCount > 2) {
                var max = curMass - throwMass * (restCount - 1);
                if (max <= throwMass || splitMass >= max) {
                    break;
                }
                masses.push(splitMass);
                curMass -= splitMass;
                restCount--;
            }
        }
        var splitMass = curMass / 8;
        if (splitMass > throwMass) {
            while (restCount > 2) {
                var max = curMass - throwMass * (restCount - 1);
                if (max <= throwMass || splitMass >= max) {
                    break;
                }
                masses.push(splitMass);
                curMass -= splitMass;
                restCount--;
            }
        }
        if (restCount > 1) {
            splitMass = curMass - throwMass * (restCount - 1);
            if (splitMass > throwMass) {
                masses.push(splitMass);
                curMass -= splitMass;
                restCount--;
            }
        }
        if (restCount > 0) {
            splitMass = curMass / restCount;
            if (splitMass < throwMass - 0.001) {
                Logger.warn("GameServer.splitMass: throwMass-splitMass = " + (throwMass - splitMass).toFixed(3) + " (" + mass.toFixed(4) + ", " + count + ")");
            }
            while (restCount > 0) {
                masses.push(splitMass);
                restCount--;
            }
        }
    }
    //Logger.debug("===GameServer.splitMass===");
    //Logger.debug("mass = " + mass.toFixed(3) + "  |  " + Math.sqrt(mass * 100).toFixed(3));
    //var sum = 0;
    //for (var i = 0; i < masses.length; i++) {
    //    Logger.debug("mass[" + i + "] = " + masses[i].toFixed(3) + "  |  " + Math.sqrt(masses[i] * 100).toFixed(3));
    //    sum += masses[i]
    //}
    //Logger.debug("sum  = " + sum.toFixed(3) + "  |  " + Math.sqrt(sum * 100).toFixed(3));
    return masses;
};

GameServer.prototype.splitCells = function (client) {
    // it seems that vanilla uses order by cell age
    var cellToSplit = [];
    for (var i = 0; i < client.cells.length; i++) {
        var cell = client.cells[i];
        if (cell.getSize() < this.config.playerMinSplitSize) {
            continue;
        }
        cellToSplit.push(cell);
        if (cellToSplit.length + client.cells.length >= this.config.playerMaxCells)
            break;
    }
    var splitCells = 0; // How many cells have been split
    for (var i = 0; i < cellToSplit.length; i++) {
        var cell = cellToSplit[i];
        var dx = ~~(client.mouse.x - cell.position.x);
        var dy = ~~(client.mouse.y - cell.position.y);
        var dl = dx * dx + dy * dy;
        if (dl < 1) {
            dx = 1;
            dy = 0;
        }
        var angle = Math.atan2(dx, dy);
        if (isNaN(angle)) angle = Math.PI / 2;
        
        if (this.splitPlayerCell(client, cell, angle, null)) {
            splitCells++;
        }
    }
};

// TODO: replace mass with size (Virus)
GameServer.prototype.splitPlayerCell = function (client, parent, angle, mass) {
    // Returns boolean whether a cell has been split or not. You can use this in the future.
    
    if (client.cells.length >= this.config.playerMaxCells) {
        // Player cell limit
        return false;
    }
    
    var size1 = 0;
    var size2 = 0;
    if (mass == null) {
        size1 = parent.getSplitSize();
        size2 = size1;
    } else {
        size2 = Math.sqrt(mass * 100);
        size1 = Math.sqrt(parent.getSize() * parent.getSize() - size2 * size2);
    }
    if (isNaN(size1) || size1 < this.config.playerMinSize) {
        return false;
    }
    
    // Remove mass from parent cell first
    parent.setSize(size1);
    
    // make a small shift to the cell position to prevent extrusion in wrong direction
    var pos = {
        x: parent.position.x + 40 * Math.sin(angle),
        y: parent.position.y + 40 * Math.cos(angle)
    };
    
    // Create cell
    var newCell = new Entity.PlayerCell(this, client, pos, size2);
    newCell.setBoost(780, angle);
    
    // Add to node list
    this.addNode(newCell);
    return true;
};

GameServer.prototype.canEjectMass = function (client) {
    var tick = this.getTick();
    if (client.lastEject == null) {
        // first eject
        client.lastEject = tick;
        return true;
    }
    var dt = tick - client.lastEject;
    if (dt < this.config.ejectCooldown) {
        // reject (cooldown)
        return false;
    }
    client.lastEject = tick;
    return true;
};

GameServer.prototype.ejectMass = function (client) {
    if (!this.canEjectMass(client))
        return;
    for (var i = 0; i < client.cells.length; i++) {
        var cell = client.cells[i];
        
        if (!cell) {
            continue;
        }
        
        if (cell.getSize() < this.config.playerMinSplitSize) {
            continue;
        }
        var size2 = this.config.ejectSize;
        var sizeLoss = this.config.ejectSizeLoss;
        var sizeSquared = cell.getSizeSquared() - sizeLoss * sizeLoss;
        if (sizeSquared < this.config.playerMinSize * this.config.playerMinSize) {
            continue;
        }
        var size1 = Math.sqrt(sizeSquared);
        
        var dx = client.mouse.x - cell.position.x;
        var dy = client.mouse.y - cell.position.y;
        var dl = dx * dx + dy * dy;
        if (dl < 1) {
            dx = 1;
            dy = 0;
        } else {
            dl = Math.sqrt(dl);
            dx /= dl;
            dy /= dl;
        }
        
        // Remove mass from parent cell first
        cell.setSize(size1);
        
        // Get starting position
        var pos = {
            x: cell.position.x + dx * cell.getSize(),
            y: cell.position.y + dy * cell.getSize()
        };
        
        var angle = Math.atan2(dx, dy);
        if (isNaN(angle)) angle = Math.PI / 2;
        
        // Randomize angle
        angle += (Math.random() * 0.6) - 0.3;
        
        // Create cell
        var ejected = new Entity.EjectedMass(this, null, pos, size2);
        ejected.ejector = cell;
        ejected.setColor(cell.getColor());
        ejected.setBoost(this.config.ejectDistance, angle);
        
        this.addNode(ejected);
    }
};

GameServer.prototype.shootVirus = function (parent, angle) {
    var parentPos = {
        x: parent.position.x,
        y: parent.position.y,
    };
    
    var newVirus = new Entity.Virus(this, null, parentPos, this.config.virusMinSize);
    newVirus.setBoost(780, angle);
    
    // Add to moving cells list
    this.addNode(newVirus);
};

GameServer.prototype.getNearestVirus = function (cell) {
    // Loop through all viruses on the map. There is probably a more efficient way of doing this but whatever
    for (var i = 0; i < this.nodesVirus.length; i++) {
        var check = this.nodesVirus[i];
        if (check === null) continue;
        if (this.checkCellCollision(cell, check) != null) {
            return check;
        }
    }
};

GameServer.prototype.updateMassDecay = function () {
    if (!this.config.playerDecayRate) {
        return;
    }
    var decay = 1 - this.config.playerDecayRate * this.gameMode.decayMod;
    // Loop through all player cells
    for (var i = 0; i < this.clients.length; i++) {
        var playerTracker = this.clients[i].playerTracker;
        for (var j = 0; j < playerTracker.cells.length; j++) {
            var cell = playerTracker.cells[j];
            var size = cell.getSize();
            if (size <= this.config.playerMinSize)
                continue;
            var size = Math.sqrt(size * size * decay);
            size = Math.max(size, this.config.playerMinSize);
            if (size != cell.getSize()) {
                cell.setSize(size);
            }
        }
    }
};

GameServer.prototype.getPlayerById = function (id) {
    if (id == null) return null;
    for (var i = 0; i < this.clients.length; i++) {
        var playerTracker = this.clients[i].playerTracker;
        if (playerTracker.pID == id) {
            return playerTracker;
        }
    }
    return null;
};

GameServer.prototype.checkSkinName = function (skinName) {
    if (!skinName) {
        return true;
    }
    if (skinName.length == 1 || skinName.length > 25) {
        return false;
    }
    if (skinName[0] != '%' /* && skinName[0] != ':' */) {
        return false;
    }
    for (var i = 1; i < skinName.length; i++) {
        var c = skinName.charCodeAt(i);
        if (c < 0x21 || c > 0x7F || c == '/' || c == '\\' || c == ':' || c == '%' || c == '?' || c == '&' || c == '<' || c == '>') {
            return false;
        }
    }
    return true;
};

var fileNameConfig = './gameserver.ini';
var fileNameBadWords = './badwords.txt';
var fileNameIpBan = './ipbanlist.txt';
var fileNameUsers = './userRoles.json';

GameServer.prototype.loadConfig = function () {
    try {
        if (!fs.existsSync(fileNameConfig)) {
            // No config
            Logger.warn("Config not found... Generating new config");
            // Create a new config
            fs.writeFileSync(fileNameConfig, ini.stringify(this.config), 'utf-8');
        } else {
            // Load the contents of the config file
            var load = ini.parse(fs.readFileSync(fileNameConfig, 'utf-8'));
            // Replace all the default config's values with the loaded config's values
            for (var key in load) {
                if (this.config.hasOwnProperty(key)) {
                    this.config[key] = load[key];
                } else {
                    Logger.error("Unknown gameserver.ini value: " + key);
                }
            }
        }
    } catch (err) {
        Logger.error(err.stack);
        Logger.error("Failed to load " + fileNameConfig + ": " + err.message);
    }
    // check config (min player size = 32 => mass = 10.24)
    this.config.playerMinSize = Math.max(32, this.config.playerMinSize);
    Logger.setVerbosity(this.config.logVerbosity);
    Logger.setFileVerbosity(this.config.logFileVerbosity);
};

GameServer.prototype.loadBadWords = function () {
    try {
        if (!fs.existsSync(fileNameBadWords)) {
            Logger.warn(fileNameBadWords + " not found");
        } else {
            var words = fs.readFileSync(fileNameBadWords, 'utf-8');
            words = words.split(/[\r\n]+/);
            words = words.map(function (arg) { return arg.trim().toLowerCase(); });
            words = words.filter(function (arg) { return !!arg; });
            this.badWords = words;
            Logger.info(this.badWords.length + " bad words loaded");
        }
    } catch (err) {
        Logger.error(err.stack);
        Logger.error("Failed to load " + fileNameBadWords + ": " + err.message);
    }
};

GameServer.prototype.checkBadWord = function (value) {
    if (!value) return false;
    value = value.toLowerCase().trim();
    if (!value) return false;
    for (var i = 0; i < this.badWords.length; i++) {
        if (value.indexOf(this.badWords[i]) >= 0) {
            return true;
        }
    }
    return false;
};

GameServer.prototype.changeConfig = function (name, value) {
    if (value == null || isNaN(value)) {
        Logger.warn("Invalid value: " + value);
        return;
    }
    if (!this.config.hasOwnProperty(name)) {
        Logger.warn("Unknown config value: " + name);
        return;
    }
    this.config[name] = value;
    
    // update/validate
    this.config.playerMinSize = Math.max(32, this.config.playerMinSize);
    Logger.setVerbosity(this.config.logVerbosity);
    Logger.setFileVerbosity(this.config.logFileVerbosity);
    
    Logger.print("Set " + name + " = " + this.config[name]);
};

GameServer.prototype.loadUserList = function () {
    try {
        this.userList = [];
        if (!fs.existsSync(fileNameUsers)) {
            Logger.warn(fileNameUsers + " is missing.");
            return;
        }
        var usersJson = fs.readFileSync(fileNameUsers, 'utf-8');
        var list = JSON.parse(usersJson.trim());
        for (var i = 0; i < list.length; ) {
            var item = list[i];
            if (!item.hasOwnProperty("ip") ||
                !item.hasOwnProperty("password") ||
                !item.hasOwnProperty("role") ||
                !item.hasOwnProperty("name")) {
                list.splice(i, 1);
                continue;
            }
            if (!item.password || !item.password.trim()) {
                Logger.warn("User account \"" + item.name + "\" disabled");
                list.splice(i, 1);
                continue;
            }
            if (item.ip) {
                item.ip = item.ip.trim();
            }
            item.password = item.password.trim();
            if (!UserRoleEnum.hasOwnProperty(item.role)) {
                Logger.warn("Unknown user role: " + role);
                item.role = UserRoleEnum.USER;
            } else {
                item.role = UserRoleEnum[item.role];
            }
            item.name = (item.name || "").trim();
            i++;
        }
        this.userList = list;
        Logger.info(this.userList.length + " user records loaded.");
    } catch (err) {
        Logger.error(err.stack);
        Logger.error("Failed to load " + fileNameUsers + ": " + err.message);
    }
}

GameServer.prototype.userLogin = function (ip, password) {
    if (!password) return null;
    password = password.trim();
    if (!password) return null;
    for (var i = 0; i < this.userList.length; i++) {
        var user = this.userList[i];
        if (user.password != password)
            continue;
        if (user.ip && user.ip != ip)
            continue;
        return user;
    }
    return null;
};

GameServer.prototype.loadIpBanList = function () {
    try {
        if (fs.existsSync(fileNameIpBan)) {
            // Load and input the contents of the ipbanlist file
            this.ipBanList = fs.readFileSync(fileNameIpBan, "utf8").split(/[\r\n]+/).filter(function (x) {
                return x != ''; // filter empty lines
            });
            Logger.info(this.ipBanList.length + " IP ban records loaded.");
        } else {
            Logger.warn(fileNameIpBan + " is missing.");
        }
    } catch (err) {
        Logger.error(err.stack);
        Logger.error("Failed to load " + fileNameIpBan + ": " + err.message);
    }
};

GameServer.prototype.saveIpBanList = function () {
    try {
        var blFile = fs.createWriteStream(fileNameIpBan);
        // Sort the blacklist and write.
        this.ipBanList.sort().forEach(function (v) {
            blFile.write(v + '\n');
        });
        blFile.end();
        Logger.info(this.ipBanList.length + " IP ban records saved.");
    } catch (err) {
        Logger.error(err.stack);
        Logger.error("Failed to save " + fileNameIpBan + ": " + err.message);
    }
};

GameServer.prototype.checkIpBan = function (ipAddress) {
    if (!this.ipBanList || this.ipBanList.length == 0 || ipAddress == "127.0.0.1") {
        return false;
    }
    if (this.ipBanList.indexOf(ipAddress) >= 0) {
        return true;
    }
    var ipBin = ipAddress.split('.');
    if (ipBin.length != 4) {
        // unknown IP format
        return false;
    }
    var subNet2 = ipBin[0] + "." + ipBin[1] + ".*.*";
    if (this.ipBanList.indexOf(subNet2) >= 0) {
        return true;
    }
    var subNet1 = ipBin[0] + "." + ipBin[1] + "." + ipBin[2] + ".*";
    if (this.ipBanList.indexOf(subNet1) >= 0) {
        return true;
    }
    return false;
};

GameServer.prototype.banIp = function (ip) {
    var ipBin = ip.split('.');
    if (ipBin.length != 4) {
        Logger.warn("Invalid IP format: " + ip);
        return;
    }
    if (ipBin[0] == "127") {
        Logger.warn("Cannot ban localhost");
        return;
    }
    if (this.ipBanList.indexOf(ip) >= 0) {
        Logger.warn(ip + " is already in the ban list!");
        return;
    }
    this.ipBanList.push(ip);
    if (ipBin[2] == "*" || ipBin[3] == "*") {
        Logger.print("The IP sub-net " + ip + " has been banned");
    } else {
        Logger.print("The IP " + ip + " has been banned");
    }
    this.clients.forEach(function (socket) {
        // If already disconnected or the ip does not match
        if (socket == null || !socket.isConnected || !this.checkIpBan(socket.remoteAddress))
            return;
        
        // remove player cells
        socket.playerTracker.cells.forEach(function (cell) {
            this.removeNode(cell);
        }, this);
        
        // disconnect
        socket.close(1000, "Banned from server");
        var name = socket.playerTracker.getFriendlyName();
        Logger.print("Banned: \"" + name + "\" with Player ID " + socket.playerTracker.pID);
        this.sendChatMessage(null, null, "Banned \"" + name + "\""); // notify to don't confuse with server bug
    }, this);
    this.saveIpBanList();
};

GameServer.prototype.unbanIp = function (ip) {
    var index = this.ipBanList.indexOf(ip);
    if (index < 0) {
        Logger.warn("IP " + ip + " is not in the ban list!");
        return;
    }
    this.ipBanList.splice(index, 1);
    Logger.print("Unbanned IP: " + ip);
    this.saveIpBanList();
};

// Kick player by ID. Use ID = 0 to kick all players
GameServer.prototype.kickId = function (id) {
    var count = 0;
    this.clients.forEach(function (socket) {
        if (socket.isConnected == false)
            return;
        if (id != 0 && socket.playerTracker.pID != id)
            return;
        // remove player cells
        socket.playerTracker.cells.forEach(function (cell) {
            this.removeNode(cell);
        }, this);
        // disconnect
        socket.close(1000, "Kicked from server");
        var name = socket.playerTracker.getFriendlyName();
        Logger.print("Kicked \"" + name + "\"");
        this.sendChatMessage(null, null, "Kicked \"" + name + "\""); // notify to don't confuse with server bug
        count++;
    }, this);
    if (count > 0)
        return;
    if (id == 0)
        Logger.warn("No players to kick!");
    else
        Logger.warn("Player with ID " + id + " not found!");
};

// Stats server

GameServer.prototype.startStatsServer = function (port) {
    // Do not start the server if the port is negative
    if (port < 1) {
        return;
    }
    
    // Create stats
    this.stats = "Test";
    this.getStats();
    
    // Show stats
    this.httpServer = http.createServer(function (req, res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.writeHead(200);
        res.end(this.stats);
    }.bind(this));
    this.httpServer.on('error', function (err) {
        Logger.error("Stats Server: " + err.message);
    });
    
    var getStatsBind = this.getStats.bind(this);
    this.httpServer.listen(port, function () {
        // Stats server
        Logger.info("Started stats server on port " + port);
        setInterval(getStatsBind, this.config.serverStatsUpdate * 1000);
    }.bind(this));
};

GameServer.prototype.getStats = function () {
    // Get server statistics
    var totalPlayers = 0;
    var alivePlayers = 0;
    var spectatePlayers = 0;
    for (var i = 0; i < this.clients.length; i++) {
        var socket = this.clients[i];
        if (socket == null || !socket.isConnected)
            continue;
        totalPlayers++;
        if (socket.playerTracker.cells.length > 0)
            alivePlayers++;
        else
            spectatePlayers++;
    }
    var s = {
        'server_name': this.config.serverName,
        'server_chat': this.config.serverChat ? "true" : "false",
        'border_width': this.border.width,
        'border_height': this.border.height,
        'gamemode': this.gameMode.name,
        'max_players': this.config.serverMaxConnections,
        'current_players': totalPlayers,
        'alive': alivePlayers,
        'spectators': spectatePlayers,
        'update_time': this.updateTimeAvg.toFixed(3),
        'uptime': Math.round((this.stepDateTime - this.startTime) / 1000 / 60),
        'start_time': this.startTime
    };
    this.stats = JSON.stringify(s);
};

// Ping the server tracker.
// To list us on the server tracker located at http://ogar.mivabe.nl/master
// Should be called every 30 seconds
GameServer.prototype.pingServerTracker = function () {
    // Get server statistics
    var totalPlayers = 0;
    var alivePlayers = 0;
    var spectatePlayers = 0;
    var robotPlayers = 0;
    for (var i = 0; i < this.clients.length; i++) {
        var socket = this.clients[i];
        if (socket == null || socket.isConnected === false)
            continue;
        if (socket.isConnected == null) {
            robotPlayers++;
        }
        else {
            totalPlayers++;
            if (socket.playerTracker.cells.length > 0)
                alivePlayers++;
            else
                spectatePlayers++;
        }
    }
    
    // Send Ping...
    
    // ogar-tracker.tk
    var obj = {
        port: this.config.serverPort,               // [mandatory] web socket port which listens for game client connections
        name: this.config.serverName,               // [mandatory] server name
        mode: this.gameMode.name,                   // [mandatory] game mode
        total: totalPlayers,                        // [mandatory] total online players (server bots is not included!)
        alive: alivePlayers,                        // [mandatory] alive players (server bots is not included!)
        spect: spectatePlayers,                     // [mandatory] spectate players (server bots is not included!)
        robot: robotPlayers,                        // [mandatory] server bots
        limit: this.config.serverMaxConnections,    // [mandatory] maximum allowed connection count
        protocol: 'M',                              // [mandatory] required protocol id or 'M' for multiprotocol (if all protocols is supported)   
        uptime: process.uptime() >>> 0,             // [mandatory] server uptime [seconds]
        w: this.border.width >>> 0,                 // [mandatory] map border width [integer]
        h: this.border.height >>> 0,                // [mandatory] map border height [integer]
        version: 'MultiOgar ' + pjson.version,      // [optional]  server version
        stpavg: this.updateTimeAvg >>> 0,           // [optional]  average server loop time
        chat: this.config.serverChat ? 1 : 0,       // [optional]  0 - chat disabled, 1 - chat enabled
        os: os.platform()                           // [optional]  operating system
    };
    trackerRequest({
        host: 'ogar-tracker.tk',
        port: 80,
        path: '/api/ping',
        method: 'PUT'
    }, 'application/json', JSON.stringify(obj));
    

    // mivabe.nl
    // Why don't just to use JSON?
    var data = 'current_players=' + totalPlayers +
               '&alive=' + alivePlayers +
               '&spectators=' + spectatePlayers +
               '&max_players=' + this.config.serverMaxConnections +
               '&sport=' + this.config.serverPort +
               '&gamemode=[*] ' + this.gameMode.name +  // we add [*] to indicate that this is multi-server
               '&agario=true' +                         // protocol version
               '&name=Unnamed Server' +                 // we cannot use it, because other value will be used as dns name
               '&opp=' + os.platform() + ' ' + os.arch() + // "win32 x64"
               '&uptime=' + process.uptime() +          // Number of seconds server has been running
               '&version=MultiOgar ' + pjson.version +
               '&start_time=' + this.startTime;
    trackerRequest({
        host: 'ogar.mivabe.nl',
        port: 80,
        path: '/master',
        method: 'POST'
    }, 'application/x-www-form-urlencoded', data);
    
    // c0nsume.me
    trackerRequest({
        host: 'c0nsume.me',
        port: 80,
        path: '/tracker.php',
        method: 'POST'
    }, 'application/x-www-form-urlencoded', data);
};

function trackerRequest(options, type, body) {
    if (options.headers == null)
        options.headers = {};
    options.headers['user-agent'] = 'MultiOgar' + pjson.version;
    options.headers['content-type'] = type;
    options.headers['content-length'] = body == null ? 0 : Buffer.byteLength(body, 'utf8');
    var req = http.request(options, function (res) {
        if (res.statusCode != 200) {
            Logger.writeError("[Tracker][" + options.host + "]: statusCode = " + res.statusCode);
            return;
        }
        res.setEncoding('utf8');
    });
    req.on('error', function (err) {
        Logger.writeError("[Tracker][" + options.host + "]: " + err);
    });
    req.shouldKeepAlive = false;
    req.on('close', function () {
        req.destroy();
    });
    req.write(body);
    req.end()
};