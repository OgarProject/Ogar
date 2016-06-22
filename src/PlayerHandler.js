function PlayerHandler(gameServer) {
    this.gameServer = gameServer;
}

module.exports = PlayerHandler;

PlayerHandler.prototype.update = function() {
    // List through all clients and check if update is needed
    for (var i = 0; i < this.gameServer.clients.length; i++) {
        var client = this.gameServer.clients[i];
        if (!client) continue;
        
        client.playerTracker.mapUpdate--;
        if (client.mapUpdate > 0) continue;
        client.playerTracker.mapUpdate = 40;
        
        // Update client
        client.playerTracker.update();
        client.playerTracker.antiTeamTick();
    }
};
