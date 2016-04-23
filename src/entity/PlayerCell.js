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

PlayerCell.prototype.simpleCollide = function(check, d) {
    // Simple collision check
    var len = 2 * d >> 0; // Width of cell + width of the box (Int)

    return (this.abs(this.position.x - check.x) < len) &&
        (this.abs(this.position.y - check.y) < len);
};

PlayerCell.prototype.calcMergeTime = function(base) {
    // Check for merging time
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

PlayerCell.prototype.calcMove = function(x2, y2, gameServer) {
    if (!this.owner.shouldMoveCells && this.owner.notMoved) return; // Mouse is in one place

    // Get angle of mouse
    var deltaY = y2 - this.position.y;
    var deltaX = x2 - this.position.x;
    var angle = Math.atan2(deltaX, deltaY);

    if (isNaN(angle)) {
        return;
    }

    var dist = this.getDist(this.position.x, this.position.y, x2, y2);
    var speed = Math.min(this.getSpeed(), dist) / 2; // Twice as slower

    // Move cell
    this.position.x += Math.sin(angle) * speed;
    this.position.y += Math.cos(angle) * speed;
    this.owner.notMoved = false;
};

PlayerCell.prototype.collision = function(gameServer) {
    var config = gameServer.config;
    var r = this.getSize(); // Cell radius

    // Collision check for other cells
    for (var i = 0; i < this.owner.cells.length; i++) {
        var cell = this.owner.cells[i];

        if (!cell) continue; // Error
        if (this.nodeId == cell.nodeId) continue;

        if ((!cell.shouldRecombine) || (!this.shouldRecombine)) {
            // Cannot recombine - Collision with your own cells
            var calcInfo = gameServer.checkCellCollision(this, cell); // Calculation info

            // Further calculations
            if (calcInfo.collided) { // Collided
                // Cell with collision restore ticks on should not collide
                if (this.collisionRestoreTicks > 0 || cell.collisionRestoreTicks > 0) continue;

                // Call gameserver's function to collide cells
                gameServer.cellCollision(this, cell, calcInfo);
            }
        }
    }

    gameServer.gameMode.onCellMove(this, gameServer);

    // Check to ensure we're not passing the world border (shouldn't get closer than a quarter of the cell's diameter)
    if (this.position.x < -config.borderLeft + r / 2) {
        this.position.x = -config.borderLeft + r / 2;
    }
    if (this.position.x > config.borderRight - r / 2) {
        this.position.x = config.borderRight - r / 2;
    }
    if (this.position.y < -config.borderTop + r / 2) {
        this.position.y = -config.borderTop + r / 2;
    }
    if (this.position.y > config.borderBottom - r / 2) {
        this.position.y = config.borderBottom - r / 2;
    }
};

// Override

PlayerCell.prototype.getEatingRange = function() {
    return this.getSize() / 3.14;
};

PlayerCell.prototype.onConsume = function(consumer, gameServer) {
    // Add an inefficiency for eating other players' cells
    var factor = ( consumer.owner === this.owner ? 1 : gameServer.config.playerMassAbsorbed );
    // Anti-bot measure
    factor = (consumer.mass >= 625 && this.mass <= 17 && gameServer.config.playerBotGrowEnabled == 1) ? 0 : factor;
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
