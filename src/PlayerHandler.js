function PlayerHandler(gameServer) {
    this.gameServer = gameServer;
    this.tPFOV = 0;
}

module.exports = PlayerHandler;

PlayerHandler.prototype.update = function() {
    // List through all clients in queue
    for (var i = 0; i < this.gameServer.clients.length; i++) {
        var client = this.gameServer.clients[i];
        if (!client) continue;
        if (client.fullyDisconnected) continue;

        client = client.playerTracker;

        // Update client
        client.update();
        client.antiTeamTick();
    }
    this.gameServer.updateLog['ph-clients-fov'] = this.tPFOV;
    this.tPFOV = 0;
};
