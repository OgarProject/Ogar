// Library imports
var WebSocket = require('ws');
var http = require('http');
var fs = require("fs");
var ini = require('./modules/ini.js');

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
        serverMaxConnections: 64,   // Maximum amount of connections to the server. (0 for no limit)
        serverIpLimit: 4,           // Maximum amount of connections from the same IP (0 for no limit)
        serverPort: 443,            // Server port
        serverGamemode: 0,          // Gamemode, 0 = FFA, 1 = Teams
        serverBots: 0,              // Amount of player bots to spawn
        serverViewBaseX: 1920,      // Base client screen resolution. Used to calculate view area. Warning: high values may cause lag
        serverViewBaseY: 1080, 
        serverStatsPort: 88,        // Port for stats server. Having a negative number will disable the stats server.
        serverStatsUpdate: 60,      // Amount of seconds per update for the server stats
        serverLogLevel: 1,          // Logging level of the server. 0 = No logs, 1 = Logs the console, 2 = Logs console and ip connections
        serverScrambleCoords: 1,    // Toggles scrambling of coordinates. 0 = No scrambling, 1 = scrambling. Default is 1.
        serverMaxLB: 10,            //	Controls the maximum players displayed on the leaderboard.
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
        foodMassLimit: 5,           // Maximum mass for a food can grow
        virusMinAmount: 10,         // Minimum amount of viruses on the map.
        virusMaxAmount: 50,         // Maximum amount of viruses on the map. If this amount is reached, then ejected cells will pass through viruses.
        virusStartMass: 100,        // Starting virus size (In mass)
        virusFeedAmount: 7,         // Amount of times you need to feed a virus to shoot it
        ejectMass: 13,              // Mass of ejected cells
        ejectMassCooldown: 3,       // min ticks between ejects
        ejectMassLoss: 15,          // Mass lost when ejecting cells
        ejectSpeed: 100,            // Base speed of ejected cells
        ejectSpawnPlayer: 50,       // Chance for a player to spawn from ejected mass
        playerStartMass: 10,        // Starting mass of the player cell.
        playerBotGrowEnabled: 1,    // If 0, eating a cell with less than 17 mass while cell has over 625 wont gain any mass
        playerMaxMass: 22500,       // Maximum mass a player can have
        playerMinMassEject: 32,     // Mass required to eject a cell
        playerMinMassSplit: 36,     // Mass required to split
        playerMaxCells: 16,         // Max cells the player is allowed to have
        playerRecombineTime: 30,    // Base amount of seconds before a cell is allowed to recombine
        playerMassAbsorbed: 1.0,    // Fraction of player cell's mass gained upon eating
        playerMassDecayRate: .002,  // Amount of mass lost per second
        playerMinMassDecay: 9,      // Minimum mass for decay to occur
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
    // Parse config
    this.loadConfig();

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
            console.log("[Error] Server could not bind to port! Please close out of Skype or change 'serverPort' in gameserver.ini to a different number.");
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
    var totalConnections = 0;
    var ipConnections = 0;
    for (var i = 0; i < this.clients.length; i++) {
        var socket = this.clients[i];
        if (socket == null || socket.isConnected == null)
            continue;
        totalConnections++;
        if (socket.remoteAddress == ws._socket.remoteAddress)
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

GameServer.prototype.onClientSocketClose = function (ws, reason) {
    this.log.onDisconnect(ws.remoteAddress);
    
    ws.isConnected = false;
    ws.sendPacket = function (data) { };
    ws.playerTracker.disconnect = this.config.playerDisconnectTime * 20;
    for (var i = 0; i < ws.playerTracker.cells.length; i++) {
        var cell = ws.playerTracker.cells[i];
        if (cell == null) continue;
        
        cell.calcMove = function () { }
    }
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
    var attempt = 1;
    
    // Prevent stack overflow by counting attempts
    while (true) {
        if (!unsafe || attempt >= 15) break;
        pos = this.getRandomPosition();
        unsafe = this.willCollide(size, pos, mass == this.config.virusStartMass);
        attempt++;
    }
    
    // If it reached attempt 15, warn the user
    if (attempt >= 14) {
        console.log("[Server] Entity was force spawned near viruses/playercells after 15 attempts.");
        console.log("[Server] If this message keeps appearing, check your config, especially start masses for players and viruses.");
    }

    return pos;
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

GameServer.prototype.addNode = function(node) {
    this.nodes.push(node);

    // Adds to the owning player's screen excluding ejected cells
    if (node.owner && node.cellType != 3) {
        node.setColor(node.owner.color);
        node.owner.cells.push(node);
        node.owner.socket.sendPacket(new Packet.AddNode(node.owner, node));
    }

    // Special on-add actions
    node.onAdd(this);

    // Add to visible nodes
    for (var i = 0; i < this.clients.length; i++) {
        var client = this.clients[i].playerTracker;
        if (client == null) continue;

        // client.nodeAdditionQueue is only used by human players, not bots
        // for bots it just gets collected forever, using ever-increasing amounts of memory
        if ('_socket' in client.socket && node.visibleCheck(client.viewBox)) {
            client.nodeAdditionQueue.push(node);
        }
    }
};

GameServer.prototype.removeNode = function(node) {
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

    // Animation when eating
    for (var i = 0; i < this.clients.length; i++) {
        var client = this.clients[i].playerTracker;
        if (client == null) continue;

        // Remove from client
        client.nodeDestroyQueue.push(node);
    }
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
        var client = this.clients[i];
        if (client == null) continue;
        client.playerTracker.update();
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

GameServer.prototype.willCollide = function(size, pos, isVirus) {
    // Look if there will be any collision with the current nodes
    
    for (var i = 0; i < this.nodesPlayer.length; i++) {
        var check = this.nodesPlayer[i];
        if (check == null) continue;

        if (check.getSize() > size) { // Check only if the player cell is larger than imaginary cell
            if (check.collisionCheckCircle(pos.x, pos.y, size+50)) return true; // Collided
        }
    }
    
    if (isVirus) return false; // Don't check for viruses if the new cell will be virus
    
    for (var i = 0; i < this.nodesVirus.length; i++) {
        var check = this.nodesVirus[i];
        if (check == null) continue;
        
        if (check.getSize() > size) { // Check only if the virus cell is larger than imaginary cell
            if (check.collisionCheckCircle(pos.x, pos.y, size + 50)) return true; // Collided
        }
    }
    return false;
};

GameServer.prototype.getDist = function (x1, y1, x2, y2) {
    var dx = x2 - x1;
    var dy = y2 - x1;
    return Math.sqrt(dx * dx + dy * dy);
};

GameServer.prototype.abs = function (x) {
    return x < 0 ? -x : x;
};

GameServer.prototype.checkCellCollision = function(cell, check) {
    // Returns manifold which contains info about cell's collisions. 
    // Returns null if there is no collision
    
    // do not affect splitted cell for 1 sec
    if (cell.boostDistance > 0 || check.boostDistance > 0) {
        var tick = this.getTick();
        if (cell.getAge(tick) < 15 || check.getAge(tick) < 15)
            return null;
    }

    var r = cell.getSize() + check.getSize();
    var dx = check.position.x - cell.position.x;
    var dy = check.position.y - cell.position.y;
    var squared = dx * dx + dy * dy;         // squared distance from cell to check
    if (squared >= r * r) {
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

GameServer.prototype.resolveCollision = function (manifold) {
    // distance from cell1 to cell2
    var d = Math.sqrt(manifold.squared);
    if (d <= 0) return;
    
    // normal
    var nx = manifold.dx / d;
    var ny = manifold.dy / d;
    
    // body penetration distance
    var penetration = manifold.r - d;
    if (penetration <= 0) return;
    
    // penetration vector = penetration * normal
    var px = penetration * nx;
    var py = penetration * ny;
    
    // body impulse
    var totalMass = manifold.cell1.getMass() + manifold.cell2.getMass();
    if (totalMass <= 0) return;
    var impulse1 = manifold.cell2.getMass() / totalMass;
    var impulse2 = manifold.cell1.getMass() / totalMass;
    
    // apply extrusion force
    manifold.cell1.position.x -= px * impulse1;
    manifold.cell1.position.y -= py * impulse1;
    manifold.cell2.position.x += px * impulse2;
    manifold.cell2.position.y += py * impulse2;
};

GameServer.prototype.updateMoveEngine = function() {
    // Move player cells
    for (var i in this.clients) {
        var client = this.clients[i].playerTracker;

        // Sort client's cells by ascending mass
        var sorted = [];
        for (var i = 0; i < client.cells.length; i++) {
            var node = client.cells[i];
            if (node == null) continue;
            sorted.push(node);
        }
        
        sorted.sort(function(a, b) {
            return b.getMass() - a.getMass();
        });
        
        // Go cell by cell
        for (var i = 0; i < sorted.length; i++) {
            sorted[i].calcMove(client.mouse.x, client.mouse.y, this);
        }
        for (var i = 0; i < sorted.length; i++) {
            sorted[i].calcMoveBoost(this.config);
        }
        for (var i = 0; i < sorted.length; i++) {
            var cell = sorted[i];
            
            // Collision with own cells
            cell.collision(this);

            // Cell eating
            this.cellEating(cell);
        }
    }


    // A system to move cells not controlled by players (ex. viruses, ejected mass)
    for (var i = 0; i < this.movingNodes.length; i++) {
        var check = this.movingNodes[i];

        // Recycle unused nodes
        while (check == null && i < this.movingNodes.length) {
            // Remove moving cells that are undefined
            this.movingNodes.splice(i, 1);
            check = this.movingNodes[i];
        }

        if (i >= this.movingNodes.length)
            continue;

        if (check.boostDistance > 0) {
            check.onAutoMove(this);
            // If the cell has enough move ticks, then move it
            check.calcMoveBoost(this.config);
        } else {
            // Auto move is done
            check.moveDone(this);
            // Remove cell from list
            var index = this.movingNodes.indexOf(check);
            if (index != -1) {
                this.movingNodes.splice(index, 1);
            }
        }
    }
};

GameServer.prototype.cellEating = function(cell) {
    // Check if cells nearby
    var list = this.getCellsInRange(cell);
    for (var j = 0; j < list.length; j++) {
        var check = list[j];

        // Consume effect
        check.onConsume(cell, this);

        // Remove cell
        check.setKiller(cell);
        this.removeNode(check);
    }
};

GameServer.prototype.setAsMovingNode = function(node) {
    if (this.movingNodes.indexOf(node) == -1)
        this.movingNodes.push(node);
};

GameServer.prototype.splitCells = function(client) {
    var len = client.cells.length;
    var splitCells = 0; // How many cells have been split
    for (var i = 0; i < len; i++) {
        var cell = client.cells[i];

        var dx = client.mouse.x - cell.position.x;
        var dy = client.mouse.y - cell.position.y;
        var angle = Math.atan2(dx, dy);
        //if (angle == 0) angle = Math.PI / 2;
        if (isNaN(angle)) angle = 0;

        if (this.createPlayerCell(client, cell, angle, cell.getMass() / 2) == true)
            splitCells++;
    }
};

GameServer.prototype.createPlayerCell = function(client, parent, angle, mass) {
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

GameServer.prototype.getCellsInRange = function(cell) {
    var list = [];
    var squareR = cell.getSquareSize(); // Get cell squared radius

    // Loop through all cells that are colliding with the player's cells
    for (var i = 0; i < cell.owner.collidingNodes.length; i++) {
        var check = cell.owner.collidingNodes[i];
        if (check === null) continue;

        // if something already collided with this cell, don't check for other collisions
        if (check.inRange)
            continue;

        // Can't eat itself
        if (cell.nodeId == check.nodeId)
            continue;

        // Can't eat self ejected mass, because it still in boost mode
        if (check.ejector == cell && check.boostDistance > 0)
            continue;
        
        // Eating range
        var xs = cell.position.x - check.position.x,
            ys = cell.position.y - check.position.y,
            sqDist = xs * xs + ys * ys,
            dist = Math.sqrt(sqDist);

        // Use a more reliant version for pellets
        // Might be a bit slower but it can be eaten with any mass
        if (check.cellType == 1) {
            if (dist + check.getSize() / 3.14 > cell.getSize()) {
                // Too far away
                continue;
            }
            else {
                // Add to list of cells nearby
                list.push(check);
    
                // Something is about to eat this cell; no need to check for other collisions with it
                check.inRange = true;
                continue; // No need to look for type and calculate if eaten again
            }
        }

        // Cell type check - Cell must be bigger than this number times the mass of the cell being eaten
        var multiplier = 1.3;

        switch (check.getType()) {
            case 1: // Food cell
                list.push(check);
                check.inRange = true; // skip future collision checks for this food
                continue;
            case 0: // Players
                // Can't eat self if it's not time to recombine yet
                if (check.owner == cell.owner) {
                    // If one of cells can't merge
                    if (!cell.canRemerge() || !check.canRemerge()) {
                        // Check if merge command was triggered on this client
                        if (!cell.owner.mergeOverride) continue;
                    }

                    multiplier = 1.00;
                }

                // Can't eat team members
                if (this.gameMode.haveTeams) {
                    if (!check.owner) { // Error check
                        continue;
                    }

                    if ((check.owner != cell.owner) && (check.owner.getTeam() == cell.owner.getTeam())) {
                        continue;
                    }
                }
                break;
            default:
                break;
        }

        // Make sure the cell is big enough to be eaten.
        if ((check.getMass() * multiplier) > cell.getMass()) {
            continue;
        }
        
        // Eating range = radius of eating cell / 2 - 31% of the radius of the cell being eaten
        var eatingRange = cell.getSize() - check.getEatingRange();

        if (dist < eatingRange) {
            // Add to list of cells nearby
            list.push(check);

            // Something is about to eat this cell; no need to check for other collisions with it
            check.inRange = true;
        } else {
            // Not in eating range
            continue;
        }
    }
    return list;
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
        if (cell.owner.cells.length == 1) {
            cell.owner.mergeOverride = false;
            cell.owner.mergeOverrideDuration = 0;
        }
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
