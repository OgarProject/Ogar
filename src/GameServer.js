// Library imports
var WebSocket = require('ws');
var http = require('http');
var fs = require("fs");
var ini = require('./modules/ini.js');
var os = require("os");
var QuadNode = require('./QuadNode.js');

// Project imports
var Packet = require('./packet');
var PlayerTracker = require('./PlayerTracker');
var PacketHandler = require('./PacketHandler');
var Entity = require('./entity');
var Gamemode = require('./gamemodes');
var BotLoader = require('./ai/BotLoader');
var Logger = require('./modules/log');

// GameServer implementation
function GameServer() {
    // Startup
    this.run = true;
    this.lastNodeId = 1;
    this.lastPlayerId = 1;
    this.clients = [];
    this.largestClient; // Required for spectators
    this.nodes = [];
    this.nodesVirus = []; // Virus nodes
    this.nodesEjected = []; // Ejected mass nodes
    this.nodesPlayer = []; // Nodes controlled by players
    this.quadTree = null;

    this.currentFood = 0;
    this.movingNodes = []; // For move engine
    this.leaderboard = [];
    this.leaderboardType = -1; // no type

    this.bots = new BotLoader(this);
    this.log = new Logger();
    this.commands; // Command handler

    // Main loop tick
    this.startTime = +new Date;
    this.timeStamp = 0;
    this.updateTime = 0;
    this.updateTimeAvg = 0;
    this.timerLoopBind = null;
    this.mainLoopBind = null;
    
    this.tickCounter = 0;
    this.tickSpawn = 0; // Used with spawning food


    // Config
    this.config = { // Border - Right: X increases, Down: Y increases (as of 2015-05-20)
        serverTimeout: 30,          // Seconds to keep connection alive for non-responding client
        serverMaxConnections: 64,   // Maximum amount of connections to the server. (0 for no limit)
        serverIpLimit: 4,           // Maximum amount of connections from the same IP (0 for no limit)
        serverPort: 443,            // Server port
        serverTracker: 0,           // Set to 1 if you want to show your server on the tracker http://ogar.mivabe.nl/master
        serverGamemode: 0,          // Gamemode, 0 = FFA, 1 = Teams
        serverBots: 0,              // Amount of player bots to spawn
        serverViewBaseX: 1920,      // Base client screen resolution. Used to calculate view area. Warning: high values may cause lag
        serverViewBaseY: 1080, 
        serverStatsPort: 88,        // Port for stats server. Having a negative number will disable the stats server.
        serverStatsUpdate: 60,      // Amount of seconds per update for the server stats
        serverLogLevel: 1,          // Logging level of the server. 0 = No logs, 1 = Logs the console, 2 = Logs console and ip connections
        serverScrambleCoords: 1,    // Toggles scrambling of coordinates. 0 = No scrambling, 1 = scrambling. Default is 1.
        serverMaxLB: 10,            // Controls the maximum players displayed on the leaderboard.
        serverChat: 1,              // Set to 1 to allow chat; 0 to disable chat.
        borderLeft: 0,              // Left border of map (Vanilla value: 0)
        borderRight: 6000,          // Right border of map (Vanilla value: 14142.135623730952)
        borderTop: 0,               // Top border of map (Vanilla value: 0)
        borderBottom: 6000,         // Bottom border of map (Vanilla value: 14142.135623730952)
        spawnInterval: 20,          // The interval between each food cell spawn in ticks (1 tick = 50 ms)
        foodSpawnAmount: 10,        // The amount of food to spawn per interval
        foodStartAmount: 100,       // The starting amount of food in the map
        foodMaxAmount: 500,         // Maximum food cells on the map
        foodMass: 1,                // Starting food size (In mass)
        foodMassGrow: 1,            // Enable food mass grow ?
        foodMassGrowPossiblity: 50, // Chance for a food to has the ability to be self growing
        foodMassLimit: 4,           // Maximum mass for a food can grow
        virusMinAmount: 10,         // Minimum amount of viruses on the map.
        virusMaxAmount: 50,         // Maximum amount of viruses on the map. If this amount is reached, then ejected cells will pass through viruses.
        virusStartMass: 100,        // Starting virus size (In mass)
        virusFeedAmount: 7,         // Amount of times you need to feed a virus to shoot it
        ejectMass: 13.69,           // Mass of ejected cells
        ejectMassCooldown: 3,       // min ticks between ejects
        ejectMassLoss: 15,          // Mass lost when ejecting cells
        ejectSpawnPlayer: 50,       // Chance for a player to spawn from ejected mass
        playerStartMass: 10.24,     // Starting mass of the player cell.
        playerBotGrowEnabled: 1,    // If 0, eating a cell with less than 17 mass while cell has over 625 wont gain any mass
        playerMaxMass: 22500,       // Maximum mass a player can have
        playerMinMassEject: 32,     // Mass required to eject a cell
        playerMinMassSplit: 36,     // Mass required to split
        playerMaxCells: 16,         // Max cells the player is allowed to have
        playerRecombineTime: 30,    // Base amount of seconds before a cell is allowed to recombine
        playerMassAbsorbed: 1.0,    // Fraction of player cell's mass gained upon eating
        playerMassDecayRate: .002,  // Amount of mass lost per second
        playerMinMassDecay: 10.24,  // Minimum mass for decay to occur
        playerMaxNickLength: 15,    // Maximum nick length
        playerSpeed: 1,             // Player speed multiplier
        playerDisconnectTime: 60,   // The amount of seconds it takes for a player cell to be removed after disconnection (If set to -1, cells are never removed)
        tourneyMaxPlayers: 12,      // Maximum amount of participants for tournament style game modes
        tourneyPrepTime: 10,        // Amount of ticks to wait after all players are ready (1 tick = 1000 ms)
        tourneyEndTime: 30,         // Amount of ticks to wait after a player wins (1 tick = 1000 ms)
        tourneyTimeLimit: 20,       // Time limit of the game, in minutes.
        tourneyAutoFill: 0,         // If set to a value higher than 0, the tournament match will automatically fill up with bots after this amount of seconds
        tourneyAutoFillPlayers: 1,  // The timer for filling the server with bots will not count down unless there is this amount of real players
    };
    
    this.ipBanList = [];
    
    // Parse config
    this.loadConfig();
    this.loadIpBanList();

    // Gamemodes
    this.gameMode = Gamemode.get(this.config.serverGamemode);
}

