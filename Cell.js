function Cell(nodeId, name, position, mass, type) {
    this.nodeId = nodeId;
    this.name = name;
    this.color = {r: 0, g: 255, b: 0};
    this.position = position;
    this.size = 0; // Radius of the cell - Depreciated, use getSize() instead
    this.mass = mass; // Mass of the cell
    this.speed = 20; // Filler, will be changed later
    this.cellType = type; // 0 = Player Cell, 1 = Food, 2 = Virus, 3 = Ejected Mass
    
    this.energy = 0; // Amount of times to loop the movement function
    this.direction = 0; // Angle of movement
}

module.exports = Cell;

Cell.prototype.getType = function() {
    return this.cellType;
}

Cell.prototype.getPos = function() {
    return this.position;
}

Cell.prototype.getSize = function() {
    return Math.sqrt(100 * this.mass);
}

Cell.prototype.getMass = function() {
    return this.mass;
}

Cell.prototype.setAngle = function(radians) {
    this.direction = radians;
}

Cell.prototype.setSpeed = function(n) {
    this.speed = n;
}

Cell.prototype.getEnergy = function() {
    return this.energy;
}

Cell.prototype.setEnergy = function(n) {
    this.energy = n;
}

Cell.prototype.decrementEnergy = function() {
    this.energy--;
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

    this.position.x = x1;
    this.position.y = y1;
}

Cell.prototype.calcMovePhys = function() {
	//Movement for ejected cells
	var X = this.position.x + ( this.speed * Math.sin(this.direction) );
	var Y = this.position.y + ( this.speed * Math.cos(this.direction) );
	
    this.position.x = X;
    this.position.y = Y;
}
