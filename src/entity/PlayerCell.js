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
    var base = this.gameServer.config.playerSpeed;
    var speed = 100 / Math.pow(this.getSize(), 0.32) / 50;
    
    return base * speed;
};

PlayerCell.prototype.getSplittingSpeed = function() {
    var base = this.gameServer.config.playerSpeed;
    var speed = 3.5 / Math.pow(this.getSize(), 0.0122);

    return base * speed;
};

PlayerCell.prototype.move = function() {
    // Get angle to mouse
    var cartesian = this.position.clone().sub(this.owner.mouse);
    var angle = cartesian.angle();

    var speed = Math.min(this.getSpeed(), cartesian.distance()) / 2; // Twice as slower
    
    if (isNaN(angle) || speed == 0) return;

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

PlayerCell.prototype.onConsume = function(consumer, gameServer) {
    // Add an inefficiency for eating other players' cells
    var factor = ( consumer.owner === this.owner ? 1 : gameServer.config.playerMassAbsorbed );
    // Anti-bot measure
    factor = (consumer.mass >= 625 && this.mass <= 17 && gameServer.config.playerBotGrowEnabled <= 0) ? 0 : factor;
    
    // Apply anti-teaming
    if (consumer.owner.pID != this.owner.pID) {
        consumer.owner.applyTeaming(this.mass, 1);
        this.owner.applyTeaming(this.mass, -1);
    }
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
    index = this.gameServer.nodesPlayer.indexOf(this);
    if (index != -1) {
        this.gameServer.nodesPlayer.splice(index, 1);
    }
    // Gamemode actions
    this.gameServer.gameMode.onCellRemove(this);
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
