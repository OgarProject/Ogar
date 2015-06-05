var Cell = require('./Cell');

function Food() {
    Cell.apply(this, Array.prototype.slice.call(arguments));
	
    this.cellType = 1;
}

module.exports = Food;
Food.prototype = new Cell();

Food.prototype.calcMove = function () {
    // Food has no need to move
}

Food.prototype.calcMovePhys = function () {
    // Food has no need to move
}

// Main Functions

Food.prototype.onConsume = function(consumer,gameServer) {
    gameServer.currentFood--;
    consumer.addMass(gameServer.config.foodMass);
}