var Packet = require('./packet');
var GameServer = require('./GameServer');

function PlayerTracker(gameServer, socket) {
    this.isOnline = true;
    this.name = "";
    this.gameServer = gameServer;
    this.socket = socket;
    this.nodeDestroyQueue = [];
    this.visibleNodes = [];
    this.cells = [];
    this.score = 0; // Needed for leaderboard

    this.mouse = {x: 0, y: 0};
    this.tickLeaderboard = 0; // 
    this.tickViewBox = 0;
    
    this.team = 0;
    this.spectate = false;
    this.spectatedPlayer; // Current player that this player is watching
    
    // Viewing box
    this.sightRange = 0;
    this.centerPos = {x: 0, y: 0 }
    this.viewBox = {
        topY: 0,
        bottomY: 0,
        leftX: 0,
        rightX: 0,
        width: 0 // Half-width
    }
    
    // Gamemode function
    if (gameServer) {
        this.color = gameServer.getRandomColor(); // Get color
        gameServer.gameMode.onPlayerInit(this);
    }
}

module.exports = PlayerTracker;

// Setters/Getters

PlayerTracker.prototype.setStatus = function(bool) {
    this.isOnline = bool;
}

PlayerTracker.prototype.getStatus = function() {
    return this.isOnline;
}

PlayerTracker.prototype.setName = function(name) {
    this.name = name;
}

PlayerTracker.prototype.getName = function() {
    return this.name;
}

PlayerTracker.prototype.getScore = function(reCalcScore) {
    if (reCalcScore) {
        var s = 0;
        for (var i = 0; i < this.cells.length; i++) {
            s += this.cells[i].mass;
            this.score = s;
        }
    }
    return this.score;
}

PlayerTracker.prototype.setColor = function(color) {
    this.color.r = color.r;
    this.color.b = color.b;
    this.color.g = color.g;
}

PlayerTracker.prototype.getTeam = function() {
    return this.team;
}

// Functions

PlayerTracker.prototype.update = function() {
	// Actions buffer
    if (this.socket.packetHandler.pressSpace) {
        // Split cell
        this.gameServer.splitCells(this);
        this.socket.packetHandler.pressSpace = false;
    }
    if (this.socket.packetHandler.pressW) {
        // Eject mass
        this.gameServer.ejectMass(this);
        this.socket.packetHandler.pressW = false;
    }
    
	// Remove nodes from visible nodes if possible
    for (var i = 0; i < this.nodeDestroyQueue.length; i++) {
        var index = this.visibleNodes.indexOf(this.nodeDestroyQueue[i]);
        if (index > -1) {
            this.visibleNodes.splice(index, 1);
        }
    }

    // Get visible nodes every 200 ms
    var nonVisibleNodes = []; // Nodes that are not visible
    if (this.tickViewBox <= 0) {
        var newVisible = this.calcViewBox();
        
        // Compare and destroy nodes that are not seen
        for (var i = 0; i < this.visibleNodes.length; i++) {
            var index = newVisible.indexOf(this.visibleNodes[i]);
            if (index == -1) {
                // Not seen by the client anymore
                nonVisibleNodes.push(this.visibleNodes[i]);
            }
        }
        
        this.visibleNodes = newVisible;
        // Reset Ticks
        this.tickViewBox = 4;
    } else {
        this.tickViewBox--;
    }
    
    // Send packet
    this.socket.sendPacket(new Packet.UpdateNodes(this.nodeDestroyQueue.slice(0), this.visibleNodes, nonVisibleNodes));

    this.nodeDestroyQueue = []; // Reset destroy queue

    // Update leaderboard
    if (this.tickLeaderboard <= 0) {
        this.socket.sendPacket(new Packet.UpdateLeaderboard(this.gameServer.leaderboard,this.gameServer.gameMode.packetLB));
        this.tickLeaderboard = this.gameServer.config.leaderboardUpdateClient;
    } else {
        this.tickLeaderboard--;
    }
    
}

// Viewing box

PlayerTracker.prototype.updateSightRange = function() { // For view distance
    var totalSize = 1.0;
    var len = this.cells.length;
    
    for (var i = 0; i < len;i++) {
    	
        if (!this.cells[i]) {
            continue;
        }
    	
        totalSize += this.cells[i].getSize();
    }
    this.sightRange = this.gameServer.config.serverViewBase / Math.pow(Math.min(64.0 / totalSize, 1), 0.4);
}

PlayerTracker.prototype.updateCenter = function() { // Get center of cells
	var len = this.cells.length;
	
    if (len <= 0) {
        return; // End the function if no cells exsist
    }
    
    var X = 0;
    var Y = 0;
    for (var i = 0; i < len ;i++) {
    	
        if (!this.cells[i]) {
            continue;
        }
    	
        X += this.cells[i].position.x;
        Y += this.cells[i].position.y;
    }
    
    this.centerPos.x = X / len >> 0;
    this.centerPos.y = Y / len >> 0;
}

PlayerTracker.prototype.calcViewBox = function() {
    if (this.spectate) {
        // Spectate mode
        this.spectatedPlayer = this.gameServer.gameMode.rankOne;
        if (this.spectatedPlayer) {
            // Get spectated player's location and calculate zoom amount
            var specZoom = Math.sqrt(100 * this.spectatedPlayer.score);
            specZoom = Math.pow(Math.min(40.5 / specZoom, 1.0), 0.4) * 0.75;
            this.socket.sendPacket(new Packet.UpdatePosition(this.spectatedPlayer.centerPos.x,this.spectatedPlayer.centerPos.y,specZoom));
            return this.spectatedPlayer.visibleNodes;
        } else {
            return []; // Nothing
        }
    }
		
    // Main function
    this.updateSightRange();
    this.updateCenter();
	
    // Box
    this.viewBox.topY = this.centerPos.y - this.sightRange;
    this.viewBox.bottomY = this.centerPos.y + this.sightRange;
    this.viewBox.leftX = this.centerPos.x - this.sightRange;
    this.viewBox.rightX = this.centerPos.x + this.sightRange;
    this.viewBox.width = this.sightRange;
	
    var newVisible = [];
    for (var i = 0; i < this.gameServer.nodes.length ;i++) {
        node = this.gameServer.nodes[i];
		
        if (!node) {
            continue;
        }
		
        if (node.visibleCheck(this.viewBox,this.centerPos)) {
            // Cell is in range of viewBox
            newVisible.push(node);
        }
    }
    return newVisible;
}
