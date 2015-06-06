function Cell(nodeId, owner, position, mass, gameServer) {
    this.nodeId = nodeId;
    this.owner = owner; // playerTracker that owns this cell
    this.color = {r: 0, g: 255, b: 0};
    this.position = position;
    this.mass = mass; // Starting mass of the cell
    this.cellType = -1; // 0 = Player Cell, 1 = Food, 2 = Virus, 3 = Ejected Mass
    
    this.killedBy; // Cell that ate this cell
    this.recombineTicks = 0; // Ticks until the cell can recombine with other cells 
    this.ignoreCollision = false;
    this.gameServer = gameServer;
    
    this.moveEngineTicks = 0; // Amount of times to loop the movement function
    this.moveEngineSpeed = 0;
    this.angle = 0; // Angle of movement
    
    if (this.owner) {
        this.setColor(this.owner.color);
        this.owner.cells.push(this); // Add to cells list of the owner 
    } 
}

module.exports = Cell;

// Fields not defined by the constructor are considered private and need a getter/setter to access from a different class

Cell.prototype.getName = function() {
	if (this.owner) {
		return this.owner.name;
	} else {
		return "";
	}
}

Cell.prototype.setColor = function(color) {
    this.color.r = color.r;
    this.color.b = color.b;
    this.color.g = color.g;
}

Cell.prototype.getColor = function() {
    return this.color;
}

Cell.prototype.getType = function() {
    return this.cellType;
}

Cell.prototype.getSize = function() {
	// Calculates radius based on cell mass
    return Math.sqrt(100 * this.mass + .25) >> 0;
}

Cell.prototype.addMass = function(n) {
    this.mass = Math.min(this.mass + n,this.owner.gameServer.config.playerMaxMass);
}

Cell.prototype.getSpeed = function() {
	// Old formula: 5 + (20 * (1 - (this.mass/(70+this.mass))));
	// Based on 50ms ticks. If updateMoveEngine interval changes, change 50 to new value
	// (should possibly have a config value for this?)
	return 745.28 * Math.pow(this.mass, -0.222) * 50 / 1000;
}

Cell.prototype.setAngle = function(radians) {
    this.angle = radians;
}

Cell.prototype.getAngle = function() {
	return this.angle;
}

Cell.prototype.setMoveEngineData = function(speed, ticks) {
    this.moveEngineSpeed = speed;
    this.moveEngineTicks = ticks;
}

Cell.prototype.getMoveTicks = function() {
    return this.moveEngineTicks;
}

Cell.prototype.getRecombineTicks = function() {
    return this.recombineTicks;
}

Cell.prototype.setRecombineTicks = function(n) {
    this.recombineTicks = n;
}

Cell.prototype.setCollisionOff = function(bool) {
    this.ignoreCollision = bool;
}

Cell.prototype.getCollision = function() {
    return this.ignoreCollision;
}

Cell.prototype.getEatingRange = function() {
    if (this.nodeType == 3) { // Ejected cells have a smaller eating range
        return 0;
    } else { // Other cells
        return this.getSize() * .35;
    }
}

Cell.prototype.getKiller = function() {
    return this.killedBy;
}

Cell.prototype.setKiller = function(cell) {
    this.killedBy = cell;
}

// Functions

Cell.prototype.collisionCheck = function(bottomY,topY,rightX,leftX) {
	// Collision checking
	if (this.position.y > bottomY) {
        return false;
    } if (this.position.y < topY) {
        return false;
    } if (this.position.x > rightX) {
        return false;
    } if (this.position.x < leftX) {
        return false;
    } 
    return true;
}

Cell.prototype.visibleCheck = function(box,centerPos) {
    // Checks if this cell is visible to the player
    return this.collisionCheck(box.bottomY,box.topY,box.rightX,box.leftX);
}

