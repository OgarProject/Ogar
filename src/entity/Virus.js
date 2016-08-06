var Cell = require('./Cell');
var Logger = require('../modules/Logger');

function Virus() {
    Cell.apply(this, Array.prototype.slice.call(arguments));
    
    this.cellType = 2;
    this.isSpiked = true;
    this.fed = 0;
    this.isMotherCell = false; // Not to confuse bots
    this.setColor({ r: 0x33, g: 0xff, b: 0x33 });
}

module.exports = Virus;
Virus.prototype = new Cell();

// Main Functions

Virus.prototype.canEat = function (cell) {
    return cell.cellType == 3; // virus can eat ejected mass only
};

Virus.prototype.onEat = function (prey) {
    // Called to eat prey cell
    this.setSize(Math.sqrt(this.getSizeSquared() + prey.getSizeSquared()));
    
    if (this.getSize() >= this.gameServer.config.virusMaxSize) {
        this.setSize(this.gameServer.config.virusMinSize); // Reset mass
        this.gameServer.shootVirus(this, prey.getAngle());
    }
};

Virus.prototype.onEaten = function (consumer) {
    var client = consumer.owner;
    if (client == null) return;
    
    var maxSplit = this.gameServer.config.playerMaxCells - consumer.owner.cells.length;
    var masses = this.gameServer.splitMass(consumer.getMass(), maxSplit + 1);
    if (masses.length < 2) {
        return;
    }
    
    // Balance mass around center & skip first mass (==consumer mass)
    var massesMix = [];
    for (var i = 1; i < masses.length; i += 2)
        massesMix.push(masses[i]);
    for (var i = 2; i < masses.length; i += 2)
        massesMix.push(masses[i]);
    masses = massesMix;
    
    // Blow up the cell...
    var angle = 2 * Math.PI * Math.random();
    var step = 2 * Math.PI / masses.length;
    for (var i = 0; i < masses.length; i++) {
        if (!this.gameServer.splitPlayerCell(client, consumer, angle, masses[i])) {
            break;
        }
        angle += step;
        if (angle >= 2 * Math.PI) {
            angle -= 2 * Math.PI;
        }
    }
};

Virus.prototype.onAdd = function (gameServer) {
    gameServer.nodesVirus.push(this);
};

Virus.prototype.onRemove = function (gameServer) {
    var index = gameServer.nodesVirus.indexOf(this);
    if (index != -1) {
        gameServer.nodesVirus.splice(index, 1);
    } else {
        Logger.error("Virus.onRemove: Tried to remove a non existing virus!");
    }
};
