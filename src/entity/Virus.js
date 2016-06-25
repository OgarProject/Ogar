var Cell = require('./Cell');
var Logger = require('../modules/Logger');

function Virus() {
    Cell.apply(this, Array.prototype.slice.call(arguments));

    this.cellType = 2;
    this.isSpiked = true;
    this.fed = 0;
    this.isMotherCell = false; // Not to confuse bots
    this.setColor({ r: 0, g: 255, b: 0 });
}

module.exports = Virus;
Virus.prototype = new Cell();

// Main Functions

Virus.prototype.canEat = function (cell) {
    return cell.cellType == 3; // virus can eat ejected mass only
};

Virus.prototype.onEat = function (prey) {
    // Called to eat prey cell
    var size1 = this.getSize();
    var size2 = prey.getSize() + 1;
    this.setSize(Math.sqrt(size1 * size1 + size2 * size2));
    if (this.getSize() >= this.gameServer.config.virusMaxSize) {
        this.setSize(this.gameServer.config.virusMinSize); // Reset mass
        this.gameServer.shootVirus(this, prey.getAngle());
    }
};

Virus.prototype.onEaten = function(consumer) {
    var client = consumer.owner;
    if (client == null) return;

    var maxSplits = Math.floor(consumer.getMass() / 16) - 1; // Maximum amount of splits
    var numSplits = this.gameServer.config.playerMaxCells - client.cells.length; // Get number of splits
    numSplits = Math.min(numSplits, maxSplits);
    var splitMass = Math.min(consumer.getMass() / (numSplits + 1), 24); // Maximum size of new splits

    // Cell cannot split any further
    if (numSplits <= 0) {
        return;
    }

    var mass = consumer.getMass(); // Mass of the consumer
    var bigSplits = []; // Big splits

    // Big cells will split into cells larger than 24 mass
    // won't do the regular way unless it can split more than 4 times
    if (numSplits == 1) bigSplits = [mass / 2];
    else if (numSplits == 2) bigSplits = [mass / 4, mass / 4];
    else if (numSplits == 3) bigSplits = [mass / 4, mass / 4, mass / 7];
    else if (numSplits == 4) bigSplits = [mass / 5, mass / 7, mass / 8, mass / 10];
    else {
        var endMass = mass - numSplits * splitMass;
        var m = endMass,
            i = 0;
        if (m > 466) { // Threshold
            // While can split into an even smaller cell (10000 => 2500, 1000, etc)
            var mult = 4;
            while (m / mult > 24) {
                m /= mult;
                mult = 2.5; // First mult 4, the next ones 2.5
                bigSplits.push(m >> 0);
                i++;
            }
        }
    }
    numSplits -= bigSplits.length;

    for (var k = 0; k < bigSplits.length; k++) {
        angle = Math.random() * 2 * Math.PI; // Random directions
        this.gameServer.splitPlayerCell(client, consumer, angle, bigSplits[k]);
    }

    // Splitting
    for (var k = 0; k < numSplits; k++) {
        angle = Math.random() * 2 * Math.PI; // Random directions
        this.gameServer.splitPlayerCell(client, consumer, angle, splitMass);
    }
};

Virus.prototype.onAdd = function(gameServer) {
    gameServer.nodesVirus.push(this);
};

Virus.prototype.onRemove = function(gameServer) {
    var index = gameServer.nodesVirus.indexOf(this);
    if (index != -1) {
        gameServer.nodesVirus.splice(index, 1);
    } else {
        Logger.error("Virus.onRemove: Tried to remove a non existing virus!");
    }
};
