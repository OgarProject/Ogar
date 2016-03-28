var Cell = require('./Cell');
var Virus = require('./Virus');
var Food = require('./Food');

function MotherCell() { // Temporary - Will be in its own file if Zeach decides to add this to vanilla
    Cell.apply(this, Array.prototype.slice.call(arguments));

    this.cellType = 2; // Copies virus cell
    this.color = {
        r: 205,
        g: 85,
        b: 100
    };
    this.spiked = 1;
    this.isMotherCell = true; // Not to confuse bots
}

module.exports = MotherCell;
MotherCell.prototype = new Cell(); // Base

MotherCell.prototype.getEatingRange = function() {
    return this.getSize() / 3.14;
};

MotherCell.prototype.update = function(gameServer) {
    if (Math.random() * 100 > 97) {
        var maxFood = Math.random() * 2; // Max food spawned per tick
        var i = 0; // Food spawn counter
        while (i < maxFood) {
            // Only spawn if food cap hasn't been reached
            if (gameServer.currentFood < gameServer.config.foodMaxAmount * 1.5) {
                this.spawnFood(gameServer);
            }

            // Increment
            i++;
        }
    }
    if (this.mass > 222) {
        // Always spawn food if the mother cell is larger than 222
        var cellSize = gameServer.config.foodMass;
        if (this.mass > 222 + cellSize * 2) { // Spawn it twice if possible
            this.spawnFood(gameServer);
            this.spawnFood(gameServer);
            this.mass -= cellSize;
            this.mass -= cellSize;
        } else if (this.mass > 222 + cellSize) {
            this.spawnFood(gameServer);
            this.mass -= cellSize;
        }
    }
};

MotherCell.prototype.checkEat = function(gameServer) {
    var safeMass = this.mass * .78;

    // Loop for potential prey
    for (var i in gameServer.nodesPlayer) {
        var check = gameServer.nodesPlayer[i];
        this.checkEatCell(check, safeMass, gameServer);
    }

    // Viruses might be literally in the mother cell when it becomes large. Prevent this
    for (var i in gameServer.nodesVirus) {
        var check = gameServer.nodesVirus[i];
        this.checkEatCell(check, safeMass, gameServer);
    }

    // Check moving nodes
    for (var i in gameServer.movingNodes) {
        var check = gameServer.movingNodes[i];
        this.checkEatCell(check, safeMass, gameServer);
    }
};

MotherCell.prototype.checkEatCell = function(check, safeMass, gameServer) {
    if ((check.getType() == 1) || (check.mass > safeMass)) {
        // Too big to be consumed or check is a food cell
        return;
    }

    // Very simple yet very powerful
    var dist = this.getDist(this.position.x, this.position.y, check.position.x, check.position.y);
    var allowDist = this.getSize() - check.getEatingRange();
    if (dist < allowDist) {
        // Eat it
        gameServer.removeNode(check);
        this.mass += check.mass;
    }
};

MotherCell.prototype.abs = function(n) {
    // Because Math.abs is slow
    return (n < 0) ? -n : n;
};

MotherCell.prototype.spawnFood = function(gameServer) {
    // Get starting position
    var angle = Math.random() * 6.28; // (Math.PI * 2) ??? Precision is not our greatest concern here
    var r = this.getSize();
    var pos = {
        x: this.position.x + (r * Math.sin(angle)),
        y: this.position.y + (r * Math.cos(angle))
    };

    // Spawn food
    var f = new Food(gameServer.getNextNodeId(), null, pos, gameServer.config.foodMass, gameServer);
    f.setColor(gameServer.getRandomColor());

    gameServer.addNode(f);
    gameServer.currentFood++;

    // Move engine
    f.angle = angle;
    var dist = (Math.random() * 8) + 8; // Random distance
    f.setMoveEngineData(dist, 20, 0.85);

    gameServer.setAsMovingNode(f);
};

MotherCell.prototype.onConsume = Virus.prototype.onConsume; // Copies the virus prototype function

MotherCell.prototype.onAdd = function(gameServer) {
    gameServer.gameMode.nodesMother.push(this); // Temporary
};

MotherCell.prototype.onRemove = function(gameServer) {
    var index = gameServer.gameMode.nodesMother.indexOf(this);
    if (index != -1) {
        gameServer.gameMode.nodesMother.splice(index, 1);
    }
};

MotherCell.prototype.visibleCheck = function(box, centerPos) {
    // Checks if this cell is visible to the player
    var cellSize = this.getSize();
    var lenX = cellSize + box.width >> 0; // Width of cell + width of the box (Int)
    var lenY = cellSize + box.height >> 0; // Height of cell + height of the box (Int)

    return (this.abs(this.position.x - centerPos.x) < lenX) && (this.abs(this.position.y - centerPos.y) < lenY);
};
