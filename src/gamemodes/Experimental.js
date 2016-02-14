var FFA = require('./FFA'); // Base gamemode
var Cell = require('../entity/Cell');
var Food = require('../entity/Food');
var Virus = require('../entity/Virus');
var VirusFeed = require('../entity/Virus').prototype.feed;

function Experimental() {
    FFA.apply(this, Array.prototype.slice.call(arguments));

    this.ID = 2;
    this.name = "Experimental";
    this.specByLeaderboard = true;

    // Gamemode Specific Variables
    this.nodesMother = [];
    this.tickMother = 0;
    this.tickMotherS = 0;

    // Config
    this.motherCellMass = 222;
    this.motherUpdateInterval = 5; // How many ticks it takes to update the mother cell (1 tick = 50 ms)
    this.motherSpawnInterval = 100; // How many ticks it takes to spawn another mother cell - Currently 5 seconds
    this.motherMinAmount = 5;
}

module.exports = Experimental;
Experimental.prototype = new FFA();

// Gamemode Specific Functions

Experimental.prototype.updateMotherCells = function(gameServer) {
    for (var i in this.nodesMother) {
        var mother = this.nodesMother[i];

        // Checks
        mother.update(gameServer);
        mother.checkEat(gameServer);
    }
};

Experimental.prototype.spawnMotherCell = function(gameServer) {
    // Checks if there are enough mother cells on the map
    if (this.nodesMother.length < this.motherMinAmount) {
        // Spawns a mother cell
        var pos = gameServer.getRandomPosition();

        // Check for players
        for (var i = 0; i < gameServer.nodesPlayer.length; i++) {
            var check = gameServer.nodesPlayer[i];

            var r = check.getSize(); // Radius of checking player cell

            // Collision box
            var topY = check.position.y - r;
            var bottomY = check.position.y + r;
            var leftX = check.position.x - r;
            var rightX = check.position.x + r;

            // Check for collisions
            if (pos.y > bottomY) {
                continue;
            }

            if (pos.y < topY) {
                continue;
            }

            if (pos.x > rightX) {
                continue;
            }

            if (pos.x < leftX) {
                continue;
            }

            // Collided
            return;
        }

        // Spawn if no cells are colliding
        var m = new MotherCell(gameServer.getNextNodeId(), null, pos, this.motherCellMass);
        gameServer.addNode(m);
    }
};

// Override

Experimental.prototype.onServerInit = function(gameServer) {
    // Called when the server starts
    gameServer.run = true;

    var mapSize = gameServer.config.borderLeft + gameServer.config.borderRight +
      gameServer.config.borderTop + gameServer.config.borderRight;

    this.motherMinAmount = Math.ceil(mapSize / 3194.382825); // 7 mother cells for agar.io map size

    // Special virus mechanics
    Virus.prototype.feed = function(feeder, gameServer) {
        gameServer.removeNode(feeder);
        // Pushes the virus
        this.setAngle(feeder.getAngle()); // Set direction if the virus explodes
        this.moveEngineTicks += 20; // Amount of times to loop the movement function
        this.moveEngineSpeed += 16;
        this.moveDecay = 0.875;

        var index = gameServer.movingNodes.indexOf(this);
        if (index == -1) {
            gameServer.movingNodes.push(this);
        }
    };

    // Override this
    gameServer.getRandomSpawn = gameServer.getRandomPosition;
};

Experimental.prototype.onTick = function(gameServer) {
    // Mother Cell updates
    this.updateMotherCells(gameServer);

    // Mother Cell Spawning
    if (this.tickMotherS >= this.motherSpawnInterval) {
        this.spawnMotherCell(gameServer);
        this.tickMotherS = 0;
    } else {
        this.tickMotherS++;
    }
};

Experimental.prototype.onChange = function(gameServer) {
    // Remove all mother cells
    for (var i in this.nodesMother) {
        gameServer.removeNode(this.nodesMother[i]);
    }
    // Add back default functions
    Virus.prototype.feed = VirusFeed;
    gameServer.getRandomSpawn = require('../GameServer').prototype.getRandomSpawn;
};

// New cell type

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

MotherCell.prototype = new Cell(); // Base

MotherCell.prototype.getEatingRange = function() {
    return this.getSize() / 3.14;
};

MotherCell.prototype.update = function(gameServer) {
    if (Math.random() * 100 > 97) {
        var maxFood = Math.random() * 2; // Max food spawned per tick
        var i = 0; // Food spawn counter
        while (i < maxFood)  {
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
    var dist = (Math.random() * 10) + 5; // Random distance
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
