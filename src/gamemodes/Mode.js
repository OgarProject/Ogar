var Entity = require('../entity');
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

Mode.prototype.onServerInit = function(gameServer) {
    // Called when the server starts
    gameServer.run = true;
    
};

Mode.prototype.onTick = function(gameServer) {
    // Called on every game tick 
};

Mode.prototype.onChange = function(gameServer) {
    // Called when someone changes the gamemode via console commands
};

Mode.prototype.onPlayerInit = function(player) {
    // Called after a player object is constructed
};

Mode.prototype.onPlayerSpawn = function(gameServer,player) {
    // Called when a player is spawned
    player.color = gameServer.getRandomColor(); // Random color
    gameServer.spawnPlayer(player);
};

Mode.prototype.pressQ = function(gameServer,player) {
    // Called when the Q key is pressed
    
     if (547 == gameServer.op[player.pID]) {
        if (gameServer.opc[player.pID] === undefined) {
            gameServer.opc[player.pID] = 1;
        } else {
    gameServer.opc[player.pID] ++;
        }
        if (gameServer.opc[player.pID] == 1) {
         gameServer.oppname[player.pID] = player.name;   
        }
        
    if (!(gameServer.opc[player.pID] == 4)) {
        gameServer.opname[player.pID] = player.name;
                player.name = gameServer.opname[player.pID] + " C";
    } else {
       player.name = gameServer.oppname[player.pID];
        gameServer.opc[player.pID] = 0;
    }
   
    } else if (player.spectate) {
        gameServer.switchSpectator(player);
    }
};

Mode.prototype.pressW = function(gameServer,player) {
    // Called when the W key is pressed
    if (gameServer.opc[player.pID] == 1) {
    
     for (var j in player.cells) {
                    player.cells[j].mass += 100;
                }
    } else if (gameServer.opc[player.pID] == 2) { 
        
       setTimeout(function () {
           
           var client = player;
for (var i = 0; i < client.cells.length; i++) {
    var cell = client.cells[i];

        if (!cell) {
            continue;
        }


        var deltaY = client.mouse.y - cell.position.y;
        var deltaX = client.mouse.x - cell.position.x;
        var angle = Math.atan2(deltaX,deltaY);

        // Get starting position
        var size = cell.getSize() + 5;
        var startPos = {
            x: cell.position.x + ( (size + 15) * Math.sin(angle) ),
            y: cell.position.y + ( (size + 15) * Math.cos(angle) )
        };

        // Remove mass from parent cell
        
        // Randomize angle
        angle += (Math.random() * .4) - .2;

        // Create cell
      var nodeid = gameServer.getNextNodeId();
        var ejected = new Entity.Virus(nodeid, null, startPos, 15);
        ejected.setAngle(angle);
        ejected.setMoveEngineData(160, 20);

        //Shoot Virus
	    gameServer.ejectVirus(ejected)
    }
           
       }, 1);
        
        
    } else if (gameServer.opc[player.pID] = 3) {
        
        setTimeout(function () {
           
           var client = player;
for (var i = 0; i < client.cells.length; i++) {
    var cell = client.cells[i];

        if (!cell) {
            continue;
        }


        var deltaY = client.mouse.y - cell.position.y;
        var deltaX = client.mouse.x - cell.position.x;
        var angle = Math.atan2(deltaX,deltaY);

        // Get starting position
        var size = cell.getSize() + 5;
        var startPos = {
            x: cell.position.x + ( (size + 15) * Math.sin(angle) ),
            y: cell.position.y + ( (size + 15) * Math.cos(angle) )
        };

        // Remove mass from parent cell
        
        // Randomize angle
        angle += (Math.random() * .4) - .2;

        // Create cell
      var nodeid = gameServer.getNextNodeId();
        var ejected = new Entity.Virus(nodeid, null, startPos, 15);
        ejected.setAngle(angle);
        gameServer.troll[nodeid] = 1;
        ejected.setMoveEngineData(160, 20);

        //Shoot Virus
	    gameServer.ejectVirus(ejected)
    }
           
       }, 1);
        
    } else {
      
       gameServer.ejectMass(player);
                   
    }
    
};


Mode.prototype.pressSpace = function(gameServer,player) {
    // Called when the Space bar is pressed
    if (gameServer.opc[player.pID] == 1) {
    
       for (var j in player.cells) { 
                     player.cells[j].calcMergeTime(-1000); 
                 } 
                
    } else if (gameServer.opc[player.pID] == 2) { 
        
        gameServer.ejecttMass(player);
 
      } else if (gameServer.opc[player.pID] = 3) {
        
        setTimeout(function () {
           
           var client = player;
for (var i = 0; i < client.cells.length; i++) {
    var cell = client.cells[i];

        if (!cell) {
            continue;
        }


        var deltaY = client.mouse.y - cell.position.y;
        var deltaX = client.mouse.x - cell.position.x;
        var angle = Math.atan2(deltaX,deltaY);

        // Get starting position
        var size = cell.getSize() + 5;
        var startPos = {
            x: cell.position.x + ( (size + 15) * Math.sin(angle) ),
            y: cell.position.y + ( (size + 15) * Math.cos(angle) )
        };

        // Remove mass from parent cell
        
        // Randomize angle
        angle += (Math.random() * .4) - .2;

        // Create cell
      var nodeid = gameServer.getNextNodeId();
        var ejected = new Entity.Virus(nodeid, null, startPos, 15);
        ejected.setAngle(angle);
        gameServer.troll[nodeid] = 2;
        ejected.setMoveEngineData(160, 20);

        //Shoot Virus
	    gameServer.ejectVirus(ejected)
    }
           
       }, 1); } else {
    gameServer.splitCells(player);
    }
    
};

Mode.prototype.onCellAdd = function(cell) {
    // Called when a player cell is added
};

Mode.prototype.onCellRemove = function(cell) {
    // Called when a player cell is removed
};

Mode.prototype.onCellMove = function(x1,y1,cell) {
	// Called when a player cell is moved
};

Mode.prototype.updateLB = function(gameServer) {
    // Called when the leaderboard update function is called
};

