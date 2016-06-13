function Cell(nodeId, owner, position, mass, gameServer) {
    this.nodeId = nodeId;
    this.owner = owner; // playerTracker that owns this cell
    if (gameServer != null)
        this.tickOfBirth = gameServer.getTick();
    this.color = {
        r: 0,
        g: 255,
        b: 0
    };
    this.position = position;
    this._size = 0;
    this._mass = 0;
    this._squareSize = 0;
    this.setMass(mass); // Starting mass of the cell
    this.cellType = -1; // 0 = Player Cell, 1 = Food, 2 = Virus, 3 = Ejected Mass
    this.spiked = 0;    // If 1, then this cell has spikes around it

    this.killedBy; // Cell that ate this cell
    this.gameServer = gameServer;

    this.boostDistance = 0;
    this.boostDirection = { x: 1, y: 0, angle: 0 };
    this.ejector = null;
    
    this.collisionRestoreTicks = 0; // Ticks left before cell starts checking for collision with client's cells
}

module.exports = Cell;

// Fields not defined by the constructor are considered private and need a getter/setter to access from a different class

Cell.prototype.getName = function() {
    if (this.owner)
        return this.owner.name;
    return "";
};

Cell.prototype.getSkin = function () {
    if (this.owner)
        return this.owner.skin;
    return "";
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
    return this._size;
};

Cell.prototype.getMass = function () {
    return this._mass;
};

Cell.prototype.getSquareSize = function () {
    return this._squareSize;
};

Cell.prototype.setMass = function (mass) {
    this._size = Math.sqrt(mass * 100);
    this._squareSize = this._size * this._size;
    this._mass = this._squareSize / 100;
    if (this.owner)
        this.owner.massChanged();
};

Cell.prototype.addMass = function(n) {
    // Check if the cell needs to autosplit before adding mass
    if (this.getMass() > this.gameServer.config.playerMaxMass && this.owner.cells.length < this.gameServer.config.playerMaxCells) {
        var splitMass = this.getMass() / 2;
        var randomAngle = Math.random() * 6.28; // Get random angle
        this.gameServer.createPlayerCell(this.owner, this, randomAngle, splitMass);
    }
    var newMass = this.getMass() + n;
    if (newMass > this.gameServer.config.playerMaxMass)
        newMass = this.gameServer.config.playerMaxMass;
    this.setMass(newMass);
};

Cell.prototype.getSpeed = function() {
    var speed = 2.1106 / Math.pow(this.getSize(), 0.449);
    // tickStep=40ms
    return speed * 40 * this.gameServer.config.playerSpeed;
};

Cell.prototype.setAngle = function(angle) {
    this.boostDirection = {
        x: Math.sin(angle),
        y: Math.cos(angle),
        angle: angle
    };
};

Cell.prototype.getAngle = function() {
    return this.boostDirection.angle;
};

// Returns cell age in ticks for specified game tick
Cell.prototype.getAge = function (tick) {
    if (this.tickOfBirth == null) return 0;
    return Math.max(0, tick - this.tickOfBirth);
}

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

