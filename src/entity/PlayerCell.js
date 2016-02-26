var Cell = require('./Cell');

function PlayerCell() {
    Cell.apply(this, Array.prototype.slice.call(arguments));

    this.cellType = 0;
    this.recombineTicks = 0; // Ticks passed after the cell has split
    this.shouldRecombine = false; // Should the cell combine. If true, collision with own cells happens
}

module.exports = PlayerCell;
PlayerCell.prototype = new Cell();

// Main Functions

PlayerCell.prototype.visibleCheck = function(box, centerPos) {
    // Use old fashioned checking method if cell is small
    if (this.mass < 100) {
        return this.collisionCheck(box.bottomY, box.topY, box.rightX, box.leftX);
    }

    // Checks if this cell is visible to the player
    var cellSize = this.getSize();
    var lenX = cellSize + box.width >> 0; // Width of cell + width of the box (Int)
    var lenY = cellSize + box.height >> 0; // Height of cell + height of the box (Int)

    return (this.abs(this.position.x - centerPos.x) < lenX) && (this.abs(this.position.y - centerPos.y) < lenY);
};

PlayerCell.prototype.simpleCollide = function(check, d) {
    // Simple collision check
    var len = 2 * d >> 0; // Width of cell + width of the box (Int)

    return (this.abs(this.position.x - check.x) < len) &&
        (this.abs(this.position.y - check.y) < len);
};

PlayerCell.prototype.calcMergeTime = function(base) {
    // The recombine mechanic has been completely revamped.
    // As time passes on, recombineTicks gets larger, instead of getting smaller.
    // When the owner has only 1 cell, ticks and shouldRecombine will be reset by gameserver.
    var r = false;
    if (base == 0 || this.owner.mergeOverride) {
        // Instant recombine in config or merge command was triggered for this client
        r = true;
    } else {
        var rec = Math.floor(base + ((0.02 * this.mass))); // base seconds + 0.02% of mass
        if (this.recombineTicks > rec) r = true; // Can combine with other cells
    }
    this.shouldRecombine = r;
};

// Movement

PlayerCell.prototype.calcMove = function(x2, y2, gameServer, moveCell) {
    if (moveCell) {
        // Get angle of mouse
        var deltaY = y2 - this.position.y;
        var deltaX = x2 - this.position.x;
        var angle = Math.atan2(deltaX, deltaY);

        if (isNaN(angle)) {
            return;
        }

        var dist = this.getDist(this.position.x, this.position.y, x2, y2);
        var speed = Math.min(this.getSpeed(), dist);

        // Move cell
        this.position.x += Math.sin(angle) * speed;
        this.position.y += Math.cos(angle) * speed;
    }

    this.collision(gameServer);
};

PlayerCell.prototype.collision = function(gameServer) {
    var config = gameServer.config;
    var r = this.getSize(); // Cell radius

    var x1 = this.position.x;
    var y1 = this.position.y;

    var collidedCells = 0; // Amount of cells collided this tick

    // Collision check for other cells
    for (var i = 0; i < this.owner.cells.length; i++) {
        var cell = this.owner.cells[i];

        if (this.nodeId == cell.nodeId) {
            continue;
        }

        if ((!cell.shouldRecombine) || (!this.shouldRecombine)) {
            // Cannot recombine - Collision with your own cells
            var collisionDist = cell.getSize() + r; // Minimum distance between the 2 cells
            dist = this.getDist(x1, y1, cell.position.x, cell.position.y); // Distance between these two cells

            // Calculations
            if (dist < collisionDist) { // Collided
                // The moving cell pushes the colliding cell
                // Strength however depends on cell1 speed divided by cell2 speed
                collidedCells++;
                if (this.collisionRestoreTicks > 0 || cell.collisionRestoreTicks > 0) continue;

                var c1Speed = this.getSpeed();
                var c2Speed = cell.getSpeed();
                var Tmult = (c1Speed / c2Speed) / 2;

                var dY = y1 - cell.position.y;
                var dX = x1 - cell.position.x;
                var newAngle = Math.atan2(dX, dY);

                var Tmove = (collisionDist - dist) * Tmult;

                x1 += (Tmove * Math.sin(newAngle)) >> 0;
                y1 += (Tmove * Math.cos(newAngle)) >> 0;

                // Also move the other cell
                dist = this.getDist(x1, y1, cell.position.x, cell.position.y); // Recalculate distance
                var Cmult = (c2Speed / c1Speed) / 2;
                var Cmove = (collisionDist - dist) * Cmult;

                cell.position.x -= (Cmove * Math.sin(newAngle)) >> 0;
                cell.position.y -= (Cmove * Math.cos(newAngle)) >> 0;
            }
        }
    }

    gameServer.gameMode.onCellMove(x1, y1, this);

    if (collidedCells == 0) this.collisionRestoreTicks = 0; // Automate process of collision restoration as no cells are colliding

    // Check to ensure we're not passing the world border (shouldn't get closer than a quarter of the cell's diameter)
    if (x1 < config.borderLeft + r / 2) {
        x1 = config.borderLeft + r / 2;
    }
    if (x1 > config.borderRight - r / 2) {
        x1 = config.borderRight - r / 2;
    }
    if (y1 < config.borderTop + r / 2) {
        y1 = config.borderTop + r / 2;
    }
    if (y1 > config.borderBottom - r / 2) {
        y1 = config.borderBottom - r / 2;
    }

    this.position.x = x1 >> 0;
    this.position.y = y1 >> 0;
}

// Override

PlayerCell.prototype.getEatingRange = function() {
    return this.getSize() / 3.14;
};

PlayerCell.prototype.onConsume = function(consumer, gameServer) {
    // Add an inefficiency for eating other players' cells
    var factor = ( consumer.owner === this.owner ? 1 : gameServer.config.playerMassAbsorbed );
    factor = (consumer.mass >= 625 && this.mass <= 17) ? 0 : factor; // Anti-bot measure
    consumer.addMass(factor * this.mass);
};

PlayerCell.prototype.onAdd = function(gameServer) {
    // Add to special player node list
    gameServer.nodesPlayer.push(this);
    // Gamemode actions
    gameServer.gameMode.onCellAdd(this);
};

PlayerCell.prototype.onRemove = function(gameServer) {
    var index;
    // Remove from player cell list
    index = this.owner.cells.indexOf(this);
    if (index != -1) {
        this.owner.cells.splice(index, 1);
    }
    // Remove from special player controlled node list
    index = gameServer.nodesPlayer.indexOf(this);
    if (index != -1) {
        gameServer.nodesPlayer.splice(index, 1);
    }
    // Gamemode actions
    gameServer.gameMode.onCellRemove(this);
};

PlayerCell.prototype.moveDone = function(gameServer) {
    // Well, nothing.
};

// Lib

PlayerCell.prototype.abs = function(x) {
    return x < 0 ? -x : x;
};

PlayerCell.prototype.getDist = function(x1, y1, x2, y2) {
    var xs = x2 - x1;
    xs = xs * xs;

    var ys = y2 - y1;
    ys = ys * ys;

    return Math.sqrt(xs + ys);
};
