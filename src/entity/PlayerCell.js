var Vector = require('../modules/Vector');
var Cell = require('./Cell');

function PlayerCell() {
    Cell.apply(this, Array.prototype.slice.call(arguments));

    this.cellType = 0;
    this.recombineTicks = 0; // Ticks passed after the cell has split
    this.shouldRecombine = false; // Should the cell combine. If true, collision with own cells happens
    this.collisionRestoreTicks = 0; // Ticks left before cell starts checking for collision with client's cells
}

module.exports = PlayerCell;
PlayerCell.prototype = new Cell();

// Main Functions

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

PlayerCell.prototype.getSpeed = function() {
    // Based on 50ms ticks. If updateMoveEngine interval changes, change 50 to new value
    // (should possibly have a config value for this?)

    // Old formulas:
    // return 5 + (20 * (1 - (this.mass/(70+this.mass))));
    // return this.gameServer.config.playerSpeed * Math.pow(this.mass, -0.22) * 50 / 40;
    return this.gameServer.config.playerSpeed * Math.pow(this.mass, -0.2101) / 1.25;
};

PlayerCell.prototype.getSplittingSpeed = function() {
    // Based on 50ms ticks. If updateMoveEngine interval changes, change 50 to new value
    // (should possibly have a config value for this?)

    // Old formulas:
    // return 5 + (20 * (1 - (this.mass/(70+this.mass))));
    // return this.gameServer.config.playerSpeed * Math.pow(this.mass, -0.22) * 50 / 40;
    return this.gameServer.config.playerSpeed * Math.pow(this.mass, -0.2101);
};

PlayerCell.prototype.move = function() {
    // Get angle to mouse
    var cartesian = this.position.clone().sub(this.owner.mouse);
    var angle = cartesian.angle();
    
    var speed = Math.min(this.getSpeed(), cartesian.distance()); // Twice as slower

    // Move cell
    this.position.sub(
        Math.sin(angle) * speed,
        Math.cos(angle) * speed
    );
};
// Collision is now handled by NodeHandler

// Override

PlayerCell.prototype.eat = function() {
    for (var i = 0; i < this.owner.visibleNodes.length; i++) {
        var node = this.owner.visibleNodes[i];
        if (!node) continue;
        
        if (this.gameServer.collisionHandler.canEat(this, node)) {
            // Eat node
            node.inRange = true;
            node.onConsume(this, this.gameServer);
            node.setKiller(this);
            this.gameServer.removeNode(node);
        }
    }
};

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

PlayerCell.prototype.addMass = function(n) {
    // Check if the cell needs to autosplit before adding mass
    if (this.mass > this.gameServer.config.playerMaxMass &&
        this.owner.cells.length < this.gameServer.config.playerMaxCells) {
        
        // Autosplit
        var randomAngle = Math.random() * 6.28; // Get random angle
        this.gameServer.nodeHandler.createPlayerCell(this.owner, this, randomAngle, this.mass / 2);
    } else {
        this.mass = Math.min(this.mass, this.gameServer.config.playerMaxMass);
    }
    this.mass += n;
};
