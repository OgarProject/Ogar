var Cell = require('./Cell');

function EjectedMass() {
    Cell.apply(this, Array.prototype.slice.call(arguments));

    this.cellType = 3;
    this.size = Math.ceil(Math.sqrt(100 * this.mass));
    this.squareSize = (100 * this.mass) >> 0; // not being decayed -> calculate one time
    this.addedAntiTeam = false; // Not to affect anti-teaming two times
}

module.exports = EjectedMass;
EjectedMass.prototype = new Cell();

// Override functions that use 'owner' variable
EjectedMass.prototype.getName = function() {
    return "";
};

EjectedMass.prototype.addMass = function(n) {
    return; // Do nothing, this is an ejected cell
};


// Cell-specific functions
EjectedMass.prototype.getSize = function() {
    return this.size;
};

EjectedMass.prototype.getSquareSize = function() {
    return this.squareSize;
};

EjectedMass.prototype.calcMove = null; // Only for player controlled movement

// Main Functions

EjectedMass.prototype.sendUpdate = function() {
    // Whether or not to include this cell in the update packet
    // Always true since ejected cells can collide with themselves
    return true;
};

EjectedMass.prototype.onRemove = function(gameServer) {
    // Check for teaming and apply anti-teaming if required
    if (!this.addedAntiTeam && this.owner.checkForWMult) {
      try {
            if (this.gameServer.gameMode.teamAmount > 0) {
                // Apply teaming EXCEPT when exchanging mass to same team member
                if (this.owner.team != this.killedBy.owner.team || this.owner == this.killedBy.owner) {
                    this.owner.Wmult += 0.02;
                    this.owner.checkForWMult = false;
                };
            } else {
                // Always apply anti-teaming if there are no teams
                this.owner.Wmult += 0.02;
                this.owner.checkForWMult = false;
            };
        } catch(ex) { } // Dont do anything whatever the error is
    }
    // Remove from list of ejected mass
    var index = gameServer.nodesEjected.indexOf(this);
    if (index != -1) {
        gameServer.nodesEjected.splice(index, 1);
    }
};

EjectedMass.prototype.onConsume = function(consumer, gameServer) {
    // Adds mass to consumer
    consumer.addMass(this.mass);
};

EjectedMass.prototype.onAutoMove = function(gameServer) {
    if (gameServer.nodesVirus.length < gameServer.config.virusMaxAmount) {
        // Check for viruses
        var v = gameServer.getNearestVirus(this);
        if (v) { // Feeds the virus if it exists
            v.feed(this, gameServer);
            return true;
        }
    }
};

EjectedMass.prototype.moveDone = function(gameServer) {
    // Always apply anti-teaming
    this.owner.actionMult += 0.02;
    this.addedAntiTeam = true;
    this.owner.checkForWMult = false;
};
