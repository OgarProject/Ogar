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
var BotLoaderPython = require('./aiPython/BotLoader');
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
    this.lb_packet = new ArrayBuffer(0); // Leaderboard packet

    this.bots = new BotLoader(this);
    this.botsPython = new BotLoaderPython(this);
    this.log = new Logger();
    this.commands; // Command handler

    // Main loop tick
    this.time = +new Date;
    this.startTime = this.time;
    this.tick = 0; // 1 ms, 25 ms - collision update, next time all update
    this.fullTick = 0; // 2 = all update
    this.tickMain = 0; // 50 ms ticks, 20 of these = 1 leaderboard update
    this.tickSpawn = 0; // Used with spawning food

    this.pythonBotsPortStart = 8100;

    // Config
    this.config = { // Border - Right: X increases, Down: Y increases (as of 2015-05-20)
        serverMaxConnections: 64, // Maximum amount of connections to the server.
        serverPort: 443, // Server port
        serverGamemode: 0, // Gamemode, 0 = FFA, 1 = Teams
        serverBots: 0,
        serverPythonBots: 0, // Amount of player bots to spawn
        serverViewBaseX: 1024, // Base view distance of players. Warning: high values may cause lag
        serverViewBaseY: 592,
        serverStatsPort: 88, // Port for stats server. Having a negative number will disable the stats server.
        serverStatsUpdate: 60, // Amount of seconds per update for the server stats
        serverLogLevel: 1, // Logging level of the server. 0 = No logs, 1 = Logs the console, 2 = Logs console and ip connections
        serverScrambleCoords: 1, // Toggles scrambling of coordinates. 0 = No scrambling, 1 = scrambling. Default is 1.
        serverScrambleMinimaps: 1, // Toggles scrambling of borders to render maps unusable. 0 = No scrambling, 1 = scrambling. Default is 1.
        serverTeamingAllowed: 1, // Toggles anti-teaming. 0 = Anti-team enabled, 1 = Anti-team disabled
        serverMaxLB: 10, //	Controls the maximum players displayed on the leaderboard.
        borderLeft: 0, // Left border of map (Vanilla value: 0)
        borderRight: 6000, // Right border of map (Vanilla value: 11180.3398875)
        borderTop: 0, // Top border of map (Vanilla value: 0)
        borderBottom: 6000, // Bottom border of map (Vanilla value: 11180.3398875)
        spawnInterval: 20, // The interval between each food cell spawn in ticks (1 tick = 50 ms)
        foodSpawnAmount: 10, // The amount of food to spawn per interval
        foodStartAmount: 100, // The starting amount of food in the map
        foodMaxAmount: 500, // Maximum food cells on the map
        foodMass: 1, // Starting food size (In mass)
        foodMassGrow: 1, // Enable food mass grow ?
        foodMassGrowPossiblity: 50, // Chance for a food to has the ability to be self growing
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
        playerSmoothSplit: 0, // Whether smooth splitting is used
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

    // Gamemodes
    this.gameMode = Gamemode.get(this.config.serverGamemode);

}

GameServer.prototype.exit = function() {
    console.log("[Console] Closing server...");
    this.botsPython.killBots();
    this.socketServer.close();
    process.exit(1);
}

module.exports = GameServer;