Cell.prototype.collisionCheck = function(left, top, right, bottom) {
    return this.position.x > left && 
        this.position.x < right &&
        this.position.y > top && 
        this.position.y < bottom;
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

Cell.prototype.collisionCheckCircle = function(x, y, size) {
    var dx = this.position.x - x;
    var dy = this.position.y - y;
    var r = this.getSize() + size;
    return dx * dx + dy * dy < r * r;
};

Cell.prototype.visibleCheck = function (box) {
    // Checks if this cell is visible to the player
    if (this.cellType == 1) {
        // dot collision detector
        return this.position.x >= box.left && 
            this.position.x <= box.right &&
            this.position.y >= box.top && 
            this.position.y <= box.bottom;
    }
    // rectangle collision detector
    var cellSize = this.getSize();
    var minx = this.position.x - cellSize;
    var miny = this.position.y - cellSize;
    var maxx = this.position.x + cellSize;
    var maxy = this.position.y + cellSize;
    var d1x = box.left - maxx;
    var d1y = box.top - maxy;
    var d2x = minx - box.right;
    var d2y = miny - box.bottom;
    return d1x < 0 && d1y < 0 && d2x < 0 && d2y < 0;
};

Cell.prototype.setBoost = function (distance, angle) {
    if (isNaN(angle)) angle = 0;
    
    this.boostDistance = distance;
    this.setAngle(angle);
};

Cell.prototype.calcMoveBoost = function (config) {
    if (this.boostDistance <= 0) return;
    
    var speed = Math.sqrt(this.boostDistance * this.boostDistance / 100);
    var speed = Math.min(speed, 78);                // limit max speed with sqrt(780*780/100)
    speed = Math.min(speed, this.boostDistance);    // avoid overlap 0
    this.boostDistance -= speed;
    if (this.boostDistance <= 1) this.boostDistance = 0;
    var x = this.position.x + this.boostDirection.x * speed;
    var y = this.position.y + this.boostDirection.y * speed;

    // Border check - Bouncy physics
    var radius = 40;
    if (x < config.borderLeft && this.position.x != x) {
        // Flip angle horizontally - Left side
        this.setAngle(6.28 - this.getAngle());
        if (x == this.position.x && y == this.position.y) {
            // movement vector is missing
            x = config.borderLeft;
        } else {
            var p = this.getLineIntersection(
                this.position.x, this.position.y, x, y,
                config.borderLeft, config.borderBottom,
                config.borderLeft, config.borderTop);
            x = p.x;
            y = p.y;
        }
    }
    if (x > config.borderRight && this.position.x != x) {
        // Flip angle horizontally - Right side
        this.setAngle(6.28 - this.getAngle());
        if (x == this.position.x && y == this.position.y) {
            // movement vector is missing
            x = config.borderRight;
        } else {
            var p = this.getLineIntersection(
                this.position.x, this.position.y, x, y,
                config.borderRight, config.borderBottom,
                config.borderRight, config.borderTop);
            x = p.x;
            y = p.y;
        }
    }
    if (y < config.borderTop && this.position.y != y) {
        // Flip angle vertically - Top side
        this.setAngle((this.getAngle() <= 3.14) ? 3.14 - this.getAngle() : 9.42 - this.getAngle());
        if (x == this.position.x && y == this.position.y) {
            // movement vector is missing
            y = config.borderTop;
        } else {
            var p = this.getLineIntersection(
                this.position.x, this.position.y, x, y,
                config.borderRight, config.borderTop,
                config.borderLeft, config.borderTop);
            x = p.x;
            y = p.y;
        }
    }
    if (y > config.borderBottom && this.position.y != y) {
        // Flip angle vertically - Bottom side
        this.setAngle((this.getAngle() <= 3.14) ? 3.14 - this.getAngle() : 9.42 - this.getAngle());
        if (x == this.position.x && y == this.position.y) {
            // movement vector is missing
            y = config.borderBottom;
        } else {
            var p = this.getLineIntersection(
                this.position.x, this.position.y, x, y,
                config.borderRight, config.borderBottom,
                config.borderLeft, config.borderBottom);
            x = p.x;
            y = p.y;
        }
    }
    this.position.x = x;
    this.position.y = y;
}

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

Cell.prototype.getLineIntersection = function (p0x, p0y, p1x, p1y, p2x, p2y, p3x, p3y) {
    var z1 = p1x - p0x;
    var z2 = p3x - p2x;
    var w1 = p1y - p0y;
    var w2 = p3y - p2y;
    var k2 = (z1 * (p2y - p0y) + w1 * (p0x - p2x)) / (w1 * z2 - z1 * w2);
    return {
        x: p2x + z2 * k2,
        y: p2y + w2 * k2
    };
}

Cell.prototype.abs = function(x) {
    return x < 0 ? -x : x;
};

Cell.prototype.getDist = function(x1, y1, x2, y2) {
    var vx = x2 - x1;
    var vy = y2 - x1;
    return Math.sqrt(vx * vx + vy * vy);
};
