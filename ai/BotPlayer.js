var PlayerTracker = require('../PlayerTracker');

function BotPlayer() {
	PlayerTracker.apply(this, Array.prototype.slice.call(arguments));
	//this.color = gameServer.getRandomColor();
	
	// AI only
	this.gameState = 0;
	this.predators = []; // List of cells that can eat this bot
	this.prey = []; // List of cells that can be eaten by this bot
	this.food = [];
	
	this.target;
}

module.exports = BotPlayer;
BotPlayer.prototype = new PlayerTracker();

// Functions

BotPlayer.prototype.getLowestCell = function() {
	// Gets the cell with the lowest mass
	if (this.cells.length <= 0) {
		return null; // Error!
	}
	
	// Starting cell
	var lowest = this.cells[0];
	for (i = 1; i < this.cells.length; i++) {
		if (lowest.mass > this.cells[i].mass) {
		    lowest = this.cells[i];	
		}
	}
	return lowest;
}

// Override

BotPlayer.prototype.updateSightRange = function() { // For view distance
    var range = 1000;
    range += this.cells[0].getSize() * 2.5;
	
    this.sightRange = range;
}

BotPlayer.prototype.update = function() { // Overrides the update function from player tracker
    // Remove nodes from visible nodes if possible
    for (var i = 0; i < this.nodeDestroyQueue.length; i++) {
        var index = this.visibleNodes.indexOf(this.nodeDestroyQueue[i]);
        if (index > -1) {
            this.visibleNodes.splice(index, 1);
        }
    }
	
    // Respawn if bot is dead
    if (this.cells.length <= 0) {
        this.gameServer.spawnPlayer(this);
    }

    // Update every 500 ms
    if (this.tickViewBox <= 0) {
        this.visibleNodes = this.calcViewBox();
        this.tickViewBox = 10;
    } else {
        this.tickViewBox--;
        return;
    }
	
	// Calc predators/prey
    var cell = this.getLowestCell();
    this.predators = [];
    this.prey = [];
    this.food = [];
    
    var ignoreMass = Math.min((cell.mass / 10), 100); // Ignores targeting cells below this mass
    // Loop
    for (i in this.visibleNodes) {
        var check = this.visibleNodes[i];
		
        // Cannot target itself
        if ((!check) || (cell.owner == check.owner)){
            continue;
        }
		
        var t = check.getType();
        if (t == 0) {
            // Cannot target teammates
            if (this.gameServer.gameMode.haveTeams) {
                if (check.owner.team == this.team) {
                    continue;
                }
            }
	        
            // Check for danger
            if (cell.mass > (check.mass * 1.25)){
                //if (check.mass > ignoreMass) {
                    // Prey
                this.prey.push(check);
                //}
            } else if (check.mass > (cell.mass * 1.25)) {
                // Predator
                this.predators.push(check);
            }
        } else if (t == 1) { // Food
            this.food.push(check);
        } else if (t == 3) { // Ejected mass
            if (cell.mass > 20) {
                this.food.push(check);
            }
        }
    }
	
    // Action
    this.decide(cell);
	
    this.nodeDestroyQueue = []; // Empty
}

// Custom

