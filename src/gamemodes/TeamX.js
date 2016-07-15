// TODO: fix this game mode has outdated code and probably will not works
var Teams = require('./Teams.js');
var Cell = require('../entity/Cell.js');
var Food = require('../entity/Food.js');
var Virus = require('../entity/Virus.js');
var VirusFeed = Virus.prototype.feed;

var GS_getRandomColor = null; // backup getRandomColor function of current gameServer
var GS_getRandomSpawn = null;
var GS_getCellsInRange = null;

function TeamX() {
    Teams.apply(this, Array.prototype.slice.call(arguments));
    
    this.ID = 14;
    this.name = 'Experimental Team';
    
    // configurations:
    this.teamCollision = false; // set to true to disable eating teammates
    this.pushVirus = false; // true: pushing virus, false: splitting virus
    this.colorFuzziness = 72;
    this.motherCellMass = 200;
    this.motherUpdateInterval = 5; // How many ticks it takes to update the mother cell (1 tick = 50 ms)
    this.motherSpawnInterval = 100; // How many ticks it takes to spawn another mother cell - Currently 5 seconds
    this.motherMinAmount = 5;
    
    // game mode data:
    this.colors = [{
            'r': 255,
            'g': 7,
            'b': 7
        }, {
            'r': 7,
            'g': 255,
            'b': 7
        }, {
            'r': 7,
            'g': 7,
            'b': 255
        },];
    this.nodesMother = [];
    this.tickMother = 0;
    this.tickMotherS = 0;
}

module.exports = TeamX;
TeamX.prototype = new Teams();

// Gamemode Specific Functions

TeamX.prototype.updateMotherCells = function (gameServer) {
    for (var i in this.nodesMother) {
        var mother = this.nodesMother[i];
        
        // Checks
        mother.update(gameServer);
        mother.checkEat(gameServer);
    }
};

TeamX.prototype.spawnMotherCell = function (gameServer) {
    // Checks if there are enough mother cells on the map
    if (this.nodesMother.length < this.motherMinAmount) {
        // Spawns a mother cell
        var pos = gameServer.getRandomPosition();
        
        // Check for players
        var size = Math.sqrt(this.motherCellMass * 100);
        var bound = {
            minx: pos.x - size,
            miny: pos.y - size,
            maxx: pos.x + size,
            maxy: pos.y + size
        };
        if (gameServer.quadTree.any(bound, function (item) { return item.cell.cellType == 0; })) {
            return;
        }
        // Spawn if no cells are colliding
        var m = new MotherCell(gameServer.getNextNodeId(), null, pos, this.motherCellMass);
        gameServer.addNode(m);
    }
};

TeamX.prototype.countNotInRange = function (client) {
    var count = 0;
    for (var i = 0; i < client.cells.length; i++) {
        var cell = client.cells[i];
        if (!(cell.isRemoved === true)) {
            count++;
        }
    }
    return count;
};

// Overwrite:

TeamX.prototype.fuzzColorComponent = function (component) {
    if (component != 255) {
        component = Math.random() * (this.colorFuzziness - 7) + 7;
    }
    return component;
};

TeamX.prototype.getTeamColor = function (team) {
    var color = this.colors[team];
    return {
        r: this.fuzzColorComponent(color.r),
        b: this.fuzzColorComponent(color.b),
        g: this.fuzzColorComponent(color.g)
    };
};

TeamX.prototype.onServerInit = function (gameServer) {
    // Set up teams
    for (var i = 0; i < this.teamAmount; i++) {
        this.nodes[i] = [];
    }
    
    // Special virus mechanics
    if (this.pushVirus) {
        Virus.prototype.onEat = function (prey) {
            // Pushes the virus
            var angle = prey.isMoving ? prey.getAngle() : this.getAngle();
            this.setBoost(16 * 20, angle);
        };
    }
    
    if (GS_getRandomColor == null)
        GS_getRandomColor = gameServer.getRandomColor; // backup
    if (GS_getRandomSpawn == null)
        GS_getRandomSpawn = gameServer.getRandomSpawn;
    
    // Override this
    gameServer.getRandomSpawn = gameServer.getRandomPosition;
    gameServer.getRandomColor = function () {
        var colorRGB = [0xFF, 0x07, (Math.random() * 256) >> 0];
        colorRGB.sort(function () {
            return 0.5 - Math.random();
        });
        return {
            r: colorRGB[0],
            b: colorRGB[1],
            g: colorRGB[2]
        };
    };
    
    // migrate current players to team mode
    for (var i = 0; i < gameServer.clients.length; i++) {
        var client = gameServer.clients[i].playerTracker;
        this.onPlayerInit(client);
        client.setColor(this.getTeamColor(client.team));
        for (var j = 0; j < client.cells.length; j++) {
            var cell = client.cells[j];
            cell.setColor(client.getColor());
            this.nodes[client.team].push(cell);
        }
    }
};

