var Cell = require('./Cell');

function Virus() {
    Cell.apply(this, Array.prototype.slice.call(arguments));
    
    this.color = {
        r: 51,
        g: 255,
        b: 51
    };
    this.cellType = 2;
    this.spiked = 1;
    this.fed = 0;
    this.isMotherCell = false; // Not to confuse bots
}

module.exports = Virus;
Virus.prototype = new Cell();

// Main functions

Virus.prototype.onConsume = function(consumer) {
    var client = consumer.owner;

    // Cell consumes mass before any calculation
    consumer.addMass(this.mass);

    var maxSplits = Math.floor(consumer.mass / 16) - 1; // Maximum amount of splits
    var numSplits = this.gameServer.config.playerMaxCells - client.cells.length; // Get number of splits
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
        var angle = Math.random() * 6.28; // Random directions
        this.gameServer.nodeHandler.createPlayerCell(client, consumer, angle, bigSplits[k]);
    }

    // Splitting
    for (var k = 0; k < numSplits; k++) {
        var angle = Math.random() * 6.28; // Random directions
        this.gameServer.nodeHandler.createPlayerCell(client, consumer, angle, splitMass);
    }

    client.applyTeaming(1.2, 1); // Apply anti-teaming
};

Virus.prototype.eat = function() {
    // Virus will eat ejected cells no matter the size of it
    for (var i = 0; i < this.gameServer.nodesEjected.length; i++) {
        var node = this.gameServer.nodesEjected[i];
        if (!node) continue;
        
        var dist = this.position.sqDistanceTo(node.position);
        var maxDist = this.getSquareSize();
        
        if (dist < maxDist) {
            // Eat it
            node.inRange = true;
            node.setKiller(this);
            this.gameServer.removeNode(node);
            
            // On feed checks
            this.fed++;
            this.mass += node.mass;
            // Set shooting angle if necessary
            if (this.moveEngine.x + this.moveEngine.y < 5) this.shootAngle = node.moveEngine.angle();
            if (this.fed >= this.gameServer.config.virusFeedAmount) {
                // Shoot!
                this.mass = this.gameServer.config.virusStartMass;
                this.fed = 0;
                
                this.gameServer.nodeHandler.shootVirus(this);
            }
        }
    }
};

Virus.prototype.onAdd = function() {
    this.gameServer.nodesVirus.push(this);
};

Virus.prototype.onRemove = function() {
    var index = this.gameServer.nodesVirus.indexOf(this);
    if (index != -1) this.gameServer.nodesVirus.splice(index, 1);
};
