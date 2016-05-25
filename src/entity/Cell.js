function Cell(nodeId, owner, position, mass, gameServer) {
    this.nodeId = nodeId;
    this.owner = owner; // playerTracker that owns this cell
    this.color = {
        r: 0,
        g: 255,
        b: 0
    };
    this.position = position;
    this.mass = mass; // Starting mass of the cell
    this.cellType = -1; // 0 = Player Cell, 1 = Food, 2 = Virus, 3 = Ejected Mass
    this.spiked = 0; // If 1, then this cell has spikes around it

    this.killedBy; // Cell that ate this cell
    this.gameServer = gameServer;

    this.moveEngineSpeed = 0;
    this.moveDecay = 0.85;
    this.angle = 0; // Angle of movement
    this.collisionRestoreTicks = 0; // Ticks left before cell starts checking for collision with client's cells
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
    this.color.g = color.g;
    this.color.b = color.b;
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

Cell.prototype.getSquareSize = function() {
    // R * R
    return (100 * this.mass) >> 0;
};

Cell.prototype.addMass = function(n) {
    // Check if the cell needs to autosplit before adding mass
    if (this.mass > this.gameServer.config.playerMaxMass && this.owner.cells.length < this.gameServer.config.playerMaxCells) {
        var splitMass = this.mass / 2;
        var randomAngle = Math.random() * 6.28; // Get random angle
        this.gameServer.createPlayerCell(this.owner, this, randomAngle, splitMass);
    } else {
        this.mass = Math.min(this.mass, this.gameServer.config.playerMaxMass);
    }
    this.mass += n;
};

Cell.prototype.getSpeed = function() {
    // Based on 50ms ticks. If updateMoveEngine interval changes, change 50 to new value
    // (should possibly have a config value for this?)

    // Old formulas:
    // return 5 + (20 * (1 - (this.mass/(70+this.mass))));
    // return this.gameServer.config.playerSpeed * Math.pow(this.mass, -0.22) * 50 / 40;
    var t = Math.PI * Math.PI;
    return this.gameServer.config.playerSpeed * Math.pow(this.mass, -Math.PI / t / 1.5);
};

Cell.prototype.setAngle = function(radians) {
    this.angle = radians;
};

Cell.prototype.getAngle = function() {
    return this.angle;
};

Cell.prototype.setMoveEngineData = function(speed, decay) {
    this.moveEngineSpeed = speed;
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

Cell.prototype.collisionCheck = function(bottomY, topY, rightX, leftX) {
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
Cell.prototype.collisionCheck2 = function(objectSquareSize, objectPosition) {
    // IF (O1O2 + r <= R) THEN collided. (O1O2: distance b/w 2 centers of cells)
    // (O1O2 + r)^2 <= R^2
    // approximately, remove 2*O1O2*r because it requires sqrt(): O1O2^2 + r^2 <= R^2

    var dx = this.position.x - objectPosition.x;
    var dy = this.position.y - objectPosition.y;

    return (dx * dx + dy * dy + this.getSquareSize() <= objectSquareSize);
};

Cell.prototype.visibleCheck = function(box, centerPos, cells) {
    // Checks if this cell is visible to the player
    var isThere = false;
    if (this.mass < 100) isThere = this.collisionCheck(box.bottomY, box.topY, box.rightX, box.leftX);
    else {
        var cellSize = this.getSize();
        var lenX = cellSize + box.width >> 0; // Width of cell + width of the box (Int)
        var lenY = cellSize + box.height >> 0; // Height of cell + height of the box (Int)
    
        isThere = (this.abs(this.position.x - centerPos.x) < lenX) && (this.abs(this.position.y - centerPos.y) < lenY);
    }
    if (isThere) {
        // It is
        // To save perfomance, check if any client's cell collides with this cell
        for (var i = 0; i < cells.length; i++) {
            var cell = cells[i];
            if (!cell) continue;
            
            var xs = this.position.x - cell.position.x;
            var ys = this.position.y - cell.position.y;
            var sqDist = xs * xs + ys * ys;
            
            var collideDist = cell.getSquareSize() + this.getSquareSize();
            
            if (sqDist < collideDist) {
                return 2;
            }// Colliding with one
        }
        return 1; // Not colliding with any
    }
    else return 0;
};

Cell.prototype.calcMovePhys = function(config) {
    // Move, twice as slower
    var X = this.position.x + ((this.moveEngineSpeed / 2) * Math.sin(this.angle));
    var Y = this.position.y + ((this.moveEngineSpeed / 2) * Math.cos(this.angle));

    // Movement engine
    var speedDecrease = this.moveEngineSpeed - this.moveEngineSpeed * this.moveDecay;
    this.moveEngineSpeed -= speedDecrease / 2; // Decaying speed twice as slower

    // Ejected cell collision
    if (this.cellType == 3) {
        for (var i = 0; i < this.gameServer.nodesEjected.length; i++) {
            var check = this.gameServer.nodesEjected[i];

            if (check.nodeId == this.nodeId) continue; // Don't check for yourself

            var dist = this.getDist(this.position.x, this.position.y, check.position.x, check.position.y);
            var allowDist = this.getSize() + check.getSize(); // Allow cells to get in themselves a bit

            if (dist < allowDist) {
                // Two ejected cells collided
                var deltaX = this.position.x - check.position.x;
                var deltaY = this.position.y - check.position.y;
                var angle = Math.atan2(deltaX, deltaY);

                var move = allowDist - dist;

                X += Math.sin(angle) * move / 2;
                Y += Math.cos(angle) * move / 2;
            }
        }
    }

    // Border check - Bouncy physics
    var radius = 40;
    if ((this.position.x - radius) < -config.borderLeft) {
        // Flip angle horizontally - Left side
        this.angle = 6.28 - this.angle;
        X = -config.borderLeft + radius;
    }
    if ((this.position.x + radius) > config.borderRight) {
        // Flip angle horizontally - Right side
        this.angle = 6.28 - this.angle;
        X = config.borderRight - radius;
    }
    if ((this.position.y - radius) < -config.borderTop) {
        // Flip angle vertically - Top side
        this.angle = (this.angle <= 3.14) ? 3.14 - this.angle : 9.42 - this.angle;
        Y = -config.borderTop + radius;
    }
    if ((this.position.y + radius) > config.borderBottom) {
        // Flip angle vertically - Bottom side
        this.angle = (this.angle <= 3.14) ? 3.14 - this.angle : 9.42 - this.angle;
        Y = config.borderBottom - radius;
    }

    // Set position
    this.position.x = X;
    this.position.y = Y;
};

// Override these

Cell.prototype.sendUpdate = function() {
    // Whether or not to include this cell in the update packet
    return true;
};

Cell.prototype.onConsume = function(consumer, gameServer) {
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

// Lib

Cell.prototype.abs = function(x) {
    return x < 0 ? -x : x;
};

Cell.prototype.getDist = function(x1, y1, x2, y2) {
    var xs = x2 - x1;
    xs = xs * xs;

    var ys = y2 - y1;
    ys = ys * ys;

    return Math.sqrt(xs + ys);
};
