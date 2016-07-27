var FFA = require('./FFA'); // Base gamemode
var Cell = require('../entity/Cell');
var Food = require('../entity/Food');
var Virus = require('../entity/Virus');
var Vector = require('../modules/Vector');
var VirusFeed = require('../entity/Virus').prototype.feed;

function Experimental() {
    FFA.apply(this, Array.prototype.slice.call(arguments));

    this.ID = 2;
    this.name = "Experimental";
    this.specByLeaderboard = true;

    // Gamemode Specific Variables
    this.nodesMother = [];

    // Config
    this.motherCellMass = 222;
    this.motherUpdateInterval = 5; // How many ticks it takes to update the mother cell (1 tick = 50 ms)
    this.motherSpawnInterval = 100; // How many ticks it takes to spawn another mother cell - Currently 5 seconds
    this.motherMinAmount = 5;
}

module.exports = Experimental;
Experimental.prototype = new FFA();

// Gamemode Specific Functions

Experimental.prototype.spawnMotherCell = function(gameServer) {
    // Checks if there are enough mother cells on the map
    if (this.nodesMother.length < this.motherMinAmount) {
        // Spawns a mother cell
        var pos = gameServer.nodeHandler.getRandomSpawn();
        var m = new MotherCell(gameServer.getNextNodeId(), null, pos, this.motherCellMass, gameServer);
        gameServer.addNode(m);
    }
};

// Override

Experimental.prototype.onServerInit = function(gameServer) {
    // Called when the server starts
    gameServer.run = true;

    var mapSize = gameServer.config.borderLeft + gameServer.config.borderRight +
        gameServer.config.borderTop + gameServer.config.borderRight;

    this.motherMinAmount = Math.ceil(mapSize / 2020.28572); // 14 mother cells for agar.io map size

    // Special virus mechanics
    Virus.prototype.feed = function(feeder) {
        feeder.setKiller(this);
        this.gameServer.removeNode(feeder);
        
        // Pushes the virus
        // Effect on angle is smaller with larger move engine speed
        var speed = this.moveEngine.distance() + 12;
        var normalized = this.moveEngine.clone().normalize();
        
        // Error check if the virus isn't moving
        if (isNaN(normalized.x + normalized.y))
            normalized = new Vector(0, 0);
            
        normalized.add(feeder.moveEngine.clone().normalize());
        
        this.moveEngine = new Vector(normalized.scale(speed / 2));
    };
};

Experimental.prototype.onTick = function(gameServer) {
    // Spawn mother cell if necessary
    this.spawnMotherCell(gameServer);
};

Experimental.prototype.onChange = function(gameServer) {
    // Remove all mother cells
    for (var i in this.nodesMother) gameServer.removeNode(this.nodesMother[i]);
    Virus.prototype.feed = VirusFeed;
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
    this.ownedFood = []; // Every mothercell will control its spawned food
}

MotherCell.prototype = new Virus(); // Base

MotherCell.prototype.getEatingRange = function() {
    return this.getSize() / 3.14;
};

MotherCell.prototype.eat = function() {
    // Spawn food
    if (Math.random() * 100 > 99) {
        var maxFood = Math.random() * 2; // Max food spawned per tick
        var i = 0; // Food spawn counter
        while (i < maxFood) {
            // Only spawn if food cap hasn't been reached
            if (this.ownedFood.length < 40) {
                this.spawnFood(this.gameServer);
            }

            // Increment
            i++;
        }
    }
    if (this.mass > 222) {
        // Always spawn food if the mother cell is larger than 222
        var cellSize = this.gameServer.config.foodMass;
        var remaining = this.mass - 222;
        var maxAmount = Math.min(Math.floor(remaining / cellSize), 2);
        for (var i = 0; i < maxAmount; i++) {
            this.spawnFood(this.gameServer);
            this.mass -= cellSize;
        }
    }

    var nearby = this.gameServer.quadTree.query(this.getRange(), function(node) {
        if (!node) return false;
        return node.cellType != 1; // Don't check food
    });
    
    // Loop for potential prey
    for (var i = 0; i < nearby.length; i++) {
        this.checkEatCell(nearby[i], this.gameServer);
    }
};

MotherCell.prototype.checkEatCell = function(check, gameServer) {
    if (!check) return;
    if (check.cellType == 1) return; // Check is a food cell

    if (gameServer.collisionHandler.canEat(this, check)) {
        // Eat it
        check.setKiller(this);
        gameServer.removeNode(check);
        this.mass += check.mass;
    }
};

MotherCell.prototype.spawnFood = function() {
    // Get starting position
    var angle = Math.random() * 6.28;
    var r = this.getSize();
    var pos = {
        x: this.position.x + (r * Math.sin(angle)),
        y: this.position.y + (r * Math.cos(angle))
    };

    // Spawn food
    var f = new Food(this.gameServer.getNextNodeId(), null, pos, this.gameServer.config.foodMass, this.gameServer);
    f.setColor(this.gameServer.getRandomColor());
    
    // Add to a controlled food list
    this.ownedFood.push(f);
    f.insertedList = this.ownedFood;
    this.gameServer.addNode(f);

    // Move engine
    f.angle = angle;
    var dist = (Math.random() * 8) + 8; // Random distance
    f.moveEngine = new Vector(
        Math.sin(f.angle) * -dist,
        Math.cos(f.angle) * -dist
    );
};

MotherCell.prototype.onAdd = function(gameServer) {
    gameServer.gameMode.nodesMother.push(this); // Temporary
};

MotherCell.prototype.onRemove = function(gameServer) {
    var index = gameServer.gameMode.nodesMother.indexOf(this);
    if (index != -1) {
        gameServer.gameMode.nodesMother.splice(index, 1);
    }
};
