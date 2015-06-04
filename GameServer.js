// Library imports
var WebSocket = require('ws');

// Project imports
var Packet = require('./packet');
var PlayerTracker = require('./PlayerTracker');
var PacketHandler = require('./PacketHandler');
var Entity = require('./entity');

// GameServer implementation
function GameServer(port,gameMode) {
    this.lastNodeId = 1;
    this.clients = [];
    this.port = port;
    this.nodes = [];
    this.nodesVirus = []; // Virus nodes
    this.nodesEjected = []; // Ejected mass nodes
    this.nodesPlayer = []; // Nodes controlled by players
    
    this.currentFood = 0;
    this.movingNodes = []; // For move engine
    this.leaderboard = [];
    this.gameMode = gameMode;
    
    // Main loop tick
    this.time = new Date(); this.testTick = 0;
    this.tick = 0; // 1 second ticks of mainLoop
    this.tickMain = 0; // 50 ms ticks, 40 of these = 1 leaderboard update
    this.tickSpawn = 0; // 50 ms ticks, used with spawning food
    
    this.config = { // Border - Right: X increases, Down: Y increases (as of 2015-05-20)
        serverMaxConnections: 64, // Maximum amount of connections to the server. 
        serverBots: 0, // Amount of player bots to spawn (Experimental)
        serverViewBase: 1024, // Base view distance of players. Warning: high values may cause lag
        borderLeft: 0, // Left border of map (Vanilla value: 0)
        borderRight: 6000, // Right border of map (Vanilla value: 11180.3398875)
        borderTop: 0, // Top border of map (Vanilla value: 0)
        borderBottom: 6000, // Bottom border of map (Vanilla value: 11180.3398875)
        foodSpawnRate: 20, // The interval between each food cell spawn in ticks (1 tick = 50 ms)
        foodSpawnAmount: 10, // The amount of food to spawn per interval
        foodStartAmount: 100, // The starting amount of food in the map
        foodMaxAmount: 500, // Maximum food cells on the map
        foodMass: 1, // Starting food size (In mass)
        virusMinAmount: 10, // Minimum amount of viruses on the map. 
        virusMaxAmount: 50, // Maximum amount of viruses on the map. If this amount is reached, then ejected cells will pass through viruses.
        virusStartMass: 100.0, // Starting virus size (In mass)
        virusBurstMass: 198.0, // Viruses explode past this size
        ejectMass: 16, // Mass of ejected cells
        ejectMassGain: 12, // Amount of mass gained from consuming ejected cells
        ejectSpeed: 170, // Base speed of ejected cells
        ejectSpawnPlayer: 50, // Chance for a player to spawn from ejected mass
        playerStartMass: 10, // Starting mass of the player cell.
        playerMaxMass: 22500, // Maximum mass a player can have
        playerMinMassEject: 32, // Mass required to eject a cell
        playerMinMassSplit: 36, // Mass required to split
        playerMaxCells: 16, // Max cells the player is allowed to have
        playerRecombineTime: 15, // Amount of ticks before a cell is allowed to recombine (1 tick = 2000 milliseconds) - currently 30 seconds
        playerMassDecayRate: .004, // Amount of mass lost per tick (Multiplier) (1 tick = 2000 milliseconds)
        playerMinMassDecay: 9, // Minimum mass for decay to occur
        leaderboardUpdateClient: 40 // How often leaderboard data is sent to the client (1 tick = 50 milliseconds)
    };
	
    this.colors = [{'r':235,'b':0,'g':75},{'r':225,'b':255,'g':125},{'r':180,'b':20,'g':7},{'r':80,'b':240,'g':170},{'r':180,'b':135,'g':90},{'r':195,'b':0,'g':240},{'r':150,'b':255,'g':18},{'r':80,'b':0,'g':245},{'r':165,'b':0,'g':25},{'r':80,'b':0,'g':145},{'r':80,'b':240,'g':170},{'r':55,'b':255,'g':92}]; 
}

module.exports = GameServer;

