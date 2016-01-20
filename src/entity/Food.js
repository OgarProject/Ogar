var Cell = require('./Cell');

function Food() {
    Cell.apply(this, Array.prototype.slice.call(arguments));

    this.cellType = 1;
    this.size = Math.ceil(Math.sqrt(100 * this.mass));
    this.squareSize = (100 * this.mass) >> 0; // not being decayed -> calculate one time
    this.shouldSendUpdate = false;

    if (this.gameServer.config.foodMassGrow &&
        this.gameServer.config.foodMassGrowPossiblity > Math.floor(Math.random() * 101)) {
        this.grow();
    }
}

module.exports = Food;
Food.prototype = new Cell();

Food.prototype.getSize = function() {
    return this.size;
};

Food.prototype.getSquareSize = function() {
    return this.squareSize;
};

Food.prototype.calcMove = null; // Food has no need to move

// Main Functions

Food.prototype.grow = function() {
    setTimeout(function() {
        this.mass++; // food mass increased, we need to recalculate its size and squareSize, and send update to client side
        this.size = Math.ceil(Math.sqrt(100 * this.mass));
        this.squareSize = (100 * this.mass) >> 0;
        this.shouldSendUpdate = true;

        if (this.mass < this.gameServer.config.foodMassLimit) {
            this.grow();
        }
    }.bind(this), this.gameServer.config.foodMassTimeout * 1000);
};

Food.prototype.sendUpdate = function() {
    // Whether or not to include this cell in the update packet
    if (this.moveEngineTicks == 0) {
        return false;
    }
    if (this.shouldSendUpdate) {
        this.shouldSendUpdate = false;
        return true;
    }
    return true;
};

Food.prototype.onRemove = function(gameServer) {
    gameServer.currentFood--;
};

Food.prototype.onConsume = function(consumer, gameServer) {
    consumer.addMass(this.mass);
};