BotPlayer.prototype.decide = function(cell) {
	// Check for predators
	if (this.predators.length <= 0) {
		if (this.prey.length > 0) {
			this.gameState = 3;
		} else if (this.food.length > 0) {
			this.gameState = 1;
		} else {
			this.gameState = 0;
		}
	} else {
		// Run
		this.gameState = 2;
	}
	
    switch (this.gameState) {
        case 0: // Wander
            //console.log("[Bot] "+cell.getName()+": Wandering");
            if ((cell.position.x == this.mouseX) && (cell.position.y == this.mouseY)) {
                // Get a new position
                var index = Math.floor(Math.random() * this.gameServer.nodes.length);
                var randomNode = this.gameServer.nodes[index];
                var pos = {x: 0, y: 0};
		        
                if (randomNode.getType() == 3 | 1) {
                    pos.x = randomNode.position.x;
                    pos.y = randomNode.position.y;
                } else {
                    // Not a food/ejected cell
                    pos = this.gameServer.getRandomPosition();
                }
		        
                // Set bot's mouse coords to this location
                this.mouse = {x: pos.x, y: pos.y};
            }
            break;
        case 1: // Looking for food
            //console.log("[Bot] "+cell.getName()+": Getting Food");
            if ((!this.target) || (this.target.getType() == 0) || (this.visibleNodes.indexOf(this.target) == -1)) {
                // Food is eaten/a player cell/out of sight... so find a new food cell to target
                this.target = this.findNearest(cell,this.food);
							
                this.mouse = {x: this.target.position.x, y: this.target.position.y};
            }
            break;
        case 2: // Run from (potential) predators
            var avoid = this.predators[0];
            //console.log("[Bot] "+cell.getName()+": Fleeing from "+avoid.getName());
	    	
            // Find angle of vector between cell and predator
            var deltaY = avoid.position.y - cell.position.y;
            var deltaX = avoid.position.x - cell.position.x;
            var angle = Math.atan2(deltaX,deltaY);
            
            // Now reverse the angle
            if (angle > Math.PI) {
                angle -= Math.PI;
            } else {
                angle += Math.PI;
            }
	    	
            // Direction to move
            var x1 = cell.position.x + (500 * Math.sin(angle));
            var y1 = cell.position.y + (500 * Math.cos(angle));
			
            if ((!this.target) || (this.target.getType() == 0) || (this.visibleNodes.indexOf(this.target) == -1)) {
                var foods = this.getFoodBox(x1,y1);
                if (foods) {
                    this.target = this.findNearest(cell, this.food);
				
                    this.mouseX = this.target.position.x;
                    this.mouseY = this.target.position.y;
                    break;
                }
            }   
			
            this.mouse = {x: x1, y: y1};
            break;
        case 3: // Target prey
            if ((!this.target) || (this.visibleNodes.indexOf(this.target) == -1)) {
                this.target = this.getRandom(this.prey);
            }
            //console.log("[Bot] "+cell.getName()+": Targeting "+this.target.getName());
							
            this.mouse = {x: this.target.position.x, y: this.target.position.y};
			
            var massReq = 1.25 * (this.target.mass * 2 ); // Mass required to splitkill the target
			
            if ((cell.mass > massReq) && (this.cells.length <= 2)) { // Will not split into more than 4 cells
                var splitDist = (4 * (40 + (cell.getSpeed() * 4))) + (cell.getSize() * 1.75); // Distance needed to splitkill
                var distToTarget = this.getAccDist(cell,this.target); // Distance between the target and this cell
				
                if (splitDist >= distToTarget) {
                    // Splitkill
                    this.gameServer.splitCells(this);
                }
            }
            break;
		default:
            //console.log("[Bot] "+cell.getName()+": Idle "+this.gameState);
            this.gameState = 0;
            break;
    }
}

// Finds the nearest cell in list
BotPlayer.prototype.findNearest = function(cell,list) {
	if (this.currentTarget) {
		// Do not check for food if target already exists
		return null;
	}
	
	// Check for nearest cell in list
	var shortest = list[0];
	var shortestDist = this.getDist(cell,shortest);
	for (i = 1; i < list.length; i++) {
		var check = list[i];
		var dist = this.getDist(cell,check)
		if (shortestDist > dist) {
			shortest = check;
			shortestDist = dist;
		}
	}
	
    return shortest;
}

BotPlayer.prototype.getRandom = function(list) {
	// Gets a random cell from the array
	var n = Math.floor(Math.random() * list.length);
	return list[n];
}

BotPlayer.prototype.getDist = function(cell,check) {
    // Fastest distance - I have a crappy computer to test with :(
    var xd = (check.position.x - cell.position.x);
    xd = xd < 0 ? xd * -1 : xd; // Math.abs is slow
    
    var yd = (check.position.y - cell.position.y);
    yd = yd < 0 ? yd * -1 : yd; // Math.abs is slow
    
    return (xd + yd);	
}

BotPlayer.prototype.getAccDist = function(cell,check) {
    // Accurate Distance
    var xs = check.position.x - cell.position.x;
    xs = xs * xs;
	 
    var ys = check.position.y - cell.position.y;
    ys = ys * ys;
	
    return Math.sqrt( xs + ys );
}

BotPlayer.prototype.getFoodBox = function(x,y) {
	var list = [];
    var r = 200;
		
    var topY = y - r;
    var bottomY = y + r;
    var leftX = x - r;
    var rightX = x + r;
	
	// Loop
    for (var i in this.visibleNodes) {
		var check = this.visibleNodes[i];
		
		if ((!check) || (check.getType() != 1)){
			continue;
		}
		
        // Collision checking
        if (y > bottomY) {
            continue;
        } if (y < topY) {
            continue;
        } if (x > rightX) {
            continue;
        } if (x < leftX) {
            continue;
        } 
          
		list.push(check);
    }
}