GameServer.prototype.start = function() {
    // Gamemode configurations
    this.gameMode.onServerInit(this);
	
    // Start the server
    this.socketServer = new WebSocket.Server({ port: this.port }, function() {
        // Spawn starting food
        for (var i = 0; i < this.config.foodStartAmount; i++) {
            this.spawnFood();
        }
        
        // Start Main Loop
        setInterval(this.mainLoop.bind(this), 1);
        
        // Done
        console.log("[Game] Listening on port %d", this.port);
        console.log("[Game] Current game mode is "+this.gameMode.name);
        
        // Player bots (Experimental)
        if (this.config.serverBots > 0) {
            var BotLoader = require('./ai/BotLoader.js');
            this.bots = new BotLoader(this,this.config.serverBots);
            console.log("[Game] Loaded "+this.config.serverBots+" player bots");
        }
    }.bind(this));

    this.socketServer.on('connection', connectionEstablished.bind(this));

    function connectionEstablished(ws) {
        if (this.clients.length > this.config.serverMaxConnections) {
            ws.close();
            console.log("[Game] Client tried to connect, but server player limit has been reached!");
            return;
        }
    	
        function close(error) {
            console.log("[Game] Disconnect: %s:%d", this.socket.remoteAddress, this.socket.remotePort);
            var index = this.server.clients.indexOf(this.socket);
            if (index != -1) {
                this.server.clients.splice(index, 1);
            }
            
            // Switch online flag off
            this.socket.playerTracker.setStatus(false);
        }

        console.log("[Game] Connect: %s:%d", ws._socket.remoteAddress, ws._socket.remotePort);
        ws.remoteAddress = ws._socket.remoteAddress;
        ws.remotePort = ws._socket.remotePort;
        ws.playerTracker = new PlayerTracker(this, ws);
        ws.packetHandler = new PacketHandler(this, ws);
        ws.on('message', ws.packetHandler.handleMessage.bind(ws.packetHandler));

        var bindObject = { server: this, socket: ws };
        ws.on('error', close.bind(bindObject));
        ws.on('close', close.bind(bindObject));
        this.clients.push(ws);
    }
}

GameServer.prototype.getMode = function() {
    return this.gameMode;
}

GameServer.prototype.getNextNodeId = function() {
	// Resets integer
    if (this.lastNodeId > 2147483647) {
        this.lastNodeId = 1;
    }
    return this.lastNodeId++;
}

GameServer.prototype.getRandomPosition = function() {
    return [
        Math.floor(Math.random() * (this.config.borderRight - this.config.borderLeft)) + this.config.borderLeft,
        Math.floor(Math.random() * (this.config.borderBottom - this.config.borderTop)) + this.config.borderTop
    ];
}

GameServer.prototype.getRandomColor = function() {
    var index = Math.floor(Math.random() * this.colors.length);
    var color = this.colors[index];
    return [color.r ,color.g ,color.b];
}

GameServer.prototype.addNode = function(node) {
    this.nodes.push(node);
    
    // Special on-add actions
    node.onAdd(this);
    
    // Adds to the owning player's screen
    if (node.owner){
        node.owner.socket.sendPacket(new Packet.AddNodes(node));
    }
    
    // Add to visible nodes
    for (var i = 0; i < this.clients.length;i++) {
        client = this.clients[i].playerTracker;
        if (!client) {
            continue;
        }

        if (node.collisionCheck(client.viewBox.bottomY,client.viewBox.topY,client.viewBox.rightX,client.viewBox.leftX)) {
            client.visibleNodes.push(node);
        }
    }
}

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
    for (var i = 0; i < this.clients.length;i++) {
        client = this.clients[i].playerTracker;
        if (!client) {
            continue;
        }

        // Remove from client
        client.nodeDestroyQueue.push(node); 
    }
}

GameServer.prototype.mainLoop = function() {
    // Timer
    var local = new Date();
    this.tick += (local - this.time);
    this.time = local;

    if (this.tick >= 50) {
        // Loop main functions
        this.updateMoveEngine();
        this.updateClients();
		
        // Spawn food
        this.tickSpawn++;
        if (this.tickSpawn >= this.config.foodSpawnRate) {
            this.updateFood(); // Spawn food
            this.virusCheck(); // Spawn viruses
			
            this.tickSpawn = 0; // Reset
        }
		
        // Update cells/leaderboard loop
        this.tickMain++;
        if (this.tickMain >= 40) { // 2 seconds
            // Update cells
            this.updateCells();
            
            // Update leaderboard with the gamemode's method
            this.leaderboard = []; 
            this.gameMode.updateLB(this);
			
            this.tickMain = 0; // Reset
            
            // Debug
            //console.log(this.testTick);
            //this.testTick = 0; 
        }
		
        // Debug
        //this.testTick += (this.tick - 50);
		
        // Reset
        this.tick = 0; 
    }
}