GameServer.prototype.start = function() {
    // Logging
    this.log.setup(this);

    // Gamemode configurations
    this.gameMode.onServerInit(this);

    // Start the server
    this.socketServer = new WebSocket.Server({
        port: this.config.serverPort,
        perMessageDeflate: false
    }, function() {
        // Spawn starting food
        this.startingFood();

        // Start Main Loop
        setInterval(this.mainLoop.bind(this), 1);

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

        // Python bots
        if (this.config.serverPythonBots > 0) {
            for (var i = 0; i < this.config.serverBots; i++) {
                this.botsPython.addBot();
            }
            console.log("[Game] Loaded " + this.config.serverPythonBots + " python player bots");
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
        if (origin != 'http://agar.io' &&
            origin != 'https://agar.io' &&
            origin != 'http://localhost' &&
            origin != 'https://localhost' &&
            origin != 'http://127.0.0.1' &&
            origin != 'https://127.0.0.1') {

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

                if (!cell) {
                    continue;
                }

                cell.calcMove = function() {
                    return;
                }; // Clear function so that the cell cant move
                //this.server.removeNode(cell);
            }

            client.disconnect = this.server.config.playerDisconnectTime * 20;
            this.socket.sendPacket = function() {
                return;
            }; // Clear function so no packets are sent
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

GameServer.prototype.getRandomPosition = function() {
    return {
        x: Math.floor(Math.random() * (this.config.borderRight - this.config.borderLeft)) + this.config.borderLeft,
        y: Math.floor(Math.random() * (this.config.borderBottom - this.config.borderTop)) + this.config.borderTop
    };
};

GameServer.prototype.getRandomSpawn = function() {
    // Random spawns for players
    var pos;

    if (this.currentFood > 0) {
        // Spawn from food
        var node;
        for (var i = (this.nodes.length - 1); i > -1; i--) {
            // Find random food
            node = this.nodes[i];

            if (!node || node.inRange) {
                // Skip if food is about to be eaten/undefined
                continue;
            }

            if (node.getType() == 1) {
                pos = {
                    x: node.position.x,
                    y: node.position.y
                };
                this.removeNode(node);
                break;
            }
        }
    }

    if (!pos) {
        // Get random spawn if no food cell is found
        pos = this.getRandomPosition();
    }

    return pos;
};

GameServer.prototype.getRandomColor = function() {
    var colorRGB = [0xFF, 0x07, (Math.random() * 256) >> 0];
    colorRGB.sort(function() {
        return 0.5 - Math.random();
    });
    return {
        r: colorRGB[0],
        b: colorRGB[1],
        g: colorRGB[2]
    };
};

GameServer.prototype.addNode = function(node) {
    this.nodes.push(node);

    // Adds to the owning player's screen excluding ejected cells
    if (node.owner && node.cellType != 3) {
        node.setColor(node.owner.color);
        node.owner.cells.push(node);
        node.owner.socket.sendPacket(new Packet.AddNode(node));
    }

    // Special on-add actions
    node.onAdd(this);

    // Add to visible nodes
    for (var i = 0; i < this.clients.length; i++) {
        client = this.clients[i].playerTracker;
        if (!client) {
            continue;
        }

        // client.nodeAdditionQueue is only used by human players, not bots
        // for bots it just gets collected forever, using ever-increasing amounts of memory
        if ('_socket' in client.socket && node.visibleCheck(client.viewBox, client.centerPos)) {
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
        client = this.clients[i].playerTracker;
        if (!client) {
            continue;
        }

        // Remove from client
        client.nodeDestroyQueue.push(node);
    }
};

GameServer.prototype.moveTick = function() {
    // Move cells
    this.updateMoveEngine();
};

GameServer.prototype.spawnTick = function() {
    // Spawn food
    this.tickSpawn++;
    if (this.tickSpawn >= this.config.spawnInterval) {
        this.updateFood(); // Spawn food
        this.virusCheck(); // Spawn viruses

        this.tickSpawn = 0; // Reset
    }
};

GameServer.prototype.gamemodeTick = function() {
    // Gamemode tick
    this.gameMode.onTick(this);
};

GameServer.prototype.cellUpdateTick = function() {
    // Update cells
    this.updateCells();
};

GameServer.prototype.mainLoop = function() {
    // Timer
    var local = new Date();
    this.tick += (local - this.time);
    this.time = local;

    if (!this.run) return;

    if (this.tick >= 25) {
        this.fullTick++;
        setTimeout(this.moveTick.bind(this), 0);

        if (this.fullTick >= 2) {
            // Loop main functions
            setTimeout(this.spawnTick.bind(this), 0);
            setTimeout(this.gamemodeTick.bind(this), 0);
            setTimeout(this.cellUpdateTick.bind(this), 0);

            // Update the client's maps
            this.updateClients();

            // Update cells/leaderboard loop
            this.tickMain++;
            if (this.tickMain >= 4) { // 250 milliseconds
                // Update leaderboard with the gamemode's method
                this.leaderboard = [];
                this.gameMode.updateLB(this);
                this.lb_packet = new Packet.UpdateLeaderboard(this.leaderboard, this.gameMode.packetLB);

                if (!this.gameMode.specByLeaderboard) {
                    // Get client with largest score if gamemode doesn't have a leaderboard
                    var lC;
                    var lCScore = 0;
                    for (var i = 0; i < this.clients.length; i++) {
                        if (this.clients[i].playerTracker.getScore(true) > lCScore) {

                            if (!this.gameMode.specByLeaderboard) lC = this.clients[i].playerTracker;
                            else lC = this.clients[i];

                            lCScore = this.clients[i].playerTracker.getScore(true);
                        }
                    }
                    this.largestClient = lC;
                } else this.largestClient = this.leaderboard[0];

                this.tickMain = 0; // Reset
            }
            this.fullTick = 0; // Reset
        }

        // Debug
        //console.log(this.tick - 25);

        // Reset
        this.tick = 0;
    }
};

GameServer.prototype.updateClients = function() {
    for (var i = 0; i < this.clients.length; i++) {
        if (typeof this.clients[i] == "undefined") {
            continue;
        }

        this.clients[i].playerTracker.antiTeamTick();
        this.clients[i].playerTracker.update();
    }
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
    if (pos == null) { // Get random pos
        pos = this.getRandomSpawn();
    }
    if (mass == null) { // Get starting mass
        mass = this.config.playerStartMass;
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
        var pos = this.getRandomPosition();
        var virusSquareSize = (this.config.virusStartMass * 100) >> 0;

        // Check for players
        for (var i = 0; i < this.nodesPlayer.length; i++) {
            var check = this.nodesPlayer[i];

            if (check.mass < this.config.virusStartMass) {
                continue;
            }

            var squareR = check.getSquareSize(); // squared Radius of checking player cell

            var dx = check.position.x - pos.x;
            var dy = check.position.y - pos.y;

            if (dx * dx + dy * dy + virusSquareSize <= squareR)
                return; // Collided
        }

        // Spawn if no cells are colliding
        var v = new Entity.Virus(this.getNextNodeId(), null, pos, this.config.virusStartMass, this);
        this.addNode(v);
    }
};

GameServer.prototype.getDist = function(x1, y1, x2, y2) { // Use Pythagoras theorem
    var deltaX = this.abs(x1 - x2);
    var deltaY = this.abs(y1 - y2);
    return Math.sqrt(deltaX * deltaX + deltaY * deltaY);
};

GameServer.prototype.abs = function(x) { // Because Math.abs is slow
    return x < 0 ? -x : x;
};

GameServer.prototype.checkCellCollision = function(cell, check) {
    // Returns object which contains info about cell's collisions. You can use this in the future.

    // Check the two cells for collision
    var collisionDist = cell.getSize() + check.getSize(); // Minimum distance between the two cells
    var dist = this.getDist(cell.position.x, cell.position.y,
        check.position.x, check.position.y); // Distance between these two cells

    var dY = cell.position.y - check.position.y;
    var dX = cell.position.x - check.position.x;
    var angle = Math.atan2(dX, dY);

    return ({
        cellDist: dist,
        collideDist: collisionDist,
        cellMult: (cell.getSpeed() / check.getSpeed()) / 2,
        cellAngle: angle,
        collided: (dist < collisionDist)
    });
};

GameServer.prototype.cellCollision = function(cell, check, calcInfo) {
    if (!calcInfo) calcInfo = this.checkCellCollision(cell, check); // Unedefined calc info

    // Check collision
    if (calcInfo.collided) { // Collided
        // The moving cell pushes the colliding cell

        var dist = calcInfo.cellDist;
        var collisionDist = calcInfo.collideDist;
        var mult = calcInfo.cellMult;
        var angle = calcInfo.cellAngle;

        var move = (collisionDist - dist) * mult;

        cell.position.x += move * Math.sin(angle);
        cell.position.y += move * Math.cos(angle);
    }
};

GameServer.prototype.updateMoveEngine = function() {
    // Move player cells
    var len = this.nodesPlayer.length;

    for (var i in this.clients) {
        var client = this.clients[i].playerTracker;

        // Sort client's cells by ascending mass
        var sorted = [];
        // Populate with client's cells
        for (var i = 0; i < client.cells.length; i++)
            sorted[i] = client.cells[i];

        // Now sort it
        sorted.sort(function(a, b) {
            return parseFloat(b.mass) - parseFloat(a.mass);
        });

        // Go cell by cell
        for (var i = 0; i < sorted.length; i++) {
            var cell = sorted[i];

            // Do not move cells that have already been eaten
            if (!cell) {
                continue;
            }

            // First move the cell
            cell.calcMovePhys(this.config);

            // Now move it to the mouse
            cell.calcMove(client.mouse.x, client.mouse.y, this);

            // Collision with own cells
            cell.collision(this);

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
        }
    }


    // A system to move cells not controlled by players (ex. viruses, ejected mass)
    len = this.movingNodes.length;
    for (var i = 0; i < len; i++) {
        var check = this.movingNodes[i];

        // Recycle unused nodes
        while ((typeof check == "undefined") && (i < this.movingNodes.length)) {
            // Remove moving cells that are undefined
            this.movingNodes.splice(i, 1);
            check = this.movingNodes[i];
        }

        if (i >= this.movingNodes.length) {
            continue;
        }

        if (check.moveEngineTicks > 0) {
            check.onAutoMove(this);
            // If the cell has enough move ticks, then move it
            check.calcMovePhys(this.config);
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

GameServer.prototype.setAsMovingNode = function(node) {
    this.movingNodes.push(node);
};

GameServer.prototype.splitCells = function(client) {
    var len = client.cells.length;
    var splitCells = 0; // How many cells have been split
    for (var i = 0; i < len; i++) {
        var cell = client.cells[i];

        var deltaY = client.mouse.y - cell.position.y;
        var deltaX = client.mouse.x - cell.position.x;
        var angle = Math.atan2(deltaX, deltaY);
        if (angle == 0) angle = Math.PI / 2;

        if (this.createPlayerCell(client, cell, angle, cell.mass / 2) == true) splitCells++;
    }
    if (splitCells > 0) client.applyTeaming(0.6, 2); // Account anti-teaming
};

GameServer.prototype.createPlayerCell = function(client, parent, angle, mass) {
    // Returns boolean whether a cell has been split or not. You can use this in the future.

    if (client.cells.length >= this.config.playerMaxCells) {
        // Player cell limit
        return false;
    }

    if (parent.mass < this.config.playerMinMassSplit) {
        // Minimum mass to split
        return false;
    }

    // Calculate customized speed for splitting cells
    var tau = Math.PI * Math.PI;
    var modifier = 3 + Math.log(1 + mass) / 10;
    var splitSpeed = this.config.playerSpeed * Math.min(Math.pow(mass, -Math.PI / tau / 10) * modifier, 150);

    // Calculate new position
    var newPos = {
        x: parent.position.x,
        y: parent.position.y
    }

    // Create cell
    var newCell = new Entity.PlayerCell(this.getNextNodeId(), client, newPos, mass, this);
    newCell.setAngle(angle);
    newCell.setMoveEngineData(splitSpeed, 12, 0.87);
    if (this.config.playerSmoothSplit == 1) {
        newCell.collisionRestoreTicks = 12;
        parent.collisionRestoreTicks = 12;
    }
    newCell.calcMergeTime(this.config.playerRecombineTime);
    parent.mass -= mass; // Remove mass from parent cell

    // Add to node list
    this.addNode(newCell);
    return true;
};

GameServer.prototype.canEjectMass = function(client) {
    if (typeof client.lastEject == 'undefined' || this.time - client.lastEject >= this.config.ejectMassCooldown) {
        client.lastEject = this.time;
        return true;
    } else
        return false;
};

GameServer.prototype.ejectMass = function(client) {
    if (!this.canEjectMass(client))
        return;
    for (var i = 0; i < client.cells.length; i++) {
        var cell = client.cells[i];

        if (!cell) {
            continue;
        }

        if (cell.mass < this.config.playerMinMassEject) {
            continue;
        }

        var deltaY = client.mouse.y - cell.position.y;
        var deltaX = client.mouse.x - cell.position.x;
        var angle = Math.atan2(deltaX, deltaY);

        // Get starting position
        var size = cell.getSize() + 0.5;
        var startPos = {
            x: cell.position.x + ((size + this.config.ejectMass) * Math.sin(angle)),
            y: cell.position.y + ((size + this.config.ejectMass) * Math.cos(angle))
        };

        // Remove mass from parent cell
        cell.mass -= this.config.ejectMassLoss;
        // Randomize angle
        angle += (Math.random() * 0.6) - 0.3;

        // Create cell
        var ejected = new Entity.EjectedMass(this.getNextNodeId(), client, startPos, this.config.ejectMass, this);
        ejected.setAngle(angle);
        ejected.setMoveEngineData(this.config.ejectSpeed, 20, 0.85);
        ejected.setColor(cell.getColor());

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
    newVirus.setAngle(parent.getAngle());
    newVirus.setMoveEngineData(135, 20, 0.85);

    // Add to moving cells list
    this.addNode(newVirus);
    this.setAsMovingNode(newVirus);
};

GameServer.prototype.getCellsInRange = function(cell) {
    var list = [];
    var squareR = cell.getSquareSize(); // Get cell squared radius

    // Loop through all cells that are visible to the cell. There is probably a more efficient way of doing this but whatever
    var len = cell.owner.visibleNodes.length;
    for (var i = 0; i < len; i++) {
        var check = cell.owner.visibleNodes[i];

        if (typeof check === 'undefined') {
            continue;
        }

        // if something already collided with this cell, don't check for other collisions
        if (check.inRange) {
            continue;
        }

        // Can't eat itself
        if (cell.nodeId == check.nodeId) {
            continue;
        }

        // Can't eat cells that have collision turned off
        if ((cell.owner == check.owner) && (cell.collisionRestoreTicks != 0) && (check.cellType == 0)) {
            continue;
        }

        // AABB Collision
        if (!check.collisionCheck2(squareR, cell.position) && check.cellType == 1) {
            continue;
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
                    if (!cell.shouldRecombine || !check.shouldRecombine) {
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
        if ((check.mass * multiplier) > cell.mass) {
            continue;
        }

        // Eating range
        var dist = this.getDist(cell.position.x, cell.position.y, check.position.x, check.position.y);

        // Eating range = radius of eating cell / 2 - 31% of the radius of the cell being eaten
        var eatingRange = cell.getSize() - check.getEatingRange() * 1.3;

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

        if (typeof check === 'undefined') {
            continue;
        }

        if (!check.collisionCheck(bottomY, topY, rightX, leftX)) {
            continue;
        }

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

        if (!cell) {
            continue;
        }

        // Recombining
        if (cell.owner.cells.length > 1) {
            cell.recombineTicks += 0.05;
            cell.calcMergeTime(this.config.playerRecombineTime);
        } else if (cell.owner.cells.length == 1 && cell.recombineTicks > 0) {
            cell.recombineTicks = 0;
            cell.shouldRecombine = false;
            cell.owner.mergeOverride = false;
            cell.owner.mergeOverrideDuration = 0;
        }
        // Collision
        if (cell.collisionRestoreTicks > 0) {
            cell.collisionRestoreTicks--;
        }

        // Mass decay
        if (cell.mass >= this.config.playerMinMassDecay) {
            var client = cell.owner;
            if (this.config.serverTeamingAllowed == 0) {
                var teamMult = (client.massDecayMult - 1) / 1111 + 1; // Calculate anti-teaming multiplier for decay
                var thisDecay = 1 - massDecay * (1 / teamMult); // Reverse mass decay and apply anti-teaming multiplier
                cell.mass *= (1 - thisDecay);
            } else {
                // No anti-team
                cell.mass *= massDecay;
            }
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
        this.send(getBuf(buf), {
            binary: true
        });
    } else if (!packet.build) {
        // Do nothing
    } else {
        this.readyState = WebSocket.CLOSED;
        this.emit('close');
        this.removeAllListeners();
    }
};
