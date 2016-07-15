var Tournament = require('./Tournament');
var Entity = require('../entity');

function HungerGames() {
    Tournament.apply(this, Array.prototype.slice.call(arguments));
    
    this.ID = 11;
    this.name = "Hunger Games";
    
    // Gamemode Specific Variables
    this.maxContenders = 12;
    this.baseSpawnPoints = [{
            x: 1600,
            y: 200
        }, {
            x: 3200,
            y: 200
        }, {
            x: 4800,
            y: 200
        }, // Top
        {
            x: 200,
            y: 1600
        }, {
            x: 200,
            y: 3200
        }, {
            x: 200,
            y: 4800
        }, // Left
        {
            x: 6200,
            y: 1600
        }, {
            x: 6200,
            y: 3200
        }, {
            x: 6200,
            y: 4800
        }, // Right
        {
            x: 1600,
            y: 6200
        }, {
            x: 3200,
            y: 6200
        }, {
            x: 4800,
            y: 6200
        } // Bottom
    ];
    this.contenderSpawnPoints;
    this.borderDec = 100; // Border shrinks by this size everytime someone dies
}

module.exports = HungerGames;
HungerGames.prototype = new Tournament();

// Gamemode Specific Functions

HungerGames.prototype.getPos = function () {
    var pos = {
        x: 0,
        y: 0
    };
    
    // Random Position
    if (this.contenderSpawnPoints.length > 0) {
        var index = Math.floor(Math.random() * this.contenderSpawnPoints.length);
        pos = this.contenderSpawnPoints[index];
        this.contenderSpawnPoints.splice(index, 1);
    }
    
    return {
        x: pos.x,
        y: pos.y
    };
};

HungerGames.prototype.spawnFood = function (gameServer, mass, pos) {
    var cell = new Entity.Food(gameServer, null, pos, mass);
    cell.setColor(gameServer.getRandomColor());
    gameServer.addNode(cell);
};

HungerGames.prototype.spawnVirus = function (gameServer, pos) {
    var v = new Entity.Virus(gameServer, null, pos, gameServer.config.virusMinSize);
    gameServer.addNode(v);
};

HungerGames.prototype.onPlayerDeath = function (gameServer) {
    gameServer.setBorder(
        gameServer.border.width - this.borderDec * 2, 
        gameServer.border.height - this.borderDec * 2);
    
    // Remove all cells
    var len = gameServer.nodes.length;
    for (var i = 0; i < len; i++) {
        var node = gameServer.nodes[i];
        
        if ((!node) || (node.getType() == 0)) {
            continue;
        }
        
        // Move
        if (node.position.x < gameServer.border.minx) {
            gameServer.removeNode(node);
            i--;
        } else if (node.position.x > gameServer.border.maxx) {
            gameServer.removeNode(node);
            i--;
        } else if (node.position.y < gameServer.border.miny) {
            gameServer.removeNode(node);
            i--;
        } else if (node.position.y > gameServer.border.maxy) {
            gameServer.removeNode(node);
            i--;
        }
    }
};

// Override