GameServer.prototype.updateClients = function() {
    for (var i = 0; i < this.clients.length; i++) {
        if (typeof this.clients[i] == "undefined") {
            continue;
        }

        this.clients[i].playerTracker.update();
    }
}

GameServer.prototype.updateFood = function() {
    var toSpawn = Math.min(this.config.foodSpawnAmount,(this.config.foodMaxAmount-this.currentFood));
    for (var i = 0; i < toSpawn; i++) {
        this.spawnFood();
    }    
}

GameServer.prototype.spawnFood = function() {
    var f = new Entity.Food(this.getNextNodeId(), null, this.getRandomPosition(), this.config.foodMass);
    f.setColor(this.getRandomColor());
	
    this.addNode(f);
    this.currentFood++; 
}

GameServer.prototype.spawnPlayer = function(client) {
    var pos = this.getRandomPosition();
    var startMass = this.config.playerStartMass;
    
    // Check if there are ejected mass in the world. Does not work in team mode
    if ((this.nodesEjected.length > 0) && (!this.gameMode.haveTeams)) {
        var index = Math.floor(Math.random() * 100) + 1;
        if (index <= this.config.ejectSpawnPlayer) {
            // Get ejected cell
            var index = Math.floor(Math.random() * this.nodesEjected.length);
            var e = this.nodesEjected[index];
    		
            // Remove ejected mass
            this.removeNode(e);
    		
            // Inherit
            pos[0] = e.pos[0];
            pos[1] = e.pos[1];
            startMass = e.mass;
    		
            var color = e.getColor();
            client.setColor(color);
        }
    }
    
    // Spawn player and add to world
    var cell = new Entity.PlayerCell(this.getNextNodeId(), client, pos, startMass);
    this.addNode(cell);
    
    // Set initial mouse coords
    client.setMouse(pos[0], pos[1]);
}

GameServer.prototype.virusCheck = function() {
    // Checks if there are enough viruses on the map
    if (this.nodesVirus.length < this.config.virusMinAmount) {
        // Spawns a virus
        var pos = this.getRandomPosition();
    	
        // Check for players (Experimental)
        for (var i = 0; i < this.nodesPlayer; i++) {
            var check = this.nodesPlayer[i];
    		
            var r = check.getSize(); // Radius of checking player cell
    		
            // Collision box
            var topY = check.pos[1] - r;
            var bottomY = check.pos[1] + r;
            var leftX = check.pos[0] - r;
            var rightX = check.pos[0] + r;
    		
            // Check for collisions
            if (pos.y < bottomY) {
                return;
            } if (pos.y > topY) {
                return;
            } if (pos.x < rightX) {
                return;
            } if (pos.x > leftX) {
                return;
            }
        }
    	
        // Spawn if no cells are colliding
        var v = new Entity.Virus(this.getNextNodeId(), null, pos, this.config.virusStartMass);
        this.addNode(v);
    }
}

