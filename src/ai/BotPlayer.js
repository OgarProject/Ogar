var PlayerTracker = require('../PlayerTracker');

function BotPlayer() {
    PlayerTracker.apply(this, Array.prototype.slice.call(arguments));
    //this.color = gameServer.getRandomColor();

    // AI only
    this.gameState = 0;
    this.path = [];

    this.predators = []; // List of cells that can eat this bot
    this.prey = []; // List of cells that can be eaten by this bot
    this.food = [];
    this.foodImportant = []; // Not used - Bots will attempt to eat this regardless of nearby prey/predators
    this.virus = []; // List of viruses

    this.target;
    this.targetVirus; // Virus used to shoot into the target

    this.ejectMass = 0; // Amount of times to eject mass
}

module.exports = BotPlayer;
BotPlayer.prototype = new PlayerTracker();

// Functions

BotPlayer.prototype.getLowestCell = function() {
    // Gets the cell with the lowest mass
    if (this.cells.length <= 0) {
        return null; // Error!
    }

    // Starting cell
    var lowest = this.cells[0];
    for (i = 1; i < this.cells.length; i++) {
        if (lowest.mass > this.cells[i].mass) {
            lowest = this.cells[i];
        }
    }
    return lowest;
};

// Override

BotPlayer.prototype.updateSightRange = function() { // For view distance
    var range = 1000; // Base sight range

    if (this.cells[0]) {
        range += this.cells[0].getSize() * 2.5;
    }

    this.sightRange = range;
};

BotPlayer.prototype.update = function() { // Overrides the update function from player tracker
    // Remove nodes from visible nodes if possible
    for (var i = 0; i < this.nodeDestroyQueue.length; i++) {
        var index = this.visibleNodes.indexOf(this.nodeDestroyQueue[i]);
        if (index > -1) {
            this.visibleNodes.splice(index, 1);
        }
    }

    // Update every 500 ms
    if ((this.tickViewBox <= 0) && (this.gameServer.run)) {
        this.visibleNodes = this.calcViewBox();
        this.tickViewBox = 10;
    } else {
        this.tickViewBox--;
        return;
    }

    // Respawn if bot is dead
    if (this.cells.length <= 0) {
        this.gameServer.gameMode.onPlayerSpawn(this.gameServer,this);
        if (this.cells.length == 0) {
            // If the bot cannot spawn any cells, then disconnect it
            this.socket.close();
            return;
        }
    }

    // Calc predators/prey
    var cell = this.getLowestCell();
    var r = cell.getSize();
    this.clearLists();

    var ignoreMass = Math.min((cell.mass / 10), 100); // Ignores targeting cells below this mass
    // Loop
    for (i in this.visibleNodes) {
        var check = this.visibleNodes[i];

        // Cannot target itself
        if ((!check) || (cell.owner == check.owner)){
            continue;
        }

        var t = check.getType();
        switch (t) {
            case 0:
                // Cannot target teammates
                if (this.gameServer.gameMode.haveTeams) {
                    if (check.owner.team == this.team) {
                        continue;
                    }
                }

                // Check for danger
                if (cell.mass > (check.mass * 1.25)) {
                    this.prey.push(check);
                }
                else
                    if (check.mass > (cell.mass * 1.25)) {
                        // Predator
                        var dist = this.getDist(cell, check) - (r + check.getSize());
                        if (dist < 300) {
                            this.predators.push(check);
                        }
                    }
                break;
            case 1:
                this.food.push(check);
                break;
            case 2: // Virus
                this.virus.push(check);
                break;
            case 3: // Ejected mass
                if (cell.mass > 20) {
                    this.food.push(check);
                }
                break;
            default:
                break;
        }
    }

    // Get gamestate
    this.gameState = this.getState(cell);

    // Action
    this.decide(cell);

    this.nodeDestroyQueue = []; // Empty
};

// Custom

BotPlayer.prototype.clearLists = function() {
    this.predators = [];
    this.prey = [];
    this.food = [];
    this.virus = [];
};

