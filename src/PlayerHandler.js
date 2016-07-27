function PlayerHandler(gameServer) {
    this.toUpdate = [];
    this.gameServer = gameServer;
}

module.exports = PlayerHandler;

PlayerHandler.prototype.update = function() {
    var time = new Date();

    // List through all clients in queue
    while (this.toUpdate.length > 0) {
        var client = this.toUpdate[0];
        if (!client) continue;
        if (client.fullyDisconnected) continue;

        // Update client
        client.update();
        client.antiTeamTick();

        this.toUpdate.shift();
        // Continue bind
        setTimeout(function() {
            if (this.fullyDisconnected) return;
            this.gameServer.playerHandler.toUpdate.push(this);
        }.bind(client), 40);
    }

    // Record time needed to update clients
    this.gameServer.ticksMapUpdate = new Date() - time;
};

PlayerHandler.prototype.addClient = function(client) {
    this.toUpdate.push(client.playerTracker);
    this.gameServer.nodeHandler.toUpdate.push(client.playerTracker);
};
