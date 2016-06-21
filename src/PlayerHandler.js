function PlayerHandler(gameServer) {
    this.gameServer = gameServer;
    this.tick = 0;
}

module.exports = PlayerHandler;

PlayerHandler.prototype.update = function() {
    // List through all clients and check if update is needed
    if (this.gameServer.serverLoadSpread < 0) {
        this.tick--;
        if (this.tick > 0) return;
        this.tick = 40;
    }
    
    for (var i = 0; i < this.gameServer.clients.length; i++) {
        var client = this.gameServer.clients[i];
        if (!client) continue;
        
        if (this.gameServer.serverLoadSpread >= 1) {
            client.playerTracker.mapUpdate--;
            if (client.mapUpdate > 0) continue;
            client.playerTracker.mapUpdate = 40;
        }
        
        // Update client
        client.playerTracker.update();
        client.playerTracker.antiTeamTick();
    }
};