BotPlayer.prototype.getState = function(cell) {
    // Continue to shoot viruses
    if (this.gameState == 4) {
        return 4;
    }

    // Check for predators
    if (this.predators.length <= 0) {
        if (this.prey.length > 0) {
            return 3;
        } else if (this.food.length > 0) {
            return 1;
        }
    } else {
        if ((this.cells.length == 1) && (cell.mass > 180)) {
            var t = this.getBiggest(this.predators);
            var tl = this.findNearbyVirus(t,500,this.virus);
            if (tl != false) {
                this.target = t;
                this.targetVirus = tl;
                return 4;
            }
        } else {
            // Run
            return 2;
        }
    }

    // Bot wanders by default
    return 0;
};

BotPlayer.prototype.decide = function(cell) {
    // The bot decides what to do based on gamestate
    switch (this.gameState) {
        case 0: // Wander
            //console.log("[Bot] "+cell.getName()+": Wandering");
            if ((cell.position.x == this.mouse.x) && (cell.position.y == this.mouse.y)) {
                // Get a new position
                var index = Math.floor(Math.random() * this.gameServer.nodes.length);
                var randomNode = this.gameServer.nodes[index];
                var pos = {x: 0, y: 0};

                if ((randomNode.getType() == 3) || (randomNode.getType() == 1)) {
                    pos.x = randomNode.position.x;
                    pos.y = randomNode.position.y;
                } else {
                    // Not a food/ejected cell
                    pos = this.gameServer.getRandomPosition();
                }

                // Set bot's mouse coords to this location
                this.mouse = {x: pos.x, y: pos.y};
            }
            break;
        case 1: // Looking for food
            //console.log("[Bot] "+cell.getName()+": Getting Food");
            if ((!this.target) || (this.target.getType() == 0) || (this.visibleNodes.indexOf(this.target) == -1)) {
                // Food is eaten/a player cell/out of sight... so find a new food cell to target
                this.target = this.findNearest(cell,this.food);

                this.mouse = {x: this.target.position.x, y: this.target.position.y};
            }
            break;
        case 2: // Run from (potential) predators
            var avoid = this.predators[0];
            //console.log("[Bot] "+cell.getName()+": Fleeing from "+avoid.getName());

            // Find angle of vector between cell and predator
            var deltaY = avoid.position.y - cell.position.y;
            var deltaX = avoid.position.x - cell.position.x;
            var angle = Math.atan2(deltaX,deltaY);

            // Now reverse the angle
            if (angle > Math.PI) {
                angle -= Math.PI;
            } else {
                angle += Math.PI;
            }

            // Direction to move
            var x1 = cell.position.x + (500 * Math.sin(angle));
            var y1 = cell.position.y + (500 * Math.cos(angle));

            this.mouse = {x: x1, y: y1};
            break;
        case 3: // Target prey
            if ((!this.target) || (this.target.getType() != 0) || (this.visibleNodes.indexOf(this.target) == -1)) {
                this.target = this.getRandom(this.prey);
            }
            //console.log("[Bot] "+cell.getName()+": Targeting "+this.target.getName());


            this.mouse = {x: this.target.position.x, y: this.target.position.y};

            var massReq = 1.25 * (this.target.mass * 2 ); // Mass required to splitkill the target

            if ((cell.mass > massReq) && (this.cells.length <= 2)) { // Will not split into more than 4 cells
                var splitDist = (4 * (40 + (cell.getSpeed() * 4))) + (cell.getSize() * 1.75); // Distance needed to splitkill
                var distToTarget = this.getAccDist(cell,this.target); // Distance between the target and this cell

                if (splitDist >= distToTarget) {
                    // Splitkill
                    this.gameServer.splitCells(this);
                }
            }
            break;
        case 4: // Shoot virus
            if ((!this.target) || (!this.targetVirus) ||(!this.cells.length == 1) || (this.visibleNodes.indexOf(this.target) == -1) || (this.visibleNodes.indexOf(this.targetVirus) == -1)) {
                this.gameState = 0; // Reset
                this.target = null;
                break;
            }

            // Make sure target is within range
            var dist = this.getDist(this.targetVirus,this.target) - (this.target.getSize() + 100);
            if (dist > 500) {
                this.gameState = 0; // Reset
                this.target = null;
                break;
            }

            // Find angle of vector between target and virus
            var angle = this.getAngle(this.target,this.targetVirus);

            // Now reverse the angle
            var reversed = this.reverseAngle(angle);

            // Get this bot cell's angle
            var ourAngle = this.getAngle(cell,this.targetVirus);

            // Check if bot cell is in position
            if ((ourAngle <= (reversed + .25) ) && (ourAngle >= (reversed - .25) )) {
                // In position!
                this.mouse = {x: this.targetVirus.position.x, y: this.targetVirus.position.y};

                // Shoot
                for (var v = 0; v < 7 ;v++) {
                    this.gameServer.ejectMass(this);
                }

                // Back to starting pos
                this.mouse = {x: cell.position.x, y: cell.position.y};

                // Cleanup
                this.gameState = 0; // Reset
                this.target = null;
            } else {
                // Move to position
                var r = cell.getSize();
                var x1 = this.targetVirus.position.x + ((350 + r) * Math.sin(reversed));
                var y1 = this.targetVirus.position.y + ((350 + r) * Math.cos(reversed));
                this.mouse = {x: x1, y: y1};
            }

            // console.log("[Bot] "+cell.getName()+": Targeting (virus) "+this.target.getName());
            break;
        default:
            //console.log("[Bot] "+cell.getName()+": Idle "+this.gameState);
            this.gameState = 0;
            break;
    }
};

