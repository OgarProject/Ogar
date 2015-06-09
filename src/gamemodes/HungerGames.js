var Mode = require('./Mode');
var Entity = require('../entity');

function HungerGames() {
    Mode.apply(this, Array.prototype.slice.call(arguments));
	
    this.ID = 11;
    this.name = "Hunger Games";
    this.packetLB = 48;
    
    // Config (1 tick = 2000 ms)
    this.prepTime = 5; // Amount of ticks after the server fills up to wait until starting the game
    this.endTime = 15; // Amount of ticks after someone wins to restart the game
    this.autoFill = false;
    
    // Gamemode Specific Variables
    this.gamePhase = 0; // 0 = Waiting for players, 1 = Prepare to start, 2 = Game in progress, 3 = End
    this.tributes = [];
    this.maxTributes = 12;
    this.baseSpawnPoints = [
        {x: 1600,y: 200},{x: 3200,y: 200},{x: 4800,y: 200}, // Top
        {x: 200,y: 1600},{x: 200,y: 3200},{x: 200,y: 4800}, // Left
        {x: 6200,y: 1600},{x: 6200,y: 3200},{x: 6200,y: 4800}, // Right
        {x: 1600,y: 6200},{x: 3200,y: 6200},{x: 4800,y: 6200}  // Bottom
    ];
    this.tributeSpawnPoints;
    
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

HungerGames.prototype.spawnFood = function(gameServer,mass,pos) {
    var f = new Entity.Food(gameServer.getNextNodeId(), null, pos, mass);
    f.setColor(gameServer.getRandomColor());
    gameServer.addNode(f);
    gameServer.currentFood++; 
}

HungerGames.prototype.spawnVirus = function(gameServer,pos) {
    var v = new Entity.Virus(gameServer.getNextNodeId(), null, pos, gameServer.config.virusStartMass);
    gameServer.addNode(v);
}

HungerGames.prototype.startGamePrep = function(gameServer) {
    this.gamePhase = 1;
    this.timer = this.prepTime; // 10 seconds
}

HungerGames.prototype.startGame = function(gameServer) {
    gameServer.run = true;
    this.gamePhase = 2;
    this.getSpectate(); // Gets a random person to spectate
}

HungerGames.prototype.endGame = function(gameServer) {
    this.winner = this.tributes[0];
    this.gamePhase = 3;
    this.timer = this.endTime; // 30 Seconds
}

HungerGames.prototype.fillBots = function(gameServer) {
    // Fills the server with bots if there arent enough players
    var fill = this.maxTributes - this.tributes.length;
    for (var i = 0;i < fill;i++) {
        gameServer.bots.addBot(gameServer);
    }
}

HungerGames.prototype.getSpectate = function() {
    // Finds a random person to spectate
    var index = Math.floor(Math.random() * this.tributes.length);
    this.rankOne = this.tributes[index];
}

// Override

HungerGames.prototype.onServerInit = function(gameServer) {
	// Remove all cells
	var len = gameServer.nodes.length;
	for (var i = 0; i < len; i++) {
		var node = gameServer.nodes[0];
		
		if (!node) {
			continue;
		}
		
		gameServer.removeNode(node);
	}
	
	// Resets spawn points
    this.tributeSpawnPoints = this.baseSpawnPoints.slice();
	
	// Pauses the server
	gameServer.run = false;
	this.gamePhase = 0;
	
    // Override config values
    if (gameServer.config.tourneyAutoFill > 0) {
        this.timer = gameServer.config.tourneyAutoFill;
        this.autoFill = true;
    }
	if (gameServer.config.serverBots > this.maxTributes) {
		// The number of bots cannot exceed the maximum amount of tributes
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
    gameServer.config.foodMass = 2; // Food is scarce, but its worth more
    gameServer.config.virusMinAmount = 0;
    gameServer.config.virusMaxAmount = 100;
    gameServer.config.ejectSpawnPlayer = 0;
    
    // Spawn Initial Virus/Large food
    var mapWidth = gameServer.config.borderRight - gameServer.config.borderLeft;
    var mapHeight = gameServer.config.borderBottom - gameServer.config.borderTop;
    
    // Food
    this.spawnFood(gameServer,200,{x: mapWidth * .5,y: mapHeight * .5}); // Center
    this.spawnFood(gameServer,80,{x: mapWidth * .4,y: mapHeight * .6}); //
    this.spawnFood(gameServer,80,{x: mapWidth * .6,y: mapHeight * .6});
    this.spawnFood(gameServer,80,{x: mapWidth * .4,y: mapHeight * .4});
    this.spawnFood(gameServer,80,{x: mapWidth * .6,y: mapHeight * .4});
    this.spawnFood(gameServer,50,{x: mapWidth * .7,y: mapHeight * .5}); //
    this.spawnFood(gameServer,50,{x: mapWidth * .3,y: mapHeight * .5});
    this.spawnFood(gameServer,50,{x: mapWidth * .5,y: mapHeight * .7});
    this.spawnFood(gameServer,50,{x: mapWidth * .5,y: mapHeight * .3});
    this.spawnFood(gameServer,30,{x: mapWidth * .7,y: mapHeight * .625}); // Corner
    this.spawnFood(gameServer,30,{x: mapWidth * .625,y: mapHeight * .7});
    this.spawnFood(gameServer,30,{x: mapWidth * .3,y: mapHeight * .4});
    this.spawnFood(gameServer,30,{x: mapWidth * .4,y: mapHeight * .3});
    this.spawnFood(gameServer,30,{x: mapWidth * .6,y: mapHeight * .3});
    this.spawnFood(gameServer,30,{x: mapWidth * .7,y: mapHeight * .4});
    this.spawnFood(gameServer,30,{x: mapWidth * .3,y: mapHeight * .6});
    this.spawnFood(gameServer,30,{x: mapWidth * .4,y: mapHeight * .7});
    
    // Virus
    this.spawnVirus(gameServer,{x: mapWidth * .6,y: mapHeight * .5}); //
    this.spawnVirus(gameServer,{x: mapWidth * .4,y: mapHeight * .5});
    this.spawnVirus(gameServer,{x: mapWidth * .5,y: mapHeight * .4});
    this.spawnVirus(gameServer,{x: mapWidth * .5,y: mapHeight * .6});
    this.spawnVirus(gameServer,{x: mapWidth * .3,y: mapHeight * .3}); //
    this.spawnVirus(gameServer,{x: mapWidth * .3,y: mapHeight * .7});
    this.spawnVirus(gameServer,{x: mapWidth * .7,y: mapHeight * .3});
    this.spawnVirus(gameServer,{x: mapWidth * .7,y: mapHeight * .7});
    this.spawnVirus(gameServer,{x: mapWidth * .25,y: mapHeight * .6}); //
    this.spawnVirus(gameServer,{x: mapWidth * .25,y: mapHeight * .4});
    this.spawnVirus(gameServer,{x: mapWidth * .75,y: mapHeight * .6}); 
    this.spawnVirus(gameServer,{x: mapWidth * .75,y: mapHeight * .4});
    this.spawnVirus(gameServer,{x: mapWidth * .6,y: mapHeight * .25});
    this.spawnVirus(gameServer,{x: mapWidth * .4,y: mapHeight * .25});
    this.spawnVirus(gameServer,{x: mapWidth * .6,y: mapHeight * .75}); 
    this.spawnVirus(gameServer,{x: mapWidth * .4,y: mapHeight * .75});
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
		
        // Remove if being specated
		if (owner == this.rankOne) {
			this.getSpectate(); // Gets a random person to spectate
		}
        
		// Victory conditions
		if ((this.tributes.length == 1) && (this.gamePhase == 2)){
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
            if (this.autoFill) {
            	if (this.timer <= 0) {
                    this.fillBots(gameServer);
                } else {
                    this.timer--;
                }
            }
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

