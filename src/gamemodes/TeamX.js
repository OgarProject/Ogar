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
    }, ];
    this.nodesMother = [];
    this.tickMother = 0;
    this.tickMotherS = 0;
}

module.exports = TeamX;
TeamX.prototype = new Teams();

// Gamemode Specific Functions

TeamX.prototype.updateMotherCells = function(gameServer) {
    for (var i in this.nodesMother) {
        var mother = this.nodesMother[i];

        // Checks
        mother.update(gameServer);
        mother.checkEat(gameServer);
    }
};

TeamX.prototype.spawnMotherCell = function(gameServer) {
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

TeamX.prototype.countNotInRange = function(client) {
    var count = 0;
    for (var i = 0; i < client.cells.length; i++) {
        var cell = client.cells[i];
        if (!(cell.inRange === true)) {
            count++;
        }
    }
    return count;
};

// Overwrite:

TeamX.prototype.fuzzColorComponent = function(component) {
    if (component != 255) {
        component = Math.random() * (this.colorFuzziness - 7) + 7;
    }
    return component;
};

TeamX.prototype.getTeamColor = function(team) {
    var color = this.colors[team];
    return {
        r: this.fuzzColorComponent(color.r),
        b: this.fuzzColorComponent(color.b),
        g: this.fuzzColorComponent(color.g)
    };
};

TeamX.prototype.onServerInit = function(gameServer) {
    // Set up teams
    for (var i = 0; i < this.teamAmount; i++) {
        this.nodes[i] = [];
    }

    // Special virus mechanics
    if (this.pushVirus) {
        Virus.prototype.feed = function(feeder, gameServer) {
            gameServer.removeNode(feeder);
            // Pushes the virus
            this.setAngle(feeder.getAngle()); // Set direction if the virus explodes
            this.moveEngineTicks = 5; // Amount of times to loop the movement function
            this.moveEngineSpeed = 30;

            var index = gameServer.movingNodes.indexOf(this);
            if (index == -1) {
                gameServer.movingNodes.push(this);
            }
        };
    }

    if (!this.teamCollision) {
        this.onCellMove = function(x1, y1, cell) {}; // does nothing
        if (GS_getCellsInRange == null)
            GS_getCellsInRange = gameServer.getCellsInRange;

        gameServer.getCellsInRange = function(cell) {
            var list = new Array();
            var squareR = cell.getSquareSize(); // Get cell squared radius

            // Loop through all cells that are visible to the cell. There is probably a more efficient way of doing this but whatever
            var len = cell.owner.visibleNodes.length;
            for (var i = 0; i < len; i++) {
                var check = cell.owner.visibleNodes[i];

                if (typeof check === 'undefined') {
                    continue;
                }

                // if something already collided with this cell, don't check for other collisions
                if (check.inRange) {
                    continue;
                }

                // Can't eat itself
                if (cell.nodeId == check.nodeId) {
                    continue;
                }

                // Can't eat cells that have collision turned off
                if ((cell.owner == check.owner) && (cell.ignoreCollision)) {
                    continue;
                }

                // AABB Collision
                if (!check.collisionCheck2(squareR, cell.position)) {
                    continue;
                }

                // Cell type check - Cell must be bigger than this number times the mass of the cell being eaten
                var multiplier = 1.25;

                switch (check.getType()) {
                    case 1: // Food cell
                        list.push(check);
                        check.inRange = true; // skip future collision checks for this food
                        continue;
                    case 2: // Virus
                        multiplier = 1.33;
                        break;
                    case 0: // Players
                        // Can't eat self if it's not time to recombine yet
                        if (check.owner == cell.owner) {
                            if ((cell.recombineTicks > 0) || (check.recombineTicks > 0)) {
                                continue;
                            }

                            multiplier = 1.00;
                        }

                        // Can't eat team members
                        if (this.gameMode.haveTeams) {
                            if (!check.owner) { // Error check
                                continue;
                            }

                            if ((check.owner != cell.owner) && (check.owner.getTeam() == cell.owner.getTeam()) && this.gameMode.countNotInRange(check.owner) == 1) {
                                continue;
                            }
                        }
                        break;
                    default:
                        break;
                }

                // Make sure the cell is big enough to be eaten.
                if ((check.mass * multiplier) > cell.mass) {
                    continue;
                }

                // Eating range
                var xs = Math.pow(check.position.x - cell.position.x, 2);
                var ys = Math.pow(check.position.y - cell.position.y, 2);
                var dist = Math.sqrt(xs + ys);

                var eatingRange = cell.getSize() - check.getEatingRange(); // Eating range = radius of eating cell + 40% of the radius of the cell being eaten
                if (dist > eatingRange) {
                    // Not in eating range
                    continue;
                }

                // Add to list of cells nearby
                list.push(check);

                // Something is about to eat this cell; no need to check for other collisions with it
                check.inRange = true;
            }
            return list;
        };
    }

    if (GS_getRandomColor == null)
        GS_getRandomColor = gameServer.getRandomColor; // backup
    if (GS_getRandomSpawn == null)
        GS_getRandomSpawn = gameServer.getRandomSpawn;

    // Override this
    gameServer.getRandomSpawn = gameServer.getRandomPosition;
    gameServer.getRandomColor = function() {
        var colorRGB = [0xFF, 0x07, (Math.random() * 256) >> 0];
        colorRGB.sort(function() {
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
        client.color = this.getTeamColor(client.team);
        for (var j = 0; j < client.cells.length; j++) {
            var cell = client.cells[j];
            cell.setColor(client.color);
            this.nodes[client.team].push(cell);
        }
    }
};

TeamX.prototype.onChange = function(gameServer) {
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

TeamX.prototype.onTick = function(gameServer) {
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
    this.color = {
        r: 205,
        g: 85,
        b: 100
    };
    this.spiked = 1;
}

MotherCell.prototype = new Cell(); // Base

MotherCell.prototype.getEatingRange = function() {
    return this.getSize() * .5;
};

MotherCell.prototype.update = function(gameServer) {
    // Add mass
    this.mass += .25;

    // Spawn food
    var maxFood = 10; // Max food spawned per tick
    var i = 0; // Food spawn counter
    while ((this.mass > gameServer.gameMode.motherCellMass) && (i < maxFood)) {
        // Only spawn if food cap hasn been reached
        if (gameServer.currentFood < gameServer.config.foodMaxAmount) {
            this.spawnFood(gameServer);
        }

        // Incrementers
        this.mass--;
        i++;
    }
};

MotherCell.prototype.checkEat = function(gameServer) {
    var safeMass = this.mass * .9;
    var r = this.getSize(); // The box area that the checked cell needs to be in to be considered eaten

    // Loop for potential prey
    for (var i in gameServer.nodesPlayer) {
        var check = gameServer.nodesPlayer[i];

        if (check.mass > safeMass) {
            // Too big to be consumed
            continue;
        }

        // Calculations
        var len = r - (check.getSize() / 2) >> 0;
        if ((this.abs(this.position.x - check.position.x) < len) && (this.abs(this.position.y - check.position.y) < len)) {
            // Eats the cell
            gameServer.removeNode(check);
            this.mass += check.mass;
        }
    }
    for (var i in gameServer.movingNodes) {
        var check = gameServer.movingNodes[i];

        if ((check.getType() == 1) || (check.mass > safeMass)) {
            // Too big to be consumed/ No player cells
            continue;
        }

        // Calculations
        var len = r >> 0;
        if ((this.abs(this.position.x - check.position.x) < len) && (this.abs(this.position.y - check.position.y) < len)) {
            // Eat the cell
            gameServer.removeNode(check);
            this.mass += check.mass;
        }
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
    var dist = (Math.random() * 10) + 22; // Random distance
    f.setMoveEngineData(dist, 15);

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
