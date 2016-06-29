var Vector = require('../modules/Vector');

function Cell(nodeId, owner, position, mass, gameServer) {
    this.nodeId = nodeId;
    this.owner = owner; // playerTracker that owns this cell
    this.ticksLeft = 0; // Individual updates
    
    this.color = {
        r: 0,
        g: 0,
        b: 0
    };
    this.position;
    if (position) this.position = new Vector(position.x, position.y);
    this.mass = mass; // Starting mass of the cell
    this.cellType = -1; // 0 = Player Cell, 1 = Food, 2 = Virus, 3 = Ejected Mass
    this.spiked = 0; // If 1, then this cell has spikes around it

    this.killedBy; // Cell that ate this cell
    this.gameServer = gameServer;

    this.moveEngine = new Vector();
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

Cell.prototype.getSize = function() {
    // Calculates radius based on cell mass
    return Math.ceil(Math.sqrt(100 * this.mass));
};

Cell.prototype.getSquareSize = function() {
    // R * R
    return (100 * this.mass) >> 0;
};

Cell.prototype.addMass = function(n) {
    this.mass += n;
};

Cell.prototype.getKiller = function() {
    return this.killedBy;
};

Cell.prototype.setKiller = function(cell) {
    this.killedBy = cell;
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
        if(this.gameMode.disableEating == false) { if (this.cellType == 0) return 1; // <= added
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


Cell.prototype.moveEngineTick = function(config) {
    if (!this.gameServer) return;
    var toMove = this.moveEngine.clone().scale(0.5);
    this.position.sub(toMove);
    
    // Decreasing twice as slower
    this.moveEngine.scale(0.935);
    
    // Check for border passage
    this.borderCheck(true);
    
    this.move();
};

Cell.prototype.borderCheck = function(flipMoving) {
    if (flipMoving == undefined || flipMoving == null) flipMoving = false;
    
    // Border check - If flipMoving is true then bounce off
    var border = this.gameServer.borders();
    var checkRadius = this.getSize() / 2;
    
    if (this.position.x - checkRadius < border.left) {
        if (flipMoving) {
            this.moveEngine.flipY();
        }
        this.position.x = border.left + checkRadius;
    }
    
    if (this.position.x + checkRadius > border.right) {
        if (flipMoving) {
            this.moveEngine.flipY();
        }
        this.position.x = border.right - checkRadius;
    }
    
    if (this.position.y - checkRadius < border.top) {
        if (flipMoving) {
            this.moveEngine.flipX();
        }
        this.position.y = border.top + checkRadius;
    }
    
    if (this.position.y + checkRadius > border.bottom) {
        if (flipMoving) {
            this.moveEngine.flipX();
        }
        this.position.y = border.bottom - checkRadius;
    }
};

// Override these
Cell.prototype.sendUpdate = function() {
    // Whether or not to include this cell in the update packet
    return true;
};

Cell.prototype.onConsume = function(consumer, gameServer) {
    // Called when the cell is consumed
    consumer.addMass(this.mass);
};

Cell.prototype.onAdd = function(gameServer) {
    // Called when this cell is added to the world
};

Cell.prototype.onRemove = function() {
    // Called when this cell is removed
};

Cell.prototype.eat = function() {
    // Calld on tick for eating
};

Cell.prototype.move = function(gameServer) {
    // Called on each auto move engine tick
};
