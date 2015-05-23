function Cell(nodeId,owner, position, mass, type) {
    this.nodeId = nodeId;
    this.owner = owner; // playerTracker that owns this cell
    this.color = {r: 0, g: 255, b: 0};
    this.position = position;
    this.size = 0; // Radius of the cell - Depreciated, use getSize() instead
    this.mass = mass; // Starting mass of the cell
    this.speed = 30; // Filler, will be changed later
    this.cellType = type; // 0 = Player Cell, 1 = Food, 2 = Virus, 3 = Ejected Mass
    this.recombineTicks = 1; // Ticks until the cell can recombine with other cells 
    
    this.moveEngineTicks = 0; // Amount of times to loop the movement function
    this.moveEngineSpeed = 0;
    this.angle = 0; // Angle of movement
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

Cell.prototype.setAngle = function(radians) {
    this.angle = radians;
}

Cell.prototype.setMoveEngineData = function(speed, ticks) {
    this.moveEngineSpeed = speed;
    this.moveEngineTicks = ticks;
}

Cell.prototype.getMoveTicks = function() {
    return this.moveEngineTicks;
}

// Functions

Cell.prototype.calcMove = function(x2, y2, border) {
    var x1 = this.position.x;
    var y1 = this.position.y;
    
    var dx = Math.abs(x2 - x1);
    var dy = Math.abs(y2 - y1);
    
    var sx = (x1 < x2) ? 1 : -1;
    var sy = (y1 < y2) ? 1 : -1;
    var err = dx - dy;
    var dist = this.speed;
    
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
    
    // Check to ensure we're not passing the world border
    if (x1 < border.left || x1 > border.right || y1 < border.top || y1 > border.bottom) {
        return;
    }
	
    // Collision check for other cells (Work in progress)
    for (var i = 0; i < this.owner.cells.length;i++) {
        var cell = this.owner.cells[i];
		
        if (this.nodeId == cell.nodeId) {
            continue;
        }
		
		if (cell.recombineTicks > 0) {
            // Cannot recombine
            var xs = Math.pow(cell.position.x - this.position.x, 2);
            var ys = Math.pow(cell.position.y - this.position.y, 2);
            var dist = Math.sqrt( xs + ys );
            var collisionDist = cell.getSize() + this.getSize(); // Minimum distance between the 2 cells
			
            // Calculations
            if (dist < collisionDist) {
                // Collided
				
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
    this.moveEngineSpeed *= .8; // Decaying speed
    this.moveEngineTicks -= 1;
	 
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