TeamX.prototype.onChange = function (gameServer) {
    // Remove all mother cells
    for (var i in this.nodesMother) {
        gameServer.removeNode(this.nodesMother[i]);
    }
    // Add back default functions
    if (this.pushVirus)
        Virus.prototype.feed = VirusFeed;
    gameServer.getRandomColor = GS_getRandomColor;
    gameServer.getRandomSpawn = GS_getRandomSpawn;
    GS_getRandomColor = null;
    GS_getRandomSpawn = null;
    if (GS_getCellsInRange != null) {
        gameServer.getCellsInRange = GS_getCellsInRange;
        GS_getCellsInRange = null;
    }
};

TeamX.prototype.onTick = function (gameServer) {
    // Mother Cell updates
    if (this.tickMother >= this.motherUpdateInterval) {
        this.updateMotherCells(gameServer);
        this.tickMother = 0;
    } else {
        this.tickMother++;
    }
    
    // Mother Cell Spawning
    if (this.tickMotherS >= this.motherSpawnInterval) {
        this.spawnMotherCell(gameServer);
        this.tickMotherS = 0;
    } else {
        this.tickMotherS++;
    }
};

// -------------------------------------------------------------------------------------------
// New cell type (exactly copied from Experimental mode)

function MotherCell() { // Temporary - Will be in its own file if Zeach decides to add this to vanilla
    Cell.apply(this, Array.prototype.slice.call(arguments));
    
    this.cellType = 2; // Copies virus cell
    this.setColor({ r: 205, g: 85, b: 100 });
    this.isSpiked = true;
}

MotherCell.prototype = new Cell(); // Base

MotherCell.prototype.update = function (gameServer) {
    // Add mass
    this.setSize(Math.sqrt(this.getSize() * this.getSize() + 0.25 * 0.25));
    
    // Spawn food
    var maxFood = 10; // Max food spawned per tick
    var i = 0; // Food spawn counter
    while ((this.getMass() > gameServer.gameMode.motherCellMass) && (i < maxFood)) {
        // Only spawn if food cap hasn been reached
        if (gameServer.currentFood < gameServer.config.foodMaxAmount) {
            this.spawnFood(gameServer);
        }
        
        // Incrementers
        this.setSize(Math.sqrt(this.getSize() * this.getSize() - 1));
        i++;
    }
};

MotherCell.prototype.spawnFood = function (gameServer) {
    // Get starting position
    var angle = Math.random() * 6.28; // (Math.PI * 2) ??? Precision is not our greatest concern here
    var r = this.getSize();
    var pos = {
        x: this.position.x + (r * Math.sin(angle)),
        y: this.position.y + (r * Math.cos(angle))
    };
    
    // Spawn food
    var cell = new Food(gameServer.getNextNodeId(), null, pos, gameServer.config.foodMinSize, gameServer);
    cell.setColor(gameServer.getRandomColor());
    
    gameServer.addNode(cell);
    
    // Move engine
    var dist = (Math.random() * 10) + 22; // Random distance
    // TODO: check distance
    cell.setBoost(dist * 15, angle);
};

MotherCell.prototype.onEaten = Virus.prototype.onEaten; // Copies the virus prototype function

MotherCell.prototype.onAdd = function (gameServer) {
    gameServer.gameMode.nodesMother.push(this); // Temporary
};

MotherCell.prototype.onRemove = function (gameServer) {
    var index = gameServer.gameMode.nodesMother.indexOf(this);
    if (index != -1) {
        gameServer.gameMode.nodesMother.splice(index, 1);
    }
};