GameServer.prototype.updateMoveEngine = function() {
    // Move player cells
    var len = this.nodesPlayer.length;
    for (var i = 0; i < len; i++) {
        var cell = this.nodesPlayer[i];
    		
        // Do not move cells that have collision turned off
        if ((!cell) || (cell.getCollision())){
            continue;
        }
    		
        var client = cell.owner;
        
        // If cell's owner is offline, remove this cell
        if (!client.getStatus()) {
            this.removeNode(cell);
            continue;
        }
        
        cell.calcMove(client.mouse[0], client.mouse[1], this);

        // Check if cells nearby
        var list = this.getCellsInRange(cell);
        for (var j = 0; j < list.length ; j++) {
            var check = list[j];
        	
            // Consume effect
            check.onConsume(cell,this);
            
            // Remove cell
            check.setKiller(cell);
            this.removeNode(check); 
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
        } if (i >= this.movingNodes.length) {
            continue;
        }
        
        if (check.getMoveTicks() > 0) {
            // If the cell has enough move ticks, then move it
            check.calcMovePhys(this.config);
            if ((check.getType() == 3) && (this.nodesVirus.length < this.config.virusMaxAmount)) {
                // Check for viruses
                var v = this.getNearestVirus(check);
                if (v) { // Feeds the virus if it exists
                    v.feed(check,this);
                }
            }
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
}

GameServer.prototype.setAsMovingNode = function(node) {
	this.movingNodes.push(node);
}

GameServer.prototype.splitCells = function(client) {
    var len = client.cells.length;
    for (var i = 0; i < len; i++) {
        var cell = client.cells[i];
			
        if (client.cells.length >= this.config.playerMaxCells) {
            // Player cell limit
            continue;
        }

        if (!cell) {
            console.log("[Warning] Tried to split a non existing cell.");
            continue;
        }
        
        if (cell.mass < this.config.playerMinMassSplit) {
            continue;
        }
			
        // Get angle
        var deltaX = client.mouse[0] - cell.pos[0];
        var deltaY = client.mouse[1] - cell.pos[1];
        var angle = Math.atan2(deltaX,deltaY);
    	
        // Get starting position
        var size = cell.getSize();
        var startPos = [
            cell.pos[0] + ( (size + this.config.ejectMass) * Math.sin(angle) ), 
            cell.pos[1] + ( (size + this.config.ejectMass) * Math.cos(angle) )
        ];
        // Calculate mass of splitting cell
        var newMass = cell.mass / 2;
        cell.mass = newMass;
        // Create cell
        split = new Entity.PlayerCell(this.getNextNodeId(), client, startPos, newMass);
        split.setAngle(angle);
        split.setMoveEngineData(40 + (cell.getSpeed() * 4), 20);
        split.setRecombineTicks(this.config.playerRecombineTime);
    	
        // Add to moving cells list
        this.setAsMovingNode(split);
        this.addNode(split);
    }
}

GameServer.prototype.ejectMass = function(client) {
    for (var i = 0; i < client.cells.length; i++) {
        var cell = client.cells[i];
        
        if (!cell) {
            continue;
        }
       
        if (cell.mass < this.config.playerMinMassEject) {
            continue;
        }
        
        var deltaX = client.mouse[0] - cell.pos[0];
        var deltaY = client.mouse[1] - cell.pos[1];
        var angle = Math.atan2(deltaX,deltaY);
   	
        // Get starting position
        var size = cell.getSize() + 5;
        var startPos = [
            cell.pos[0] + ( (size + this.config.ejectMass) * Math.sin(angle) ), 
            cell.pos[1] + ( (size + this.config.ejectMass) * Math.cos(angle) )
        ];
        
        // Remove mass from parent cell
        cell.mass -= this.config.ejectMass;
        
        // Create cell
        ejected = new Entity.EjectedMass(this.getNextNodeId(), null, startPos, this.config.ejectMass);
        ejected.setAngle(angle);
        ejected.setMoveEngineData(this.config.ejectSpeed, 20);
        ejected.setColor(cell.getColor());
       
        // Add to moving cells list
        this.addNode(ejected);
        this.setAsMovingNode(ejected);
    }
}

GameServer.prototype.newCellVirused = function(client, parent, angle, mass, speed) {
    // Starting position
    var startPos = [parent.pos[0], parent.pos[1]];
	
	// Create cell
	newCell = new Entity.PlayerCell(this.getNextNodeId(), client, startPos, mass);
	newCell.setAngle(angle);
	newCell.setMoveEngineData(speed, 8);
	newCell.setRecombineTicks(this.config.playerRecombineTime);
	newCell.setCollisionOff(true); // Turn off collision
	
    // Add to moving cells list
    this.addNode(newCell);
    this.setAsMovingNode(newCell);
}

GameServer.prototype.shootVirus = function(parent) {
	var parentPos = [parent.pos[0], parent.pos[1]];
	
    var newVirus = new Entity.Virus(this.getNextNodeId(), null, parentPos, this.config.virusStartMass);
    newVirus.setAngle(parent.getAngle());
    newVirus.setMoveEngineData(200, 20);
	
    // Add to moving cells list
    this.addNode(newVirus);
    this.setAsMovingNode(newVirus);
}

GameServer.prototype.getCellsInRange = function(cell) {
    var list = new Array();
    var r = cell.getSize(); // Get cell radius (Cell size = radius)
	
    var topY = cell.pos[1] - r;
    var bottomY = cell.pos[1] + r;
	
    var leftX = cell.pos[0] - r;
    var rightX = cell.pos[0] + r;

    // Loop through all cells that are visible to the cell. There is probably a more efficient way of doing this but whatever
	var len = cell.owner.visibleNodes.length;
    for (var i = 0;i < len;i++) {
        var check = cell.owner.visibleNodes[i];
		
        if (typeof check === 'undefined') {
            continue;
        }
		
        // Can't eat itself
        if (cell.nodeId == check.nodeId) {
            continue;
        }
        
        // Can't eat cells that have collision turned off
        if ((cell.owner == check.owner) && (cell.getCollision())) {
            continue;
        }
        
        // AABB Collision
        if (!check.collisionCheck(bottomY,topY,rightX,leftX)) {
            continue;
        }

        // Cell type check - Cell must be bigger than this number times the mass of the cell being eaten
        var multiplier = 1.25;
		
        switch (check.getType()) {
            case 1: // Food cell
                list.push(check);
                continue;
            case 2: // Virus
                multiplier = 1.33;
                break;
            case 0: // Players
                multiplier = check.owner == cell.owner ? 1.00 : multiplier;
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
        var xs = Math.pow(check.pos[0] - cell.pos[0], 2);
        var ys = Math.pow(check.pos[1] - cell.pos[1], 2);
        var dist = Math.sqrt( xs + ys );
                
        var eatingRange = cell.getSize() - check.getEatingRange(); // Eating range = radius of eating cell + 1/3 of the radius of the cell being eaten
        if (dist > eatingRange) {
            // Not in eating range
            continue;
        }
		
        // Add to list of cells nearby
        list.push(check);
    }
    return list;
}

GameServer.prototype.getNearestVirus = function(cell) { 
	// More like getNearbyVirus
	var virus = null;
    var r = 100; // Checking radius
	
    var topY = cell.pos[1] - r;
    var bottomY = cell.pos[1] + r;
	
    var leftX = cell.pos[0] - r;
    var rightX = cell.pos[0] + r;

    // Loop through all viruses on the map. There is probably a more efficient way of doing this but whatever
	var len = this.nodesVirus.length;
    for (var i = 0;i < len;i++) {
        var check = this.nodesVirus[i];
		
        if (typeof check === 'undefined') {
            continue;
        }
		
        if (!check.collisionCheck(bottomY,topY,rightX,leftX)) {
            continue;
        }
        		
        // Add to list of cells nearby
        virus = check;
    }
    return virus;
}

GameServer.prototype.updateCells = function(){
    for (var i = 0; i < this.nodesPlayer.length; i++) {
        var cell = this.nodesPlayer[i];
        
        if (!cell) {
        	continue;
        }
        
        // Recombining
        if (cell.getRecombineTicks() > 0) {
            cell.setRecombineTicks(cell.getRecombineTicks() - 1);
        }
		
        // Mass decay
        if (cell.mass > this.config.playerMinMassDecay) {
            var decay = 0;
        	
            // Gamemode modifiers
            decay = decay * this.gameMode.decayMod;
        	
            cell.mass *= (1 - this.config.playerMassDecayRate);
        }
    }
}

// Custom prototype functions
WebSocket.prototype.sendPacket = function(packet) {
    function getbuf(data) {
        var array = new Uint8Array(data.buffer || data);
        var l = data.byteLength || data.length;
        var o = data.byteOffset || 0;
        var buffer = new Buffer(l);

        for (var i = 0; i < l; i++) {
            buffer[i] = array[o + i];
        }

        return buffer;
    }

    if (this.readyState == WebSocket.OPEN && packet.build) {
        var buf = packet.build();
        this.send(getbuf(buf), { binary: true });
    }
}
