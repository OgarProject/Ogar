function PlayerHandler(gameServer) {
    this.gameServer = gameServer;
}

module.exports = PlayerHandler;

PlayerHandler.prototype.update = function() {
    var time = new Date();

    // List through all clients and check if update is needed
    for (var i = 0; i < this.gameServer.clients.length; i++) {
        var client = this.gameServer.clients[i];
        if (!client) continue;

        var rem = time - client.playerTracker.mapUpdateTime;
        if (rem >= 40) {
            client.playerTracker.mapUpdateTime = time;
            // Update client
            client.playerTracker.update();
            client.playerTracker.antiTeamTick();
        }
    }

    // Record time needed to update clients
    this.gameServer.ticksMapUpdate = new Date() - time;
};
