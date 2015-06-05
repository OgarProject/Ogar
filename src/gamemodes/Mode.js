function Mode() {
    this.ID = -1;
    this.name = "Blank";
    this.decayMod = 1.0; // Modifier for decay rate (Multiplier)
    this.packetLB = 49; // Packet id for leaderboard packet (49 = List, 50 = Pie chart)
    this.haveTeams = false; // True = gamemode uses teams, false = gamemode doesnt use teams
    
    this.rankOne; // Current player that has the highest score
}

module.exports = Mode;

// Override these

Mode.prototype.onServerInit = function(gameServer) {
    // Called when the server starts
}

Mode.prototype.onPlayerInit = function(player) {
    // Called after a player object is constructed
}

Mode.prototype.onCellAdd = function(cell) {
    // Called when a player cell is added
}

Mode.prototype.onCellRemove = function(cell) {
	// Called when a player cell is removed
}

Mode.prototype.updateLB = function(gameServer) {
    // Called when the leaderboard update function is called
}