HungerGames.prototype.onServerInit = function (gameServer) {
    // Prepare
    this.prepare(gameServer);
    
    // Resets spawn points
    this.contenderSpawnPoints = this.baseSpawnPoints.slice();
    
    // Override config values
    if (gameServer.config.serverBots > this.maxContenders) {
        // The number of bots cannot exceed the maximum amount of contenders
        gameServer.config.serverBots = this.maxContenders;
    }
    gameServer.config.spawnInterval = 20;
    gameServer.config.borderWidth = 3200;
    gameServer.config.borderHeight = 3200;
    gameServer.config.foodSpawnAmount = 5; // This is hunger games
    gameServer.config.foodMinAmount = 100;
    gameServer.config.foodMaxAmount = 200;
    gameServer.config.foodMinSize = 10; // Food is scarce, but its worth more
    gameServer.config.virusMinAmount = 10; // We need to spawn some viruses in case someone eats them all
    gameServer.config.virusMaxAmount = 100;
    gameServer.config.ejectSpawnPlayer = 0;
    gameServer.config.playerDisconnectTime = 10; // So that people dont disconnect and stall the game for too long
    
    // Spawn Initial Virus/Large food
    var mapWidth = gameServer.border.width;
    var mapHeight = gameServer.border.height;
    
    // Food
    this.spawnFood(gameServer, 200, {
        x: mapWidth * .5,
        y: mapHeight * .5
    }); // Center
    this.spawnFood(gameServer, 80, {
        x: mapWidth * .4,
        y: mapHeight * .6
    }); //
    this.spawnFood(gameServer, 80, {
        x: mapWidth * .6,
        y: mapHeight * .6
    });
    this.spawnFood(gameServer, 80, {
        x: mapWidth * .4,
        y: mapHeight * .4
    });
    this.spawnFood(gameServer, 80, {
        x: mapWidth * .6,
        y: mapHeight * .4
    });
    this.spawnFood(gameServer, 50, {
        x: mapWidth * .7,
        y: mapHeight * .5
    }); //
    this.spawnFood(gameServer, 50, {
        x: mapWidth * .3,
        y: mapHeight * .5
    });
    this.spawnFood(gameServer, 50, {
        x: mapWidth * .5,
        y: mapHeight * .7
    });
    this.spawnFood(gameServer, 50, {
        x: mapWidth * .5,
        y: mapHeight * .3
    });
    this.spawnFood(gameServer, 30, {
        x: mapWidth * .7,
        y: mapHeight * .625
    }); // Corner
    this.spawnFood(gameServer, 30, {
        x: mapWidth * .625,
        y: mapHeight * .7
    });
    this.spawnFood(gameServer, 30, {
        x: mapWidth * .3,
        y: mapHeight * .4
    });
    this.spawnFood(gameServer, 30, {
        x: mapWidth * .4,
        y: mapHeight * .3
    });
    this.spawnFood(gameServer, 30, {
        x: mapWidth * .6,
        y: mapHeight * .3
    });
    this.spawnFood(gameServer, 30, {
        x: mapWidth * .7,
        y: mapHeight * .4
    });
    this.spawnFood(gameServer, 30, {
        x: mapWidth * .3,
        y: mapHeight * .6
    });
    this.spawnFood(gameServer, 30, {
        x: mapWidth * .4,
        y: mapHeight * .7
    });
    
    // Virus
    this.spawnVirus(gameServer, {
        x: mapWidth * .6,
        y: mapHeight * .5
    }); //
    this.spawnVirus(gameServer, {
        x: mapWidth * .4,
        y: mapHeight * .5
    });
    this.spawnVirus(gameServer, {
        x: mapWidth * .5,
        y: mapHeight * .4
    });
    this.spawnVirus(gameServer, {
        x: mapWidth * .5,
        y: mapHeight * .6
    });
    this.spawnVirus(gameServer, {
        x: mapWidth * .3,
        y: mapHeight * .3
    }); //
    this.spawnVirus(gameServer, {
        x: mapWidth * .3,
        y: mapHeight * .7
    });
    this.spawnVirus(gameServer, {
        x: mapWidth * .7,
        y: mapHeight * .3
    });
    this.spawnVirus(gameServer, {
        x: mapWidth * .7,
        y: mapHeight * .7
    });
    this.spawnVirus(gameServer, {
        x: mapWidth * .25,
        y: mapHeight * .6
    }); //
    this.spawnVirus(gameServer, {
        x: mapWidth * .25,
        y: mapHeight * .4
    });
    this.spawnVirus(gameServer, {
        x: mapWidth * .75,
        y: mapHeight * .6
    });
    this.spawnVirus(gameServer, {
        x: mapWidth * .75,
        y: mapHeight * .4
    });
    this.spawnVirus(gameServer, {
        x: mapWidth * .6,
        y: mapHeight * .25
    });
    this.spawnVirus(gameServer, {
        x: mapWidth * .4,
        y: mapHeight * .25
    });
    this.spawnVirus(gameServer, {
        x: mapWidth * .6,
        y: mapHeight * .75
    });
    this.spawnVirus(gameServer, {
        x: mapWidth * .4,
        y: mapHeight * .75
    });
};

HungerGames.prototype.onPlayerSpawn = function (gameServer, player) {
    // Only spawn players if the game hasnt started yet
    if ((this.gamePhase == 0) && (this.contenders.length < this.maxContenders)) {
        player.setColor(gameServer.getRandomColor()); // Random color
        this.contenders.push(player); // Add to contenders list
        gameServer.spawnPlayer(player, this.getPos());
        
        if (this.contenders.length == this.maxContenders) {
            // Start the game once there is enough players
            this.startGamePrep(gameServer);
        }
    }
};