module.exports = GameServer;

GameServer.prototype.start = function() {
    this.timerLoopBind = this.timerLoop.bind(this);
    this.mainLoopBind = this.mainLoop.bind(this);
    
    // Logging
    this.log.setup(this);
    
    // Gamemode configurations
    this.gameMode.onServerInit(this);
    
    var options = {
        port: this.config.serverPort,
        perMessageDeflate: false
    };

    // Start the server
    this.socketServer = new WebSocket.Server(options, this.onServerSocketOpen.bind(this));
    this.socketServer.on('error', this.onServerSocketError.bind(this));
    this.socketServer.on('connection', this.onClientSocketOpen.bind(this));

    this.startStatsServer(this.config.serverStatsPort);
};

GameServer.prototype.onServerSocketError = function (error) {
    switch (error.code) {
        case "EADDRINUSE":
            console.log("[Error] Server could not bind to port " + this.config.serverPort + "! Please close out of Skype or change 'serverPort' in gameserver.ini to a different number.");
            break;
        case "EACCES":
            console.log("[Error] Please make sure you are running Ogar with root privileges.");
            break;
        default:
            console.log("[Error] Unhandled error code: " + error.code);
            break;
    }
    process.exit(1); // Exits the program
};

GameServer.prototype.onServerSocketOpen = function () {
    var bound = {
        minx: this.config.borderLeft,
        miny: this.config.borderTop,
        maxx: this.config.borderRight,
        maxy: this.config.borderBottom
    };
    this.quadTree = new QuadNode(bound, 4, 1024);

    // Spawn starting food
    this.startingFood();
    
    // Start Main Loop
    setTimeout(this.timerLoopBind, 1);
    
    // Done
    console.log("[Game] Listening on port " + this.config.serverPort);
    console.log("[Game] Current game mode is " + this.gameMode.name);
    
    // Player bots (Experimental)
    if (this.config.serverBots > 0) {
        for (var i = 0; i < this.config.serverBots; i++) {
            this.bots.addBot();
        }
        console.log("[Game] Loaded " + this.config.serverBots + " player bots");
    }
};

