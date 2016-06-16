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
        var m = new MotherCell(gameServer.getNextNodeId(), null, pos, this.motherCellMass, gameServer);
        gameServer.addNode(m);
    }
};

// Override

Experimental.prototype.onServerInit = function(gameServer) {
    // Called when the server starts
    gameServer.run = true;

    var mapWidth = gameServer.config.borderRight - gameServer.config.borderLeft;
    var mapHeight = gameServer.config.borderBottom - gameServer.config.borderTop;
    var mapSize = Math.max(mapWidth, mapHeight);

    this.motherMinAmount = Math.ceil(mapSize / 2000); // 7 mother cells for vanilla map size

    // Special virus mechanics
    Virus.prototype.feed = function(feeder, gameServer) {
        // Pushes the virus
        // TODO: check distance
        this.setBoost(16 * 20, feeder.getAngle());
        //this.setAngle(feeder.getAngle()); // Set direction if the virus explodes
        //this.moveEngineTicks += 20; // Amount of times to loop the movement function
        //this.moveEngineSpeed += 16;
        //this.moveDecay = 0.875;

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
    if (this.getMass() > 222) {
        // Always spawn food if the mother cell is larger than 222
        var cellSize = gameServer.config.foodMass;
        var remaining = this.getMass() - 222;
        var maxAmount = Math.min(Math.floor(remaining / cellSize), 2);
        for (var i = 0; i < maxAmount; i++) {
            this.spawnFood(gameServer);
            this.setMass(this.getMass() - cellSize);
        }
    }
};

MotherCell.prototype.canEat = function (cell) {
    return cell.cellType == 0 ||    // can eat player cell
        cell.cellType == 3;         // can eat ejected mass
};

MotherCell.prototype.spawnFood = function(gameServer) {
    // Get starting position
    var angle = Math.random() * 6.28;
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
    var dist = (Math.random() * 25) + 25; // Random distance
    // TODO: check distance
    f.setBoost(dist, angle);

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
