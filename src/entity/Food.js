var Cell = require('./Cell');

function Food() {
    Cell.apply(this, Array.prototype.slice.call(arguments));

    this.cellType = 1;
    this.shouldSendUpdate = false;

    if (this.gameServer.config.foodMassGrow &&
        this.gameServer.config.foodMassGrowPossiblity > Math.floor(Math.random() * 101)) {
        this.grow();
    }
}

module.exports = Food;
Food.prototype = new Cell();

Food.prototype.calcMove = null; // Food has no need to move

// Main Functions

Food.prototype.grow = function() {
    setTimeout(function() {
        this.setMass(this.getMass() + 1); // food mass increased, we need to recalculate its size and squareSize, and send update to client side
        this.shouldSendUpdate = true;

        if (this.getMass() < this.gameServer.config.foodMassLimit) {
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
    consumer.addMass(this.getMass());
};