GameServer.prototype.onClientSocketOpen = function (ws) {
    // Check blacklist first (if enabled).
    if (this.ipBanList && this.ipBanList.length > 0 && this.ipBanList.indexOf(ws._socket.remoteAddress) >= 0) {
        // IP banned
        ws.close(1000, "IP banned");
        return;
    }
    var totalConnections = 0;
    var ipConnections = 0;
    for (var i = 0; i < this.clients.length; i++) {
        var socket = this.clients[i];
        if (socket == null || socket.isConnected == null)
            continue;
        totalConnections++;
        if (socket.isConnected && socket.remoteAddress == ws._socket.remoteAddress)
            ipConnections++;
    }
    if (this.config.serverMaxConnections > 0 && totalConnections >= this.config.serverMaxConnections) {
        // Server full
        ws.close(1000, "No slots");
        return;
    }
    if (this.config.serverIpLimit > 0 && ipConnections >= this.config.serverIpLimit) {
        // IP limit reached
        ws.close(1000, "IP limit reached");
        return;
    }
    ws.isConnected = true;
    ws.remoteAddress = ws._socket.remoteAddress;
    ws.remotePort = ws._socket.remotePort;
    ws.lastAliveTime = +new Date;
    this.log.onConnect(ws.remoteAddress); // Log connections
    
    ws.playerTracker = new PlayerTracker(this, ws);
    ws.packetHandler = new PacketHandler(this, ws);
    
    var gameServer = this;
    var onMessage = function (message) {
        gameServer.onClientSocketMessage(ws, message);
    };
    var onError = function (error) {
        gameServer.onClientSocketError(ws, error);
    };
    var onClose = function (reason) {
        gameServer.onClientSocketClose(ws, reason);
    };
    ws.on('message', onMessage);
    ws.on('error', onError);
    ws.on('close', onClose);
    this.clients.push(ws);
};

GameServer.prototype.onClientSocketClose = function (ws, code) {
    this.log.onDisconnect(ws.remoteAddress);
    
    ws.isConnected = false;
    ws.sendPacket = function (data) { };
    ws.closeReason = { code: ws._closeCode, message: ws._closeMessage };
    ws.closeTime = +new Date;

    this.getGrayColor
    // disconnected effect
    ws.playerTracker.cells.forEach(function (cell) {
        cell.setColor(this.getGrayColor(cell.getColor()));
    }, this);
};

GameServer.prototype.onClientSocketError = function (ws, error) {
    ws.sendPacket = function (data) { };
    ws.close(1002, "Socket error");
};

GameServer.prototype.onClientSocketMessage = function (ws, message) {
    ws.packetHandler.handleMessage(message);
};


GameServer.prototype.getTick = function () {
    return this.tickCounter;
};

GameServer.prototype.getMode = function () {
    return this.gameMode;
};

GameServer.prototype.getNextNodeId = function() {
    // Resets integer
    if (this.lastNodeId > 2147483647) {
        this.lastNodeId = 1;
    }
    return this.lastNodeId++ >>> 0;
};

GameServer.prototype.getNewPlayerID = function() {
    // Resets integer
    if (this.lastPlayerId > 2147483647) {
        this.lastPlayerId = 1;
    }
    return this.lastPlayerId++ >>> 0;
};

GameServer.prototype.getRandomPosition = function() {
    var width = this.config.borderRight - this.config.borderLeft;
    var height = this.config.borderBottom - this.config.borderTop;
    return {
        x: Math.floor(this.config.borderLeft + width * Math.random()),
        y: Math.floor(this.config.borderTop + height * Math.random())
    };
};

GameServer.prototype.getRandomSpawn = function(mass) {
    // Random and secure spawns for players and viruses
    var size = Math.sqrt(mass * 100);
    var pos = this.getRandomPosition();
    var unsafe = this.willCollide(size, pos, mass == this.config.virusStartMass);
    if (!unsafe) return pos;
    
    // just shift offset and try again
    var attempt = 1;
    var maxAttempt = 4;
    var w = this.config.borderRight - this.config.borderLeft;
    var h = this.config.borderBottom - this.config.borderTop;
    var cx = this.config.borderLeft + w / 2;
    var cy = this.config.borderTop + w / 2;
    var dirx = pos.x < cx ? 1 : -1;
    var diry = pos.y < cy ? 1 : -1;
    var stepx = w / (2 * maxAttempt);
    var stepy = h / (2 * maxAttempt);
    while (unsafe && attempt < maxAttempt) {
        pos.x += stepx * dirx;
        pos.y += stepy * diry;
        unsafe = this.willCollide(size, pos, mass == this.config.virusStartMass);
        attempt++;
    }
    
    // If it reached attempt maxAttempt, warn the user
    //if (unsafe) {
    //    console.log("[Server] Entity was force spawned near viruses/playercells after "+attempt+" attempts.");
    //    console.log("[Server] If this message keeps appearing, check your config, especially start masses for players and viruses.");
    //}

    return pos;
};

GameServer.prototype.getGrayColor = function (rgb) {
    var luminance = Math.min(255, (rgb.r * 0.2125 + rgb.g * 0.7154 + rgb.b * 0.0721)) >>> 0;
    return {
        r: luminance,
        g: luminance,
        b: luminance
    };
};

