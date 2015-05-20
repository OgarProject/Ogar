var Packet = require('./packet');
var GameServer = require('./GameServer');

function PlayerTracker(gameServer, socket) {
    this.initialized = false;
    this.gameServer = gameServer;
    this.socket = socket;
    this.nodeAdditionQueue = [];
    this.nodeDestroyQueue = [];
    this.visibleNodes = [];
    this.cell = null;
    
    //Not needed
    //this.clear();
    //this.setBorder();
}

module.exports = PlayerTracker;

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
        var addQueueCopy = this.nodeAdditionQueue.slice(0);
        this.socket.sendPacket(new Packet.AddNodes(addQueueCopy));

        for (var i = 0; i < this.nodeAdditionQueue.length; i++) {
            this.visibleNodes.push(this.nodeAdditionQueue[i]);
        }

        this.nodeAdditionQueue = [];
    }

    // Update and destroy nodes
    this.socket.sendPacket(new Packet.UpdateNodes(this.nodeDestroyQueue.slice(0), this.visibleNodes));

    for (var i = 0; i < this.nodeDestroyQueue.length; i++) {
        var index = this.visibleNodes.indexOf(this.nodeDestroyQueue[i]);
        if (index > -1) {
            this.visibleNodes.splice(index, 1);
        } else {
            console.log("Warning: Node in destroy queue was never visible anyways!");
        }
    }

    this.nodeDestroyQueue = [];

    // Update leaderboard
    this.socket.sendPacket(new Packet.UpdateLeaderboard(this.visibleNodes));

    // No need to Update position when you already have the Update Nodes packet
    //var cell = this.cell;
    //if (cell) {
    //    this.socket.sendPacket(new Packet.UpdatePosition(cell.position.x, cell.position.y, 1));
    //}
}
