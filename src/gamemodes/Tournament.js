var Mode = require('./Mode');

function Tournament() {
    Mode.apply(this, Array.prototype.slice.call(arguments));
	
    this.ID = 10;
    this.name = "Tournament";
    this.packetLB = 48;
    
    // Config (1 tick = 2000 ms)
    this.prepTime = 5; // Amount of ticks after the server fills up to wait until starting the game
    this.endTime = 15; // Amount of ticks after someone wins to restart the game
    
    // Gamemode Specific Variables
    this.gamePhase = 0; // 0 = Waiting for players, 1 = Prepare to start, 2 = Game in progress, 3 = End
    this.contenders = [];
    this.maxContenders = 12;
    
    this.winner;
    this.timer;
}

module.exports = Tournament;
Tournament.prototype = new Mode();

// Gamemode Specific Functions

Tournament.prototype.startGamePrep = function(gameServer) {
	this.gamePhase = 1;
	this.timer = this.prepTime; // 10 seconds
}

Tournament.prototype.startGame = function(gameServer) {
	gameServer.run = true;
	this.gamePhase = 2;
}

Tournament.prototype.endGame = function(gameServer) {
	this.winner = this.contenders[0];
	this.gamePhase = 3;
	this.timer = this.endTime; // 30 Seconds
}

// Override

Tournament.prototype.onServerInit = function(gameServer) {
	// Remove all cells
	for (var i = 0; i < gameServer.nodes.length; i++) {
		var node = gameServer.nodes[i];
		
		if (!node) {
			continue;
		}
		
		gameServer.removeNode(node);
	}
	
	// Pauses the server
	gameServer.run = false;
	this.gamePhase = 0;
	
	// Get config values
	this.prepTime = gameServer.config.tourneyPrepTime;
	this.endTime = gameServer.config.tourneyEndTime;
	this.maxContenders = gameServer.config.tourneyMaxPlayers;
}

Tournament.prototype.onPlayerSpawn = function(gameServer,player) {
    // Only spawn players if the game hasnt started yet
	if ((this.gamePhase == 0) && (this.contenders.length < this.maxContenders)) {
		gameServer.spawnPlayer(player);
		this.contenders.push(player); // Add to contenders list
		
		if (this.contenders.length == this.maxContenders) {
			// Start the game once there is enough players
			this.startGamePrep(gameServer);
		}
	}
}

Tournament.prototype.onCellRemove = function(cell) {
	var owner = cell.owner;
	if (owner.cells.length <= 0) {
		// Remove from contenders list
		var index = this.contenders.indexOf(owner);
		if (index != -1) {
			this.contenders.splice(index,1);
		}
        
		// Victory conditions
		if (this.contenders.length == 1) {
			this.endGame(cell.owner.gameServer);
		}
	}
}

Tournament.prototype.updateLB = function(gameServer) {
    var lb = gameServer.leaderboard;
    
    switch (this.gamePhase) {
        case 0:
    	    lb[0] = "Waiting for";
    	    lb[1] = "players: ";
    	    lb[2] = this.contenders.length+"/"+this.maxContenders;
    	    break;
        case 1:
        	lb[0] = "Game starting in";
        	lb[1] = (this.timer * 2).toString();
        	lb[2] = "Good luck!";
        	if (this.timer <= 0) {
            	// Reset the game
                this.startGame(gameServer);
            } else {
                this.timer--;
            }
        	break;
        case 2:
    	    lb[0] = "Players Remaining";
    	    lb[1] = this.contenders.length+"/"+this.maxContenders;
    	    break;
        case 3:
        	lb[0] = "Congratulations";
    	    lb[1] = this.winner.getName();
    	    lb[2] = "for winning!";
            if (this.timer <= 0) {
            	// Reset the game
                this.onServerInit(gameServer);
            } else {
                this.timer--;
            }
        	break;
        default:
        	break;
    }  
}