GameServer.prototype.getRandomColor = function() {
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
    var quadItem = node.quadItem;
    // check for change
    if (node.position.x == quadItem.x &&
        node.position.y == quadItem.y &&
        node.getSize() == quadItem.size) {
        // no change
        return;
    }
    // update quadTree
    quadItem.x = node.position.x;
    quadItem.y = node.position.y;
    quadItem.size = node.getSize();
    quadItem.bound = {
        minx: node.quadItem.x - node.quadItem.size,
        miny: node.quadItem.y - node.quadItem.size,
        maxx: node.quadItem.x + node.quadItem.size,
        maxy: node.quadItem.y + node.quadItem.size
    };
    this.quadTree.update(quadItem);
};


GameServer.prototype.addNode = function(node) {
    node.quadItem = {
        cell: node,
        x: node.position.x,
        y: node.position.y,
        size: node.getSize()
    };
    node.quadItem.bound = {
        minx: node.quadItem.x - node.quadItem.size,
        miny: node.quadItem.y - node.quadItem.size,
        maxx: node.quadItem.x + node.quadItem.size,
        maxy: node.quadItem.y + node.quadItem.size
    };
    this.quadTree.insert(node.quadItem);
    
    this.nodes.push(node);

    // Adds to the owning player's screen excluding ejected cells
    if (node.owner && node.cellType != 3) {
        node.setColor(node.owner.color);
        node.owner.cells.push(node);
        node.owner.socket.sendPacket(new Packet.AddNode(node.owner, node));
    }

    // Special on-add actions
    node.onAdd(this);
};

