function Mode() {
    this.ID = -1;
    this.name = "Blank";
    this.decayMod = 1.0; // Modifier for decay rate (Multiplier)
    this.packetLB = 49; // Packet id for leaderboard packet (48 = Text List, 49 = List, 50 = Pie chart)
    this.haveTeams = false; // True = gamemode uses teams, false = gamemode doesnt use teams
    
    this.specByLeaderboard = false; // false = spectate from player list instead of leaderboard
}

module.exports = Mode;

// Override these

Mode.prototype.onServerInit = function (gameServer) {
    // Called when the server starts
    gameServer.run = true;
};

Mode.prototype.onTick = function (gameServer) {
    // Called on every game tick 
};

Mode.prototype.onChange = function (gameServer) {
    // Called when someone changes the gamemode via console commands
};

Mode.prototype.onPlayerInit = function (player) {
    // Called after a player object is constructed
};

Mode.prototype.onPlayerSpawn = function (gameServer, player) {
    // Called when a player is spawned
    player.setColor(gameServer.getRandomColor()); // Random color
    gameServer.spawnPlayer(player);
};

Mode.prototype.onCellAdd = function (cell) {
    // Called when a player cell is added
};

Mode.prototype.onCellRemove = function (cell) {
    // Called when a player cell is removed
};

Mode.prototype.onCellMove = function (cell, gameServer) {
    // Called when a player cell is moved
};

Mode.prototype.updateLB = function (gameServer) {
    gameServer.leaderboardType = this.packetLB;
    // Called when the leaderboard update function is called
};
