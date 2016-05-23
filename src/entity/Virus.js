var Cell = require('./Cell');

function Virus() {
    Cell.apply(this, Array.prototype.slice.call(arguments));

    this.cellType = 2;
    this.spiked = 1;
    this.fed = 0;
    this.isMotherCell = false; // Not to confuse bots
}

module.exports = Virus;
Virus.prototype = new Cell();

Virus.prototype.calcMove = null; // Only for player controlled movement

Virus.prototype.feed = function(feeder, gameServer) {
    this.setAngle(feeder.getAngle()); // Set direction if the virus explodes
    this.mass += feeder.mass;
    this.fed++; // Increase feed count
    feeder.setKiller(this);
    gameServer.removeNode(feeder);

    // Check if the virus is going to explode
    if (this.fed >= gameServer.config.virusFeedAmount) {
        this.mass = gameServer.config.virusStartMass; // Reset mass
        this.fed = 0;
        gameServer.shootVirus(this);
    }

};

// Main Functions

Virus.prototype.getEatingRange = function() {
    return this.getSize() / 3.14; // 0 for ejected cells
};

Virus.prototype.onConsume = function(consumer, gameServer) {
    var client = consumer.owner;

    // Cell consumes mass before any calculation
    consumer.addMass(this.mass);

    var maxSplits = Math.floor(consumer.mass / 16) - 1; // Maximum amount of splits
    var numSplits = gameServer.config.playerMaxCells - client.cells.length; // Get number of splits
    numSplits = Math.min(numSplits, maxSplits);
    var splitMass = Math.min(consumer.mass / (numSplits + 1), 24); // Maximum size of new splits

    // Cell cannot split any further
    if (numSplits <= 0) {
        return;
    }

    var mass = consumer.mass; // Mass of the consumer
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
            // While can split into an even smaller cell (1000 => 333, 167, etc)
            var mult = 3.33;
            while (m / mult > 24) {
                m /= mult;
                mult = 2; // First mult 3.33, the next ones 2
                bigSplits.push(m >> 0);
                i++;
            }
        }
    }
    numSplits -= bigSplits.length;

    for (var k = 0; k < bigSplits.length; k++) {
        var angle = Math.random() * 6.28; // Random directions
        gameServer.createPlayerCell(client, consumer, angle, bigSplits[k]);
    }

    // Splitting
    for (var k = 0; k < numSplits; k++) {
        var angle = Math.random() * 6.28; // Random directions
        gameServer.createPlayerCell(client, consumer, angle, splitMass);
    }

    // Prevent consumer cell from merging with other cells
    consumer.calcMergeTime(gameServer.config.playerRecombineTime);
    client.applyTeaming(1.2, 1); // Apply anti-teaming
};

Virus.prototype.onAdd = function(gameServer) {
    gameServer.nodesVirus.push(this);
};

Virus.prototype.onRemove = function(gameServer) {
    var index = gameServer.nodesVirus.indexOf(this);
    if (index != -1) {
        gameServer.nodesVirus.splice(index, 1);
    } else {
        console.log("[Warning] Tried to remove a non existing virus!");
    }
};