Cell.prototype.calcMove = function(x2, y2, gameServer) {
	var config = gameServer.config;
	
    // Get angle
    var deltaY = y2 - this.position.y;
    var deltaX = x2 - this.position.x;
    var angle = Math.atan2(deltaX,deltaY);
    
    // Distance between mouse pointer and cell
    var dist = Math.sqrt( Math.pow(x2 - this.position.x, 2) +  Math.pow(y2 - this.position.y, 2) );
    var speed = Math.min(this.getSpeed(),dist);
    
    var x1 = this.position.x + ( speed * Math.sin(angle) );
    var y1 = this.position.y + ( speed * Math.cos(angle) );
	
    // Collision check for other cells
    for (var i = 0; i < this.owner.cells.length;i++) {
        var cell = this.owner.cells[i];
		
        if ((this.nodeId == cell.nodeId) || (this.ignoreCollision)) {
            continue;
        }
		
        if ((cell.recombineTicks > 0) || (this.recombineTicks > 0)) {
            // Cannot recombine - Collision with your own cells
            var dist = Math.sqrt( Math.pow(cell.position.x - this.position.x, 2) +  Math.pow(cell.position.y - this.position.y, 2) );
            var collisionDist = cell.getSize() + this.getSize(); // Minimum distance between the 2 cells
        	
            // Calculations
            if (dist < collisionDist) { // Collided
                // The moving cell pushes the colliding cell
                var newDeltaY = cell.position.y - y1;
                var newDeltaX = cell.position.x - x1;
                var newAngle = Math.atan2(newDeltaX,newDeltaY);
                
                var move = collisionDist - dist + 5;
                
                cell.position.x = cell.position.x + ( move * Math.sin(newAngle) ) >> 0;
                cell.position.y = cell.position.y + ( move * Math.cos(newAngle) ) >> 0;
            }
        }
    }
    
    // Team collision
    if (gameServer.gameMode.haveTeams) {
        var team = this.owner.getTeam();
 
        // Find team
        for (var i = 0; i < this.owner.visibleNodes.length;i++) {
            // Only collide with player cells
            var check = this.owner.visibleNodes[i];

            if ((check.getType() != 0) || (this.owner == check.owner)){
                continue;
            }
    		
            if (check.owner.getTeam() == team) {
                // Collision with teammates
                var dist = Math.sqrt( Math.pow(check.position.x - this.position.x, 2) +  Math.pow(check.position.y - this.position.y, 2) );
                var collisionDist = check.getSize() + this.getSize(); // Minimum distance between the 2 cells
    			
                // Calculations
                if (dist < collisionDist) { // Collided
                    // The moving cell pushes the colliding cell
                    var newDeltaY = check.position.y - y1;
                    var newDeltaX = check.position.x - x1;
                    var newAngle = Math.atan2(newDeltaX,newDeltaY);
                    
                    var move = collisionDist - dist;
                    
                    check.position.x = check.position.x + ( move * Math.sin(newAngle) ) >> 0;
                    check.position.y = check.position.y + ( move * Math.cos(newAngle) ) >> 0;
                }
            }
        }
    }
    
    // Check to ensure we're not passing the world border
    if (x1 < config.borderLeft) {
        x1 = config.borderLeft;
    }
	if (x1 > config.borderRight) {
        x1 = config.borderRight;
    }
    if (y1 < config.borderTop) {
        y1 = config.borderTop;
    }
    if (y1 > config.borderBottom) {
        y1 = config.borderBottom;
    }

    this.position.x = x1 >> 0;
    this.position.y = y1 >> 0;
}

Cell.prototype.calcMovePhys = function(config) {
    // Movement for ejected cells
    var X = this.position.x + ( this.moveEngineSpeed * Math.sin(this.angle) );
    var Y = this.position.y + ( this.moveEngineSpeed * Math.cos(this.angle) );
	
    // Movement engine
    this.moveEngineSpeed *= .75; // Decaying speed
    this.moveEngineTicks--;
	 
    // Border check - Bouncy physics
    var radius = 40;
    if ((this.position.x - radius) < config.borderLeft) {
        // Flip angle horizontally - Left side
        this.angle = Math.abs(3.14 - this.angle);
        X = config.borderLeft + radius;
    }
    if ((this.position.x + radius) > config.borderRight) {
        // Flip angle horizontally - Right side
        this.angle = 1 - this.angle;
        X = config.borderRight - radius;
    }
    if ((this.position.y - radius) < config.borderTop) {
        // Flip angle vertically - Top side
        this.angle = Math.abs(this.angle - 3.14);
        Y = config.borderTop + radius;
    }
    if ((this.position.y + radius) > config.borderBottom) {
        // Flip angle vertically - Bottom side
        this.angle = Math.abs(this.angle - 3.14);
        Y = config.borderBottom - radius;
    }
    
    // Set position
    this.position.x = X >> 0;
    this.position.y = Y >> 0;  
}

// Override these

Cell.prototype.onConsume = function(consumer,gameServer) {
    // Called when the cell is consumed
}

Cell.prototype.onAdd = function(gameServer) {
    // Called when this cell is added to the world
}

Cell.prototype.onRemove = function(gameServer) {
    // Called when this cell is removed
}

Cell.prototype.moveDone = function(gameServer) {
    // Called when this cell finished moving with the auto move engine
}
