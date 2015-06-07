var Mode = require('./Mode');

function HungerGames() {
    Mode.apply(this, Array.prototype.slice.call(arguments));
	
    this.ID = 11;
    this.name = "Hunger Games";
    this.packetLB = 48;
    
    // Config (1 tick = 2000 ms)
    this.prepTime = 5; // Amount of ticks after the server fills up to wait until starting the game
    this.endTime = 15; // Amount of ticks after someone wins to restart the game
    
    // Gamemode Specific Variables
    this.gamePhase = 0; // 0 = Waiting for players, 1 = Prepare to start, 2 = Game in progress, 3 = End
    this.tributes = [];
    this.maxTributes = 12;
    this.tributeSpawnPoints = [
        {x: 1600,y: 400},{x: 3200,y: 400},{x: 4800,y: 400}, // Top
        {x: 400,y: 1600},{x: 400,y: 3200},{x: 400,y: 4800}, // Left
        {x: 6000,y: 1600},{x: 6000,y: 3200},{x: 6000,y: 4800}, // Right
        {x: 1600,y: 6000},{x: 3200,y: 6000},{x: 4800,y: 6000}  // Bottom
    ];
    
    this.winner;
    this.timer;
}

module.exports = HungerGames;
HungerGames.prototype = new Mode();

// Gamemode Specific Functions

HungerGames.prototype.getPos = function() {
	var pos = {x: 0, y: 0};
	
	// Random Position
	if (this.tributeSpawnPoints.length > 0) {
		var index = Math.floor(Math.random() * this.tributeSpawnPoints.length);
		pos = this.tributeSpawnPoints[index];
		this.tributeSpawnPoints.splice(index,1);
	}
	
	return {x: pos.x, y: pos.y};
}

HungerGames.prototype.startGamePrep = function(gameServer) {
	this.gamePhase = 1;
	this.timer = this.prepTime; // 10 seconds
}

HungerGames.prototype.startGame = function(gameServer) {
	gameServer.run = true;
	this.gamePhase = 2;
}

HungerGames.prototype.endGame = function(gameServer) {
	this.winner = this.tributes[0];
	this.gamePhase = 3;
	this.timer = this.endTime; // 30 Seconds
}

// Override

HungerGames.prototype.onServerInit = function(gameServer) {
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
	
    // Override config values
	if (gameServer.config.serverBots > this.maxTributes) {
		// the number of bots cannot exceed the maximum amount of tributes
		gameServer.config.serverBots = this.maxTributes;
	}
    gameServer.config.spawnInterval = 20;
    gameServer.config.borderLeft = 0;
    gameServer.config.borderRight = 6400;
    gameServer.config.borderTop = 0;
    gameServer.config.borderBottom = 6400;
    gameServer.config.foodSpawnAmount = 3; // This is hunger games
    gameServer.config.foodStartAmount = 100;
    gameServer.config.foodMaxAmount = 200;
    gameServer.config.virusMinAmount = 0;
    gameServer.config.virusMaxAmount = 100;
    gameServer.config.ejectSpawnPlayer = 0;
    
    // Spawn Initial Virus/Large food
    var mapWidth = gameServer.config.borderRight - gameServer.config.borderLeft;
    var mapHeight = gameServer.config.borderBottom - gameServer.config.borderTop;
    
    
}

HungerGames.prototype.onPlayerSpawn = function(gameServer,player) {
    // Only spawn players if the game hasnt started yet
	if ((this.gamePhase == 0) && (this.tributes.length < this.maxTributes)) {
		gameServer.spawnPlayer(player);
		this.tributes.push(player); // Add to tribute list
		player.cells[0].position = this.getPos(); // Get random starting position
		
		if (this.tributes.length == this.maxTributes) {
			// Start the game once there is enough players
			this.startGamePrep(gameServer);
		}
	}
}

HungerGames.prototype.onCellRemove = function(cell) {
	var owner = cell.owner;
	if (owner.cells.length <= 0) {
		// Remove from tribute list
		var index = this.tributes.indexOf(owner);
		if (index != -1) {
			this.tributes.splice(index,1);
		}
        
		// Victory conditions
		if (this.tributes.length == 1) {
			this.endGame(cell.owner.gameServer);
		}
	}
}

HungerGames.prototype.updateLB = function(gameServer) {
    var lb = gameServer.leaderboard;
    
    switch (this.gamePhase) {
        case 0:
    	    lb[0] = "Waiting for";
    	    lb[1] = "players: ";
    	    lb[2] = this.tributes.length+"/"+this.maxTributes;
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
    	    lb[1] = this.tributes.length+"/"+this.maxTributes;
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