// Finds the nearest cell in list
BotPlayer.prototype.findNearest = function(cell,list) {
    if (this.currentTarget) {
        // Do not check for food if target already exists
        return null;
    }

    // Check for nearest cell in list
    var shortest = list[0];
    var shortestDist = this.getDist(cell,shortest);
    for (var i = 1; i < list.length; i++) {
        var check = list[i];
        var dist = this.getDist(cell,check);
        if (shortestDist > dist) {
            shortest = check;
            shortestDist = dist;
        }
    }

    return shortest;
};

BotPlayer.prototype.getRandom = function(list) {
    // Gets a random cell from the array
    var n = Math.floor(Math.random() * list.length);
    return list[n];
};

BotPlayer.prototype.getBiggest = function(list) {
    // Gets the biggest cell from the array
    var biggest = list[0];
    for (var i = 1; i < list.length; i++) {
        var check = list[i];
        if (check.mass > biggest.mass) {
            biggest = check;
        }
    }

    return biggest;
};

BotPlayer.prototype.findNearbyVirus = function(cell,checkDist,list) {
    var r = cell.getSize() + 100; // Gets radius + virus radius
    for (var i = 0; i < list.length; i++) {
        var check = list[i];
        var dist = this.getDist(cell,check) - r;
        if (checkDist > dist) {
            return check;
        }
    }
    return false; // Returns a bool if no nearby viruses are found
};

BotPlayer.prototype.getDist = function(cell,check) {
    // Fastest distance - I have a crappy computer to test with :(
    var xd = (check.position.x - cell.position.x);
    xd = xd < 0 ? xd * -1 : xd; // Math.abs is slow

    var yd = (check.position.y - cell.position.y);
    yd = yd < 0 ? yd * -1 : yd; // Math.abs is slow

    return (xd + yd);
};

BotPlayer.prototype.getAccDist = function(cell,check) {
    // Accurate Distance
    var xs = check.position.x - cell.position.x;
    xs = xs * xs;

    var ys = check.position.y - cell.position.y;
    ys = ys * ys;

    return Math.sqrt( xs + ys );
};

BotPlayer.prototype.getAngle = function(c1,c2) {
    var deltaY = c1.position.y - c2.position.y;
    var deltaX = c1.position.x - c2.position.x;
    return Math.atan2(deltaX,deltaY);
};

BotPlayer.prototype.reverseAngle = function(angle) {
    if (angle > Math.PI) {
        angle -= Math.PI;
    } else {
        angle += Math.PI;
    }
    return angle;
};

