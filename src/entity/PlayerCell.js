var Cell = require('./Cell');

function PlayerCell() {
    Cell.apply(this, Array.prototype.slice.call(arguments));

    this.cellType = 0;
    this.recombineTicks = 0; // Ticks until the cell can recombine with other cells 
}

module.exports = PlayerCell;
PlayerCell.prototype = new Cell();

// Main Functions

PlayerCell.prototype.visibleCheck = function(box,centerPos) {
    // Use old fashioned checking method if cell is small
    if (this.mass < 150) {
        return this.collisionCheck(box.bottomY,box.topY,box.rightX,box.leftX);
    }

    // Checks if this cell is visible to the player
    var len = this.getSize() + box.width >> 0; // Width of cell + width of the box (Int)

    return ((this.position.x - centerPos.x) < len) &&
           ((this.position.y - centerPos.y) < len);
};

PlayerCell.prototype.calcMergeTime = function(base) {
    this.recombineTicks = base + ((0.02 * this.mass) >> 0); // Int (30 sec + (.02 * mass))
};

// Override

PlayerCell.prototype.getEatingRange = function() {
    return this.getSize() * .5;
};

PlayerCell.prototype.onConsume = function(consumer,gameServer) {
    consumer.addMass(this.mass);
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
    this.setCollisionOff(false);
};

