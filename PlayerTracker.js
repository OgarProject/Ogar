var Packet = require('./packet');
var GameServer = require('./GameServer');

function PlayerTracker(gameServer, socket) {
    this.initialized = false;
    this.name = "";
    this.color = gameServer.getRandomColor();
    this.gameServer = gameServer;
    this.socket = socket;
    this.nodeDestroyQueue = [];
    this.visibleNodes = [];
    //this.cell = null; Depreciated, use this.cells instead
    this.cells = [];
    this.score = 0; // Needed for leaderboard

    this.mouseX = 0;
    this.mouseY = 0;
    this.tickLeaderboard = 0; // 
    
    // Viewing box
    this.sightRange = 0;
    this.centerPos = {
        x: 0,
        y: 0
    }
    this.viewBox = {
        topY: 0,
        bottomY: 0,
        leftX: 0,
        rightX: 0
    }
}

module.exports = PlayerTracker;

PlayerTracker.prototype.setName = function(name) {
    this.name = name;
}

PlayerTracker.prototype.getName = function() {
    return this.name;
}

PlayerTracker.prototype.getMouseX = function() {
    return this.mouseX;
}

PlayerTracker.prototype.getMouseY = function() {
    return this.mouseY;
}

PlayerTracker.prototype.setMouseX = function(n) {
    this.mouseX = n;
}

PlayerTracker.prototype.setMouseY = function(n) {
    this.mouseY = n;
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

// Functions

PlayerTracker.prototype.clear = function() {
    this.socket.sendPacket(new Packet.ClearNodes());
}

PlayerTracker.prototype.setBorder = function() {
    var border = this.gameServer.border;
    this.socket.sendPacket(new Packet.SetBorder(border.left, border.right, border.top, border.bottom));
}

PlayerTracker.prototype.update = function() {
    if (!this.initialized) {
        this.nodeAdditionQueue = this.gameServer.nodes.slice(0);
        this.initialized = true;
    }
    
    // Update and destroy nodes (Obsolete)
    for (var i = 0; i < this.nodeDestroyQueue.length; i++) {
        var index = this.visibleNodes.indexOf(this.nodeDestroyQueue[i]);
        if (index > -1) {
            this.visibleNodes.splice(index, 1);
        } else {
            this.nodeDestroyQueue.splice(i,1);
            //console.log("Warning: Node in destroy queue was never visible anyways!");
        }
    }
    
    // Get visible nodes
    this.visibleNodes = this.calcViewBox();
    
    // Send packet
    this.socket.sendPacket(new Packet.UpdateNodes(this.nodeDestroyQueue.slice(0), this.visibleNodes));

    this.nodeDestroyQueue = []; // Reset destroy queue

    // Update leaderboard
    if (this.tickLeaderboard <= 0) {
        this.socket.sendPacket(new Packet.UpdateLeaderboard(this.gameServer.leaderboard));
        this.tickLeaderboard = 20; //Updates every 2 seconds - Saves server resources
    } else {
        this.tickLeaderboard--;
    }
    
}

// Viewing box

PlayerTracker.prototype.updateSightRange = function() { // For view distance
    var range = 750;
    var len = this.cells.length;
    
    for (var i = 0; i < len;i++) {
    	
        if (!this.cells[i]) {
            continue;
        }
    	
        range += (this.cells[i].mass + 100);
    }
    this.sightRange = range;
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
    
    this.centerPos.x = X / len;
    this.centerPos.y = Y / len;
}

PlayerTracker.prototype.calcViewBox = function() {
	this.updateSightRange();
	this.updateCenter();
	
	// Box
	this.viewBox.topY = this.centerPos.y - this.sightRange;
	this.viewBox.bottomY = this.centerPos.y + this.sightRange;
	
	this.viewBox.leftX = this.centerPos.x - this.sightRange;
	this.viewBox.rightX = this.centerPos.x + this.sightRange;
	
	var newVisible = [];
	for (var i = 0; i < this.gameServer.nodes.length ;i++) {
		node = this.gameServer.nodes[i];
		
		if (!node) {
			continue;
		}
		
		if (node.collisionCheck(this.viewBox.bottomY,this.viewBox.topY,this.viewBox.rightX,this.viewBox.leftX)) {
			// Cell is in range of viewBox
			newVisible.push(node);
			
			//
		}
    }
	return newVisible;
}
