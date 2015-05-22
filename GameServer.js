// Library imports
var WebSocket = require('ws');

// Project imports
var Packet = require('./packet');
var PlayerTracker = require('./PlayerTracker');
var PacketHandler = require('./PacketHandler');
var Cell = require('./Cell');

// GameServer implementation
function GameServer(port) {
    this.border = {
        left: 0,
        right: 2000.0,
        //right: 11180.3398875,
        top: 0,
        // Debugging food/virus spawn
        bottom: 2000.0
        //bottom: 11180.3398875
    }; // Right: X increases, Down: Y increases (as of 2015-05-20)
    this.lastNodeId = 1;
    this.clients = [];
    this.nodes = [];
    this.port = port;
    
    this.currentFood = 0;
    this.currentViruses = 0;
    this.movingCells = [];
    
    this.config = {
    	foodSpawnRate: 2000, // The interval between each food cell spawn in milliseconds (Placeholder number)
    	foodMaxAmount: 100, // Maximum food cells on the map (Placeholder number)
    	foodStartSize: 10.0, // Starting food size
    	foodMass: 2, // Amount of mass gained from consuming food
    	virusSpawnRate: 5000, // The interval between each virus spawn in milliseconds (Placeholder number)
    	virusMaxAmount: 1, //Maximum amount of viruses that can spawn randomly. Player made viruses do not count (Placeholder number)
    	virusStartSize: 100.0, // Starting virus size
    	virusExplodeSize: 198.0, // Viruses explode past this size
    	ejectStartSize: 32, // Radius of ejected mass
    	ejectMass: 16, //Amount of mass gained from consuming ejected cells (unused)
    	ejectRequiredMass: 36 //Mass required to eject a cell (unused)
    };
}

module.exports = GameServer;

GameServer.prototype.start = function() {
    this.socketServer = new WebSocket.Server({ port: this.port }, function() {
        console.log("[Game] Listening on port %d", this.port);
        setInterval(this.updateAll.bind(this), 100);
        setInterval(this.spawnFood.bind(this), this.config.foodSpawnRate);
        setInterval(this.spawnVirus.bind(this), this.config.virusSpawnRate);
        setInterval(this.updateMovingCells.bind(this), 100);
    }.bind(this));

    this.socketServer.on('connection', connectionEstablished.bind(this));

    function connectionEstablished(ws) {
        function close(error) {
            console.log("[Game] Disconnect: %s:%d", this.socket.remoteAddress, this.socket.remotePort);
            var index = this.server.clients.indexOf(this.socket);
            if (index != -1) {
                this.server.clients.splice(index, 1);
            }

            if (this.socket.playerTracker.cell) {
                this.server.removeNode(this.socket.playerTracker.cell);
            }
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

GameServer.prototype.getNextNodeId = function() {
    return this.lastNodeId++;
}

GameServer.prototype.getRandomPosition = function() {
    return {
        x: Math.floor(Math.random() * (this.border.right - this.border.left)) + this.border.left,
        y: Math.floor(Math.random() * (this.border.bottom - this.border.top)) + this.border.top
    };
}

GameServer.prototype.addNode = function(node) {
    this.nodes[node.nodeId] = node;
    
    //For each client connected, add the node to their addition queue
    for (var i = 0; i < this.clients.length; i++) {
        if (typeof this.clients[i] == "undefined") {
            continue;
        }

        this.clients[i].playerTracker.nodeAdditionQueue.push(node);
    }
}

GameServer.prototype.removeNode = function(node) {
    var index = this.nodes.indexOf(node);
    if (index != -1) {
        this.nodes.splice(index, 1);
    }

    for (var i = 0; i < this.clients.length; i++) {
        if (typeof this.clients[i] == "undefined") {
            continue;
        }

        this.clients[i].playerTracker.nodeDestroyQueue.push(node);
    }
}

GameServer.prototype.updateAll = function() {
    for (var i = 0; i < this.clients.length; i++) {
        if (typeof this.clients[i] == "undefined") {
            continue;
        }

        this.clients[i].playerTracker.update();
    }
}

GameServer.prototype.spawnFood = function() {
    if (this.currentFood < this.config.foodMaxAmount) {
        var f = new Cell(this.getNextNodeId(), "", this.getRandomPosition(), this.config.foodStartSize, 1);
        this.addNode(f);
        this.currentFood++;
    }
}

GameServer.prototype.spawnVirus = function() {
    if (this.currentViruses < this.config.virusMaxAmount) {
        var f = new Cell(this.getNextNodeId(), "", this.getRandomPosition(), this.config.virusStartSize, 2);
        this.addNode(f);
        this.currentViruses++;
    }
}

GameServer.prototype.updateMovingCells = function() {
    for (var i = 0; i < this.movingCells.length; i++) {
        var check = this.movingCells[i];
    	
        // Cleanup unused nodes
        while ((typeof check == "undefined") && (i < this.movingCells.length)) {
            // Remove moving cells that are undefined
            this.movingCells.splice(i, 1);
            check = movingCells[i];
        }
    	
        if (i >= this.movingCells.length) {
            continue;
        }
        
        if (check.getEnergy() > 0) {
            // If the cell has enough energy, then move it
            check.calcMovePhys();
            check.decrementEnergy();
        } else {
            // Remove cell from list
            var index = this.movingCells.indexOf(check);
            if (index != -1) {
                this.movingCells.splice(index, 1);
            }
        }
    }
}

GameServer.prototype.addMovingCell = function(node) {
	this.movingCells.push(node);
}

GameServer.prototype.getCellsInRange = function(cell) {
    var list = new Array();
    var r = cell.size * .8; // Get cell radius (Cell size = radius)
	
    var topY = cell.position.y - r;
    var bottomY = cell.position.y + r;
	
    var leftX = cell.position.x - r;
    var rightX = cell.position.x + r;
	
    // Loop through all cells on the map. There is probably a more efficient way of doing this but whatever
    for (var i = 0;i < this.nodes.length;i++) {
        var check = this.nodes[i];
		
        if (typeof check === 'undefined') {
            continue;
        }
		
        // Can't eat itself
        if (check.nodeId == cell.nodeId) {
            continue;
        }
        
        // Calculations (does not need to be 100% accurate right now)
        if (check.position.y > bottomY) {
            continue;
        } if (check.position.y < topY) {
            continue;
        } if (check.position.x > rightX) {
            continue;
        } if (check.position.x < leftX) {
            continue;
        } 
	
        // Make sure it is a food particle (This code will be changed later)
        if (check.getType() != 1){
            continue;
        }
	
        // Make sure the cell is big enough to be eaten. Cell must be at least 25% larger
        if (!cell.size > (check.size * 1.25)) {
            continue;
        }
		
        // Add to list of cells nearby
        list.push(check);
    }
    return list;
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