GameServer.prototype.removeNode = function(node) {
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

GameServer.prototype.updateSpawn = function() {
    // Spawn food
    this.tickSpawn++;
    if (this.tickSpawn >= this.config.spawnInterval) {
        this.tickSpawn = 0; // Reset
        
        this.updateFood(); // Spawn food
        this.virusCheck(); // Spawn viruses
    }
};

GameServer.prototype.updateClients = function () {
    for (var i = 0; i < this.clients.length; i++) {
        var socket = this.clients[i];
        socket.playerTracker.update();
    }
    // remove dead clients
    for (var i = 0; i < this.clients.length; ) {
        var socket = this.clients[i];
        if (socket.playerTracker.isRemoved) {
            this.clients.splice(i, 1);
        } else {
            i++;
        }
    }
};

GameServer.prototype.updateLeaderboard = function () {
    // Update leaderboard with the gamemode's method
    if ((this.tickCounter % 25) == 0) {
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
    }
};

GameServer.prototype.onChatMessage = function (from, to, message) {
    if (message == null) return;
    message = message.trim();
    if (message == "") return;
    if (message.length > 128) message = message.slice(0, 128);
    //console.log("[CHAT] " + (from!=null && from.getName().length>0 ? from.getName() : "Spectator") + ": " + message);
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
    var timeStep = this.updateTimeAvg >> 0;
    timeStep += 5;
    timeStep = Math.max(timeStep, 40);
    
    var ts = new Date().getTime();
    var dt = ts - this.timeStamp;
    if (dt < timeStep - 5) {
        setTimeout(this.timerLoopBind, ((timeStep-5) - dt) >> 0);
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

GameServer.prototype.mainLoop = function() {
    var tStart = new Date().getTime();
    
    // Loop main functions
    this.updateMoveEngine();
    this.updateSpawn();
    this.gameMode.onTick(this);
    this.updateCells();
    this.updateClients();
    this.updateLeaderboard();
    
    // ping server tracker
    if (this.config.serverTracker && (this.getTick() % (30000/40)) == 0) {
        this.pingServerTracker();
    }
    
    //this.tt = 0;
    //this.tc = 0;
    //var t = process.hrtime();
    //this.updateMoveEngine();
    //this.t1 = toTime(process.hrtime(t));
    //t = process.hrtime();
    //this.updateSpawn();
    //this.t2 = toTime(process.hrtime(t));
    //t = process.hrtime();
    //this.gameMode.onTick(this);
    //this.t3 = toTime(process.hrtime(t));
    //t = process.hrtime();
    //this.updateCells();
    //this.t4 = toTime(process.hrtime(t));
    //t = process.hrtime();
    //this.updateClients();
    //this.t5 = toTime(process.hrtime(t));
    //t = process.hrtime();
    //this.updateLeaderboard();
    //this.t6 = toTime(process.hrtime(t));
    //function toTime(tscTicks) {
    //    return tscTicks[0] * 1000 + tscTicks[1] / 1000000;
    //}
    
    this.tickCounter++;
    var tEnd = new Date().getTime();
    this.updateTime = tEnd - tStart;
};

GameServer.prototype.startingFood = function() {
    // Spawns the starting amount of food cells
    for (var i = 0; i < this.config.foodStartAmount; i++) {
        this.spawnFood();
    }
};

GameServer.prototype.updateFood = function() {
    var toSpawn = Math.min(this.config.foodSpawnAmount, (this.config.foodMaxAmount - this.currentFood));
    for (var i = 0; i < toSpawn; i++) {
        this.spawnFood();
    }
};

GameServer.prototype.spawnFood = function() {
    var f = new Entity.Food(this.getNextNodeId(), null, this.getRandomPosition(), this.config.foodMass, this);
    f.setColor(this.getRandomColor());

    this.addNode(f);
    this.currentFood++;
};

GameServer.prototype.spawnPlayer = function(player, pos, mass) {
    if (mass == null) { // Get starting mass
        mass = this.config.playerStartMass;
    }
    if (pos == null) { // Get random pos
        pos = this.getRandomSpawn(mass);
    }

    // Spawn player and add to world
    var cell = new Entity.PlayerCell(this.getNextNodeId(), player, pos, mass, this);
    this.addNode(cell);

    // Set initial mouse coords
    player.mouse = {
        x: pos.x,
        y: pos.y
    };
};

GameServer.prototype.virusCheck = function() {
    // Checks if there are enough viruses on the map
    if (this.nodesVirus.length < this.config.virusMinAmount) {
        // Spawns a virus
        var pos = this.getRandomSpawn(this.config.virusStartMass);
        
        var v = new Entity.Virus(this.getNextNodeId(), null, pos, this.config.virusStartMass, this);
        this.addNode(v);
    }
};

GameServer.prototype.willCollide = function (size, pos, isVirus) {
    // Look if there will be any collision with the current nodes
    var bound = {
        minx: pos.x - size - 10,
        miny: pos.y - size - 10,
        maxx: pos.x + size + 10,
        maxy: pos.y + size + 10
    };
    return this.quadTree.any(
        bound, 
        function (item) {
            return item.cell.cellType != 1; // ignore food
        });
};

GameServer.prototype.getDist = function (x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - x1;
    return Math.sqrt(dx * dx + dy * dy);
};

GameServer.prototype.abs = function (x) {
    return x < 0 ? -x : x;
};

// Checks cells for collision.
// Returns collision manifold or null if there is no collision
GameServer.prototype.checkCellCollision = function(cell, check) {
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
    var nx = manifold.dx * invd;
    var ny = manifold.dy * invd;
    
    // body penetration distance
    var penetration = manifold.r - d;
    if (penetration <= 0) return;
    
    // penetration vector = penetration * normal
    var px = penetration * nx;
    var py = penetration * ny;
    
    // body impulse
    var totalMass = manifold.cell1.getMass() + manifold.cell2.getMass();
    if (totalMass <= 0) return;
    var invTotalMass = 1 / totalMass;
    var impulse1 = manifold.cell2.getMass() * invTotalMass;
    var impulse2 = manifold.cell1.getMass() * invTotalMass;
    
    // apply extrusion force
    manifold.cell1.position.x -= px * impulse1;
    manifold.cell1.position.y -= py * impulse1;
    manifold.cell2.position.x += px * impulse2;
    manifold.cell2.position.y += py * impulse2;
    // clip to border bounds
    manifold.cell1.checkBorder(border);
    manifold.cell2.checkBorder(border);
    // update quadTree
    // it's too heavy operation we will update it when resolution will be completed
    //this.updateNodeQuad(manifold.cell1);
    //this.updateNodeQuad(manifold.cell2);
};

// Checks if collision is rigid body collision
GameServer.prototype.checkRigidCollision = function (manifold) {
    if (!manifold.cell1.owner || !manifold.cell2.owner)
        return false;
    // The same owner
    if (manifold.cell1.owner == manifold.cell2.owner) {
        var tick = this.getTick();
        if ((manifold.cell1.boostDistance > 0 && manifold.cell1.getAge(tick) < 15) ||
            (manifold.cell2.boostDistance > 0 && manifold.cell2.getAge(tick) < 15)) {
            // just splited => ignore
            return false;
        }
        if (manifold.cell1.owner.mergeOverride)
            return false;
        // not force remerge => check if can remerge
        if (!manifold.cell1.canRemerge() || !manifold.cell2.canRemerge()) {
            // cannot remerge => rigid
            return true;
        }
        return false;
    }
    // Different owners
    if (this.gameMode.haveTeams) {
        // Team check
        if (manifold.cell1.owner.getTeam() == manifold.cell2.owner.getTeam()) {
            // cannot eat team member => rigid
            return true;
        }
    }
    return false;
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
    var eatDistance = maxCell.getSize() - minCell.getSize() / Math.PI;
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
        if (minCell.getSize() * 1.15 > maxCell.getSize()) {
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
    
    // Consume effect
    minCell.onConsume(maxCell, this);
    
    // Remove cell
    minCell.setKiller(maxCell);
    this.removeNode(minCell);
};

GameServer.prototype.updateMoveEngine = function () {
    var border = {
        left: this.config.borderLeft,
        top: this.config.borderTop,
        right: this.config.borderRight,
        bottom: this.config.borderBottom
    };
    // Move player cells
    for (var i in this.clients) {
        var client = this.clients[i].playerTracker;
        for (var j = 0; j < client.cells.length; j++) {
            var cell1 = client.cells[j];
            if (cell1 == null || cell1.isRemoved)
                continue;
            cell1.moveUser(border);
            cell1.move(border);
            this.updateNodeQuad(cell1);
        }
    }
    
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
    for (var z = 0; z < 2; z++) { // loop for better rigid body resolution quality (slow)
        for (var k = 0; k < rigidCollisions.length; k++) {
            var c = rigidCollisions[k];
            var manifold = this.checkCellCollision(c.cell1, c.cell2);
            if (manifold == null) continue;
            this.resolveRigidCollision(manifold, border);
            // position changed! don't forgot to update quad-tree
        }
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
    eatCollisions = null;
    
    //this.gameMode.onCellMove(cell1, this);
    
    // Recycle unused moving nodes
    for (var i = 0; i < this.movingNodes.length; i++) {
        var check = this.movingNodes[i];
        while (check == null && i < this.movingNodes.length) {
            // Remove moving cells that are undefined
            this.movingNodes.splice(i, 1);
            check = this.movingNodes[i];
        }
        if (check.boostDistance <= 0) {
            // Remove cell from list
            var index = this.movingNodes.indexOf(cell1);
            if (index != -1) {
                this.movingNodes.splice(index, 1);
            }
        }
    }
    
    // Move moving cells
    for (var i = 0; i < this.movingNodes.length; i++) {
        var cell1 = this.movingNodes[i];
        if (cell1 == null || cell1.isRemoved) continue;
        cell1.move(border);
        this.updateNodeQuad(cell1);
    }
    
    // Scan for ejected cell collisions (scan for ejected or virus only)
    rigidCollisions = [];
    eatCollisions = [];
    for (var i = 0; i < this.movingNodes.length; i++) {
        var cell1 = this.movingNodes[i];
        if (cell1 == null || cell1.isRemoved || cell1.cellType != 3) continue;
        this.quadTree.find(cell1.quadItem.bound, function (item) {
            var cell2 = item.cell;
            if (cell2 == cell1 || (cell2.cellType != 3 && cell2.cellType!=2))
                return;
            var manifold = self.checkCellCollision(cell1, cell2);
            if (manifold == null) return;
            if (cell1.cellType==3 && cell2.cellType==3) // ejected/ejected
                rigidCollisions.push({ cell1: cell1, cell2: cell2 });
            else
                eatCollisions.push({ cell1: cell1, cell2: cell2 });
        });
    }
        
    // resolve rigid body collisions
    for (var k = 0; k < rigidCollisions.length; k++) {
        var c = rigidCollisions[k];
        var manifold = this.checkCellCollision(c.cell1, c.cell2);
        if (manifold == null) continue;
        this.resolveRigidCollision(manifold, border);
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

GameServer.prototype.setAsMovingNode = function(node) {
    if (this.movingNodes.indexOf(node) == -1)
        this.movingNodes.push(node);
};

GameServer.prototype.splitCells = function(client) {
    // sort by size descending
    client.cells.sort(function (a, b) {
        return b.getSize() - a.getSize();
    });
    var cellToSplit = [];
    for (var i = 0; i < client.cells.length; i++) {
        var cell = client.cells[i];
        if (cell.getMass() < this.config.playerMinMassSplit)
            continue;
        cellToSplit.push(cell);
        if (cellToSplit.length + client.cells.length >= this.config.playerMaxCells)
            break;
    }
    var splitCells = 0; // How many cells have been split
    for (var i = 0; i < cellToSplit.length; i++) {
        var cell = cellToSplit[i];
        var dx = client.mouse.x - cell.position.x;
        var dy = client.mouse.y - cell.position.y;
        var angle = Math.atan2(dx, dy);
        if (isNaN(angle)) angle = 0;

        if (this.splitPlayerCell(client, cell, angle, cell.getMass() / 2) == true)
            splitCells++;
    }
};

GameServer.prototype.splitPlayerCell = function(client, parent, angle, mass) {
    // Returns boolean whether a cell has been split or not. You can use this in the future.

    if (client.cells.length >= this.config.playerMaxCells) {
        // Player cell limit
        return false;
    }

    if (parent.getMass() < this.config.playerMinMassSplit) {
        // Minimum mass to split
        return false;
    }
    
    // make a small shift to the cell position to prevent extrusion in wrong direction
    var pos = {
        x: parent.position.x + 40 * Math.sin(angle),
        y: parent.position.y + 40 * Math.cos(angle)
    };
    
    parent.setMass(parent.getMass() - mass); // Remove mass from parent cell
    
    // Create cell
    var newCell = new Entity.PlayerCell(this.getNextNodeId(), client, pos, mass, this);
    newCell.ejector = parent;
    newCell.setBoost(780, angle);
    
    // Add to node list
    this.addNode(newCell);
    return true;
};

GameServer.prototype.canEjectMass = function(client) {
    if (client.lastEject == null || this.tickCounter - client.lastEject >= this.config.ejectMassCooldown) {
        client.lastEject = this.tickCounter;
        return true;
    } else {
        return false;
    }
};

GameServer.prototype.ejectMass = function(client) {
    if (!this.canEjectMass(client))
        return;
    for (var i = 0; i < client.cells.length; i++) {
        var cell = client.cells[i];

        if (!cell) {
            continue;
        }

        if (cell.getMass() < this.config.playerMinMassEject) {
            continue;
        }

        var dx = client.mouse.x - cell.position.x;
        var dy = client.mouse.y - cell.position.y;
        var angle = Math.atan2(dx, dy);
        if (isNaN(angle)) angle = 0;
        
        // Get starting position
        var pos = {
            x: cell.position.x + cell.getSize() * Math.sin(angle),
            y: cell.position.y + cell.getSize() * Math.cos(angle)
        };
        
        // Randomize angle
        angle += (Math.random() * 0.6) - 0.3;

        // Remove mass from parent cell
        cell.setMass(cell.getMass() - this.config.ejectMassLoss);
        
        // Create cell
        var ejected = new Entity.EjectedMass(this.getNextNodeId(), null, pos, this.config.ejectMass, this);
        ejected.setColor(cell.getColor());
        ejected.setBoost(780, angle);
        ejected.ejector = cell;

        this.nodesEjected.push(ejected);
        this.addNode(ejected);
        this.setAsMovingNode(ejected);
    }
};

GameServer.prototype.shootVirus = function(parent) {
    var parentPos = {
        x: parent.position.x,
        y: parent.position.y,
    };

    var newVirus = new Entity.Virus(this.getNextNodeId(), null, parentPos, this.config.virusStartMass, this);
    newVirus.setBoost(780, parent.getAngle());

    // Add to moving cells list
    this.addNode(newVirus);
    this.setAsMovingNode(newVirus);
};

GameServer.prototype.getNearestVirus = function(cell) {
    // More like getNearbyVirus
    var virus = null;
    var r = 100; // Checking radius

    var topY = cell.position.y - r;
    var bottomY = cell.position.y + r;

    var leftX = cell.position.x - r;
    var rightX = cell.position.x + r;

    // Loop through all viruses on the map. There is probably a more efficient way of doing this but whatever
    var len = this.nodesVirus.length;
    for (var i = 0; i < len; i++) {
        var check = this.nodesVirus[i];
        if (check === null) continue;

        if (!check.collisionCheck(leftX, topY, rightX, bottomY))
            continue;

        // Add to list of cells nearby
        virus = check;
        break; // stop checking when a virus found
    }
    return virus;
};

GameServer.prototype.updateCells = function() {
    if (!this.run) {
        // Server is paused
        return;
    }

    // Loop through all player cells
    var massDecay = 1 - (this.config.playerMassDecayRate * this.gameMode.decayMod * 0.05);
    for (var i = 0; i < this.nodesPlayer.length; i++) {
        var cell = this.nodesPlayer[i];
        if (!cell) continue;

        // Recombining
        cell.updateRemerge(this);
        
        // Mass decay
        // TODO: needs to be updated rarely
        if (cell.getMass() >= this.config.playerMinMassDecay) {
            cell.setMass(cell.getMass() * massDecay);
        }
    }
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

GameServer.prototype.loadIpBanList = function () {
    var fileName = "./ipbanlist.txt";
    try {
        if (fs.existsSync(fileName)) {
            // Load and input the contents of the ipbanlist file
            this.ipBanList = fs.readFileSync(fileName, "utf8").split(/[\r\n]+/).filter(function (x) {
                return x != ''; // filter empty lines
            });
            console.log("[Game] " + this.ipBanList.length + " IP ban records loaded.");
        } else {
            console.log("[Game] " + fileName + " is missing.");
        }
    } catch (err) {
        console.log("[Game] Failed to load " + fileName + ": " + err.message);
    }
};

GameServer.prototype.saveIpBanList = function () {
    var fileName = "./ipbanlist.txt";
    try {
        var blFile = fs.createWriteStream(fileName);
        // Sort the blacklist and write.
        this.ipBanList.sort().forEach(function (v) {
            blFile.write(v + '\n');
        });
        blFile.end();
        console.log("[Game] " + this.ipBanList.length + " IP ban records saved.");
    } catch (err) {
        console.log("[Game] Failed to save " + fileName + ": " + err.message);
    }
};

GameServer.prototype.banIp = function (ip) {
    if (this.ipBanList.indexOf(ip) >= 0) {
        console.log("[Game] " + ip + " is already in the ban list!");
        return;
    }
    this.ipBanList.push(ip);
    console.log("[Game] The IP " + ip + " has been banned");
    this.clients.forEach(function (socket) {
        // If already disconnected or the ip does not match
        if (socket == null || !socket.isConnected || socket.remoteAddress != ip)
            return;
        
        // remove player cells
        socket.playerTracker.cells.forEach(function (cell) {
            this.removeNode(cell);
        }, this);
        
        // disconnect
        socket.close(1000, "Banned from server");
        var name = socket.playerTracker.getFriendlyName();
        console.log("[Game] Banned: \"" + name + "\" with Player ID " + socket.playerTracker.pID); // Redacted "with IP #.#.#.#" since it'll already be logged above
        this.sendChatMessage(null, null, "Banned \"" + name + "\""); // notify to don't confuse with server bug
    }, this);
    this.saveIpBanList();
};

GameServer.prototype.unbanIp = function (ip) {
    var index = this.ipBanList.indexOf(ip);
    if (index < 0) {
        console.log("[Game] IP " + ip + " is not in the ban list!");
        return;
    }
    this.ipBanList.splice(index, 1);
    console.log("[Game] Unbanned IP: " + ip);
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
        console.log("[Game] Kicked \"" + name + "\"");
        this.sendChatMessage(null, null, "Kicked \"" + name + "\""); // notify to don't confuse with server bug
        count++;
    }, this);
    if (count > 0)
        return;
    if (id == 0)
        console.log("[Game] No players to kick!");
    else
        console.log("[Game] Player with ID "+id+" not found!");
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

    var getStatsBind = this.getStats.bind(this);
    // TODO: This causes error if something else already uses this port.  Catch the error.
    this.httpServer.listen(port, function () {
        // Stats server
        console.log("[Game] Loaded stats server on port " + port);
        setInterval(getStatsBind, this.config.serverStatsUpdate * 1000);
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
		'update_time':this.updateTimeAvg.toFixed(3) + " [ms] (" + ini.getLagMessage(this.updateTimeAvg) + ")",
        'uptime': Math.round((new Date().getTime() - this.startTime)/1000/60)+" m",
        'start_time': this.startTime
    };
    this.stats = JSON.stringify(s);
};

// Custom prototype functions
WebSocket.prototype.sendPacket = function(packet) {
    if (packet == null) return;

    //if (this.readyState == WebSocket.OPEN && (this._socket.bufferSize == 0) && packet.build) {
    if (this.readyState == WebSocket.OPEN) {
        var buffer = packet.build(this.playerTracker.socket.packetHandler.protocol);
        if (buffer != null) {
            this.send(buffer, { binary: true });
        }
    } else {
        this.readyState = WebSocket.CLOSED;
        this.emit('close');
        this.removeAllListeners();
    }
};

// Ping the server tracker.
// To list us on the server tracker located at http://ogar.mivabe.nl/master
// Should be called every 30 seconds
GameServer.prototype.pingServerTracker = function () {
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
    /* Sending Ping */
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
               '&start_time=' + this.startTime;
    var options ={
        host: 'ogar.mivabe.nl',
        port: '80',
        path: '/master',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(data)
        }
    };
    var req = http.request(options, function (res) {
        if (res.statusCode != 200) {
            console.log("\u001B[1m\u001B[31m[Tracker Error] " + res.statusCode + "\u001B[0m");
        }
    });
    req.on('error', function (e) {
        console.log("\u001B[1m\u001B[31m[Tracker Error] " + e.message + "\u001B[0m");
    });
    req.write(data);
    req.end()
};

