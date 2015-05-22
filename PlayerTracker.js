var Packet = require('./packet');
var GameServer = require('./GameServer');

function PlayerTracker(gameServer, socket) {
    this.initialized = false;
    this.name = "";
    this.gameServer = gameServer;
    this.socket = socket;
    this.nodeAdditionQueue = [];
    this.nodeDestroyQueue = [];
    this.visibleNodes = [];
    //this.cell = null; Depreciated, use this.cells instead
    this.cells = [];
    this.score = 0;

    this.mouseX = 0;
    this.mouseY = 0;
    this.updateLBTicks = 0; // 
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

PlayerTracker.prototype.addCell = function(node) {
    this.cells.push(node);
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
    
    // Add nodes
    if (this.nodeAdditionQueue.length > 0) {
    	/* This code was causing issues when multiple clients connected to the server
        var addQueueCopy = this.nodeAdditionQueue.slice(0);
        this.socket.sendPacket(new Packet.AddNodes(addQueueCopy));
        */

        for (var i = 0; i < this.nodeAdditionQueue.length; i++) {
            this.visibleNodes.push(this.nodeAdditionQueue[i]);
        }

        this.nodeAdditionQueue = [];
    }

    // Update and destroy nodes
    for (var i = 0; i < this.nodeDestroyQueue.length; i++) {
        var index = this.visibleNodes.indexOf(this.nodeDestroyQueue[i]);
        if (index > -1) {
            this.visibleNodes.splice(index, 1);
        } else {
            console.log("Warning: Node in destroy queue was never visible anyways!");
        }
    }
    
    this.socket.sendPacket(new Packet.UpdateNodes(this.nodeDestroyQueue.slice(0), this.visibleNodes));

    this.nodeDestroyQueue = [];

    // Update leaderboard
    if (this.updateLBTicks <= 0) {
        this.socket.sendPacket(new Packet.UpdateLeaderboard(this.gameServer.leaderboard));
        this.updateLBTicks = 20; //Updates every 2 seconds - Saves server resources
    } else {
        this.updateLBTicks--;
    }
    
}
