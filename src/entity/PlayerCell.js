var Cell = require('./Cell');

function PlayerCell() {
    Cell.apply(this, Array.prototype.slice.call(arguments));
    
    this.cellType = 0;
    this._canRemerge = false;
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

PlayerCell.prototype.updateRemerge = function (gameServer) {
    if (this.owner == null) {
        this._canRemerge = false;
        return;
    }
    var tick = gameServer.getTick();
    var age = this.getAge(tick);
    if (age < 3) {
        // do not remerge if cell age is smaller than 3 ticks
        this._canRemerge = false;
        return;
    }
    var baseTtr = gameServer.config.playerRecombineTime;        // default baseTtr = 30
    if (baseTtr == 0) {
        // instant merge
        this._canRemerge = true;
        return;
    }
    var ttr = Math.max(baseTtr, (this.getSize() * 0.2) >> 0);   // ttr in seconds
    // seconds to ticks (tickStep = 0.040 sec)
    ttr /= 0.040;
    this._canRemerge = age >= ttr;
}

PlayerCell.prototype.canRemerge = function () {
    return this._canRemerge;
};

PlayerCell.prototype.canEat = function (cell) {
    // player cell can eat anyone
    return true;
};

// Movement

PlayerCell.prototype.moveUser = function (border) {
    if (this.owner == null) {
        return;
    }
    var x = this.owner.mouse.x;
    var y = this.owner.mouse.y;
    if (isNaN(x) || isNaN(y)) {
        return;
    }
    var dx = x - this.position.x;
    var dy = y - this.position.y;
    var squared = dx * dx + dy * dy;
    if (squared < 1) return;
    
    // distance
    var d = Math.sqrt(squared);
    
    // normal
    var invd = 1 / d;
    var nx = dx * invd;
    var ny = dy * invd;
    
    // normalized distance (0..1)
    d = Math.min(d, 32) / 32;
    var speed = this.getSpeed() * d;
    if (speed <= 0) return;
    
    this.position.x += nx * speed;
    this.position.y += ny * speed;
    this.checkBorder(border);
};

// Override

PlayerCell.prototype.onEat = function (prey) {
    var size1 = this.getSize();
    var size2 = prey.getSize() + 1;
    this.setSize(Math.sqrt(size1 * size1 + size2 * size2));

    if (this.owner.mergeOverride)
        return;
    if (this.getMass() <= this.gameServer.config.playerMaxMass)
        return;
    if (this.owner.cells.length >= this.gameServer.config.playerMaxCells) {
        this.setMass(this.gameServer.config.playerMaxMass);
        return;
    }
    var splitMass = this.getMass() / 2;
    var randomAngle = Math.random() * 6.28; // Get random angle
    this.gameServer.splitPlayerCell(this.owner, this, randomAngle, splitMass);
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
