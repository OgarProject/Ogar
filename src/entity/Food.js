var Cell = require('./Cell');

function Food() {
    Cell.apply(this, Array.prototype.slice.call(arguments));
	
    this.cellType = 1;
    this.size = Math.ceil(Math.sqrt(100 * this.mass)); 
}

module.exports = Food;
Food.prototype = new Cell();

Food.prototype.getSize = function() {
    return this.size; 
}

Food.prototype.calcMove = null; // Food has no need to move

Food.prototype.calcMovePhys = null; // Food has no need to move

// Main Functions

Food.prototype.onConsume = function(consumer,gameServer) {
    gameServer.currentFood--;
    consumer.addMass(this.mass);
}
