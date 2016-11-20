var Cell = require('./Cell');

function EjectedMass() {
    Cell.apply(this, Array.prototype.slice.call(arguments));

    this.cellType = 3;
    this.size = Math.ceil(Math.sqrt(100 * this.mass));
    this.squareSize = (100 * this.mass) >> 0; // not being decayed -> calculate one time
    this.addedAntiTeam = false; // Not to affect anti-teaming two times
    this.isMoving = true;
}

module.exports = EjectedMass;
EjectedMass.prototype = new Cell();

// Override getName which uses 'owner' variable
EjectedMass.prototype.getName = function() {
    return "";
};

// Cell-specific functions
EjectedMass.prototype.getSize = function() {
    return this.size;
};

EjectedMass.prototype.getSquareSize = function() {
    return this.squareSize;
};

// Main Functions

EjectedMass.prototype.sendUpdate = function() {
    // Whether or not to include this cell in the update packet
    // Always true since ejected cells can collide with themselves
    return true;
};

EjectedMass.prototype.onRemove = function(gameServer) {
    // Remove from list of ejected mass
    var index = this.gameServer.nodesEjected.indexOf(this);
    if (index != -1) {
        this.gameServer.nodesEjected.splice(index, 1);
    }
};

EjectedMass.prototype.onConsume = function(consumer, gameServer) {
    // Adds mass to consumer
    consumer.addMass(this.mass);

    // Check for teaming and apply anti-teaming if required
    if (!this.addedAntiTeam && this.owner.checkForWMult) {
        // Smaller W's get more attention
        var influence = this.mass * (Math.log(this.mass) / Math.sqrt(this.mass)) * 2;
        consumer.owner.applyTeaming(influence, 1);
        this.owner.applyTeaming(influence, -1);
    }
};

EjectedMass.prototype.move = function() {
    // Collide with other ejected cells
    var nearby = this.gameServer.quadTree.query(this.getRange(), function(node) {
        return node.cellType == 3 || node.cellType == 2;
    });

    for (var i = 0; i < nearby.length; i++) {
        var node = nearby[i];
        if (!node) continue;

        if (node.cellType == 2) node.eat(this);
        else this.gameServer.collisionHandler.pushEjectedApart(this, node);
    }
};
