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

EjectedMass.prototype.onRemove = function(gameServer) { 
    // Remove from list of ejected mass
    var index = gameServer.nodesEjected.indexOf(this);
    if (index != -1) {
        gameServer.nodesEjected.splice(index,1);
    }
}

EjectedMass.prototype.onConsume = function(consumer,gameServer) {
    // Adds mass to consumer
    consumer.addMass(gameServer.config.ejectMassGain);
}

EjectedMass.prototype.moveDone = function(gameServer) {
	// Add to list of ejected mass
    gameServer.nodesEjected.push(this);
}
