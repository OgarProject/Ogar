function Cell(nodeId, owner, position, mass, gameServer) {
    this.nodeId = nodeId;
    this.owner = owner; // playerTracker that owns this cell
    this.color = {r: 0, g: 255, b: 0};
    this.position = position;
    this.mass = mass; // Starting mass of the cell
    this.cellType = -1; // 0 = Player Cell, 1 = Food, 2 = Virus, 3 = Ejected Mass
    this.spiked = 0; // If 1, then this cell has spikes around it

    this.killedBy; // Cell that ate this cell
    this.gameServer = gameServer;

    this.moveEngineTicks = 0; // Amount of times to loop the movement function
    this.moveEngineSpeed = 0;
    this.moveDecay = .75;
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
};

Cell.prototype.setColor = function(color) {
    this.color.r = color.r;
    this.color.b = color.b;
    this.color.g = color.g;
};

Cell.prototype.getColor = function() {
    return this.color;
};

Cell.prototype.getType = function() {
    return this.cellType;
};

Cell.prototype.getSize = function() {
    // Calculates radius based on cell mass
    return Math.ceil(Math.sqrt(100 * this.mass));
};

Cell.prototype.getSquareSize = function () {
    // R * R
    return (100 * this.mass) >> 0;
};

Cell.prototype.addMass = function(n) {
    if(this.mass + n > this.owner.gameServer.config.playerMaxMass && this.owner.cells.length < this.owner.gameServer.config.playerMaxCells) {
        this.mass = (this.mass + n) / 2;
        this.owner.gameServer.newCellVirused(this.owner, this, 0, this.mass, 150);
    } else {
        this.mass = Math.min(this.mass + n,this.owner.gameServer.config.playerMaxMass);
    }
};

Cell.prototype.getSpeed = function() {
    // Old formula: 5 + (20 * (1 - (this.mass/(70+this.mass))));
    // Based on 50ms ticks. If updateMoveEngine interval changes, change 50 to new value
    // (should possibly have a config value for this?)
    return this.owner.gameServer.config.playerSpeed * Math.pow(this.mass, -1.0 / 4.5) * 50 / 40;
};

Cell.prototype.setAngle = function(radians) {
    this.angle = radians;
};

Cell.prototype.getAngle = function() {
    return this.angle;
};

Cell.prototype.setMoveEngineData = function(speed, ticks, decay) {
    this.moveEngineSpeed = speed;
    this.moveEngineTicks = ticks;
    this.moveDecay = isNaN(decay) ? 0.75 : decay;
};

Cell.prototype.getEatingRange = function() {
    return 0; // 0 for ejected cells
};

Cell.prototype.getKiller = function() {
    return this.killedBy;
};

Cell.prototype.setKiller = function(cell) {
    this.killedBy = cell;
};

// Functions

Cell.prototype.collisionCheck = function(bottomY,topY,rightX,leftX) {
    // Collision checking
    if (this.position.y > bottomY) {
        return false;
    }

    if (this.position.y < topY) {
        return false;
    }

    if (this.position.x > rightX) {
        return false;
    }

    if (this.position.x < leftX) {
        return false;
    }

    return true;
};

// This collision checking function is based on CIRCLE shape
Cell.prototype.collisionCheck2 = function (objectSquareSize, objectPosition) {
    // IF (O1O2 + r <= R) THEN collided. (O1O2: distance b/w 2 centers of cells)
    // (O1O2 + r)^2 <= R^2
    // approximately, remove 2*O1O2*r because it requires sqrt(): O1O2^2 + r^2 <= R^2

    var dx = this.position.x - objectPosition.x;
    var dy = this.position.y - objectPosition.y;

    return (dx * dx + dy * dy + this.getSquareSize() <= objectSquareSize);
};

Cell.prototype.visibleCheck = function(box,centerPos) {
    // Checks if this cell is visible to the player
    return this.collisionCheck(box.bottomY,box.topY,box.rightX,box.leftX);
};

Cell.prototype.calcMovePhys = function(config) {
    // Movement for ejected cells
    var X = this.position.x + ( this.moveEngineSpeed * Math.sin(this.angle) );
    var Y = this.position.y + ( this.moveEngineSpeed * Math.cos(this.angle) );

    // Movement engine
    this.moveEngineSpeed *= this.moveDecay; // Decaying speed
    this.moveEngineTicks--;

    // Border check - Bouncy physics
    var radius = 40;
    if ((this.position.x - radius) < config.borderLeft) {
        // Flip angle horizontally - Left side
        this.angle = 6.28 - this.angle;
        X = config.borderLeft + radius;
    }
    if ((this.position.x + radius) > config.borderRight) {
        // Flip angle horizontally - Right side
        this.angle = 6.28 - this.angle;
        X = config.borderRight - radius;
    }
    if ((this.position.y - radius) < config.borderTop) {
        // Flip angle vertically - Top side
        this.angle = (this.angle <= 3.14) ? 3.14 - this.angle : 9.42 - this.angle;
        Y = config.borderTop + radius;
    }
    if ((this.position.y + radius) > config.borderBottom) {
        // Flip angle vertically - Bottom side
        this.angle = (this.angle <= 3.14) ? 3.14 - this.angle : 9.42 - this.angle;
        Y = config.borderBottom - radius;
    }

    // Set position
    this.position.x = X >> 0;
    this.position.y = Y >> 0;
};

// Override these

Cell.prototype.sendUpdate = function() {
    // Whether or not to include this cell in the update packet
    return true;
}

Cell.prototype.onConsume = function(consumer,gameServer) {
    // Called when the cell is consumed
};

Cell.prototype.onAdd = function(gameServer) {
    // Called when this cell is added to the world
};

Cell.prototype.onRemove = function(gameServer) {
    // Called when this cell is removed
};

Cell.prototype.onAutoMove = function(gameServer) {
    // Called on each auto move engine tick
};

Cell.prototype.moveDone = function(gameServer) {
    // Called when this cell finished moving with the auto move engine
};

