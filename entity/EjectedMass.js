var Cell = require('./Cell');

function EjectedMass() {
    Cell.apply(this, Array.prototype.slice.call(arguments));
	
    this.cellType = 3;
}

module.exports = EjectedMass;
EjectedMass.prototype = new Cell();

EjectedMass.prototype.calcMove = function () {
    // Only for player controlled movement
}

// Main Functions

EjectedMass.prototype.onConsume = function(consumer,gameServer) {
    consumer.addMass(gameServer.config.ejectMassGain);
}