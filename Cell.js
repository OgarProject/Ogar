function Cell(nodeId, owner, position, mass, type) {
    this.nodeId = nodeId;
    this.owner = owner; // playerTracker that owns this cell
    this.color = {r: 0, g: 255, b: 0};
    this.position = position;
    this.size = 0; // Radius of the cell - Depreciated, use getSize() instead
    this.mass = mass; // Starting mass of the cell
    this.speed = 30; // Filler, will be changed later
    this.cellType = type; // 0 = Player Cell, 1 = Food, 2 = Virus, 3 = Ejected Mass
    this.recombineTicks = 0; // Ticks until the cell can recombine with other cells 
    this.ignoreCollision = false;
    
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

Cell.prototype.getPos = function() {
    return this.position;
}

Cell.prototype.getSize = function() {
	// Calculates radius based on cell mass
    return Math.sqrt(100 * this.mass) + .1;
}

Cell.prototype.getSpeed = function() {
	// Custom speed formula
	var speed = 5 + (35 * (1 - (this.mass/(200+this.mass))));
	return speed;
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

Cell.prototype.calcMove = function(x2, y2, border) {
	
	/* Old movement system R.I.P
	if ((this.position.x == x2) && (this.position.y == y2)) {
		return;
	}
	
    var x1 = this.position.x;
    var y1 = this.position.y;
    
    var dx = Math.abs(x2 - x1);
    var dy = Math.abs(y2 - y1);
    
    var sx = (x1 < x2) ? 1 : -1;
    var sy = (y1 < y2) ? 1 : -1;
    var err = dx - dy;
    var dist = this.getSpeed();
    
    while (!((x1 == x2) && (y1 == y2)) && (dist > 0)) {
        var e2 = err << 1;
        if (e2 > -dy){
            err -= dy;
            x1 += sx;
        }
        if (e2 < dx) {
            err += dx;
            y1 += sy;
        }
        dist--;
    }
    */
	
    // Get angle
    var deltaY = y2 - this.position.y;
    var deltaX = x2 - this.position.x;
    var angle = Math.atan2(deltaX,deltaY);
    
    // Distance between mouse pointer and cell
    var dist = Math.sqrt( Math.pow(x2 - this.position.x, 2) +  Math.pow(y2 - this.position.y, 2) );
    var speed = Math.min(this.getSpeed(),dist);
    
	var x1 = this.position.x + ( speed * Math.sin(angle) );
    var y1 = this.position.y + ( speed * Math.cos(angle) );
    
    // Check to ensure we're not passing the world border
    if (this.position.x < border.left) {
        x1 = border.left + 1;
    }
	if (this.position.x > border.right) {
        x1 = border.right - 1;
    }
    if (this.position.y < border.top) {
        y1 = border.top + 1;
    }
    if (this.position.y > border.bottom) {
        y1 = border.bottom - 1;
    }
	
    // Collision check for other cells (Work in progress)
    for (var i = 0; i < this.owner.cells.length;i++) {
        var cell = this.owner.cells[i];
		
        if ((this.nodeId == cell.nodeId) || (this.ignoreCollision)) {
            continue;
        }
		
        if ((cell.recombineTicks > 0) || (this.recombineTicks > 0)) {
            // Cannot recombine
            var dist = Math.sqrt( Math.pow(cell.position.x - this.position.x, 2) +  Math.pow(cell.position.y - this.position.y, 2) );
            var collisionDist = cell.getSize() + this.getSize(); // Minimum distance between the 2 cells
			
            // Calculations
            if (dist < collisionDist) { // Collided
                // The moving cell pushes the colliding cell
                var newDeltaY = cell.getPos().y - y1;
                var newDeltaX = cell.getPos().x - x1;
                var newAngle = Math.atan2(newDeltaX,newDeltaY);
                
                var move = collisionDist - dist + 5;
                
                cell.position.x = cell.getPos().x + ( move * Math.sin(newAngle) );
                cell.position.y = cell.getPos().y + ( move * Math.cos(newAngle) );
            }
        }
    }

    this.position.x = x1;
    this.position.y = y1;
}

Cell.prototype.calcMovePhys = function(border) {
    // Movement for ejected cells
    var X = this.position.x + ( this.moveEngineSpeed * Math.sin(this.angle) );
    var Y = this.position.y + ( this.moveEngineSpeed * Math.cos(this.angle) );
	
    // Movement engine
    this.moveEngineSpeed *= .75; // Decaying speed
    this.moveEngineTicks--;
	 
    // Border check - Bouncy physics
    var radius = 40;
    if ((this.position.x - radius) < border.left) {
        // Flip angle horizontally - Left side
        this.angle = Math.abs(1 - this.angle);
        X = border.left + radius;
    }
    if ((this.position.x + radius) > border.right) {
        // Flip angle horizontally - Right side
        this.angle = 1 - this.angle;
        X = border.right - radius;
    }
    if ((this.position.y - radius) < border.top) {
        // Flip angle vertically - Top side
        this.angle = this.angle - 1;
        Y = border.top + radius;
    }
    if ((this.position.y + radius) > border.bottom) {
        // Flip angle vertically - Bottom side
        this.angle = this.angle - 1;
        Y = border.bottom - radius;
    }
    
    // Set position
    this.position.x = X;
    this.position.y = Y;  
}
