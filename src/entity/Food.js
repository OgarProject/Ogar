var Cell = require('./Cell');

function Food() {
    Cell.apply(this, Array.prototype.slice.call(arguments));

    this.cellType = 1;

    if (this.gameServer.config.foodMassGrow) {
        var mass = this.getMass();
        var maxGrow = this.gameServer.config.foodMaxMass - mass;
        mass += maxGrow * Math.random();
        this.setMass(mass);
    }
}

module.exports = Food;
Food.prototype = new Cell();

// Main Functions

Food.prototype.onRemove = function(gameServer) {
    gameServer.currentFood--;
};
