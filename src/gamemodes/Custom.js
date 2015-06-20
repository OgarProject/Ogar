var Mode = require('./Mode');

function Custom() {
    Mode.apply(this, Array.prototype.slice.call(arguments));
	
    this.ID = 2;
    this.name = "Custom";
}

module.exports = Custom;
Custom.prototype = new Mode();

// Override

Custom.prototype.onServerInit = function(gameServer) {
    // Called when the server starts
}

Custom.prototype.onPlayerInit = function(player) {
    // Called after a player object is constructed
}

Custom.prototype.onCellAdd = function(cell) {
    // Called when a player cell is added
}

Custom.prototype.onCellRemove = function(cell) {
	// Called when a player cell is removed
}

Custom.prototype.updateLB = function(gameServer) {
    // Called when the leaderboard update function is called
}

