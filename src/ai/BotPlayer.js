var PlayerTracker = require('../PlayerTracker');
var gameServer = require('../GameServer');
var Vector2 = require('vector2-node');

function BotPlayer() {
    PlayerTracker.apply(this, Array.prototype.slice.call(arguments));
    //this.color = gameServer.getRandomColor();

    // AI only
    this.gameState = 0; // 0 - Moving, 1 - Virusing enemies

    this.threats = []; // List of cells that can eat this bot
    this.eatables = []; // List of cells that can be eaten by this bot
    this.prey = [];
    this.virus = []; // List of viruses
    this.obstacles = []; // Viruses or same-team cells that will be avoided

    this.splitCooldown = 0; // When I split, this will be 16
    this.juke = false;

    this.target;
    this.targetVirus; // Virus used to shoot into the target
    this.virusShots = 0; // Amount of pressed W to explode target via target virus

    this.ejectMass = 0; // Amount of times to eject mass
    this.mouse = {
        x: 0,
        y: 0
    };
    this.targetPos = {
        x: 0,
        y: 0
    };
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

BotPlayer.prototype.getHighestCell = function() {
    // Gets the cell with the highest mass
    if (this.cells.length <= 0) {
        return null; // Error!
    }

    // Starting cell
    var highest = this.cells[0];
    for (i = 1; i < this.cells.length; i++) {
        if (highest.mass > this.cells[i].mass) {
            highest = this.cells[i];
        }
    }
    return highest;
};

// Don't override, testing to use more accurate way.
/*
BotPlayer.prototype.updateSightRange = function() { // For view distance
    var range = 1000; // Base sight range

    if (this.cells[0]) {
        range += this.cells[0].getSize() * 2.5;
    }

    this.sightRangeX = range;
    this.sightRangeY = range;
}; */

BotPlayer.prototype.update = function() { // Overrides the update function from player tracker
    // Remove nodes from visible nodes if possible
    for (var i = 0; i < this.nodeDestroyQueue.length; i++) {
        var index = this.visibleNodes.indexOf(this.nodeDestroyQueue[i]);
        if (index > -1) {
            this.visibleNodes.splice(index, 1);
        }
    }

    // Respawn if bot is dead
    if (this.cells.length <= 0) {
        this.gameServer.gameMode.onPlayerSpawn(this.gameServer, this);
        if (this.cells.length == 0) {
            // If the bot cannot spawn any cells, then disconnect it
            this.socket.close();
            return;
        }
    }

    if (this.splitCooldown > 0) this.splitCooldown -= 1;
    this.shouldUpdateNodes();

    setTimeout(function() {
        // Calculate what should I do
        var cell = this.getLowestCell();
        this.clearLists();

        // Get gamestate
        this.gameState = -1;
        this.decide(cell);
    }.bind(this), 0);

    // Reset queues
    this.nodeDestroyQueue = [];
    this.nodeAdditionQueue = [];
};

BotPlayer.prototype.shouldUpdateNodes = function() {
    if ((this.tickViewBox <= 0) && (this.gameServer.run)) {
        this.visibleNodes = this.calcViewBox();
        this.tickViewBox = 2;
    } else {
        this.tickViewBox--;
    }
};

BotPlayer.prototype.getState = function(cell) {
    if (this.gameState == 4) {
        // Continue to shoot viruses
        return 4;
    }

    // Bot now has only two states: virusing cells and moving
    if (this.cells.length == 1 && cell.mass > 180 && this.threats.length > 0) {
        var t = this.getBiggest(this.threats);
        var tl = this.findNearbyVirus(t, 500, this.virus);
        if (tl != false) {
            this.target = t;
            this.targetVirus = tl;
            return 1;
        } else return 0;
    } else {
        // Run
        return 0; // None
    }
};

BotPlayer.prototype.decide = function(cell) {
    if (!cell) return; // Error!
    switch (this.gameState) {
        /*case 1: // Shoot virus
            if ((!this.target) || (!this.targetVirus) || (!this.cells.length == 1) ||
                (this.visibleNodes.indexOf(this.target) == -1) || (this.visibleNodes.indexOf(this.targetVirus) == -1)) {

                this.gameState = 0; // Reset
                this.target = null;
                break;
            }

            // Make sure target is within range
            var dist = this.getDist(this.targetVirus, this.target) - (this.target.getSize() + 100);
            if (dist > 500) {
                this.gameState = 0; // Reset
                this.target = null;
                break;
            }

            // Find angle of vector between target and virus
            var angle = this.getAngle(this.targetVirus, this.target);

            // Get my angle to target virus
            var ourAngle = this.getAngle(cell, this.targetVirus);

            // Check if I'm in position
            if ((ourAngle <= (angle + .25)) && (ourAngle >= (angle - .25))) {
                // In position!
                this.updateMouse(this.targetVirus.position.x, this.targetVirus.position.y);

                // Shoot W
                if (this.virusShots <= this.gameServer.config.virusFeedAmount) {
                    this.gameServer.ejectMass(this);
                    this.virusShots++;
                    break;
                }

                // Cleanup
                this.gameState = 0; // Reset
                this.virusShots = 0;
                this.target = null;
            } else {
                // Move to position
                var r = cell.getSize();
                var x1 = this.targetVirus.position.x + ((350 + r) * Math.sin(angle));
                var y1 = this.targetVirus.position.y + ((350 + r) * Math.cos(angle));
                this.updateMouse(x1, y1);
            }*/
        default:
            // Using a powerful class Vector2 I can calculate where should I go in no time
            // Simply put!
            var vector = this.move(cell);

            this.updateMouse(cell.position.x + vector.x * 500, cell.position.y + vector.y * 500);
            break;
    }

    // Recombining
    if (this.cells.length > 1) {
        var r = 0;
        // Get amount of cells that can merge
        for (var i in this.cells) {
            if (this.cells[i].shouldRecombine) {
                r++;
            }
        }
        // Merge
        if (r >= 2) {
            this.updateMouse(this.centerPos.x, this.centerPos.y);
        }
    }
};

BotPlayer.prototype.updateMouse = function(xPos, yPos) {
    this.targetPos = {
        x: xPos,
        y: yPos
    },
    this.mouse = {
        x: this.targetPos.x,
        y: this.targetPos.y
    };
};

BotPlayer.prototype.move = function(cell) {
      try {
          var cellPos = cell.position;
          var result = new Vector2(0, 0);
          var ref = this;
          var hasSplit = false;

          this.visibleNodes.forEach(function(check) {
              if (!check) return; // Undefined/null check
              if (check.owner == cell.owner) return; // Cannot target own cells
              i++;

              // Calculate influence based on cell type and eating chance
              var influence = 0;
              if (check.cellType == 2) {
                  if (cell.mass / 1.3 > check.mass && ref.cells.length == 16) influence = check.getSize() / 10; // I can eat it
                  else if (cell.mass / 1.3 > check.mass) influence = -1; // Obstacle
              } else if (check.cellType == 0) {
                  if (cell.owner.gameServer.gameMode.hasTeams) {
                      if (check.owner.team == cell.owner.team) influence = -1; // Obstacle
                  } else {
                      if (cell.mass / 1.3 > check.mass) influence = check.getSize() / 10; // I can eat it
                      if (check.mass / 1.3 > cell.mass) influence = (cell.getSize() / 10 - check.getSize() / 10); // It can eat me
                  }
              } else if (check.cellType == 3) {
                  // Ejected cells
                  if (cell.mass / 1.3 > check.mass) influence = check.getSize() / 10;
              } else {
                  // Food
                  influence = check.getSize() / 10;
              }

              // Calculate separation between agent and entity
              var displacement = new Vector2(check.position.x, check.position.y).sub(cellPos.x, cellPos.y);

              // Figure out distance between entities
              var distance = displacement.length() - cell.getSize() - check.getSize();

              // The more distant I am, the smaller the influence is
              influence /= distance;

              // Produce force vector exerted by this entity on the agent
              var force = displacement.normalize().scale(influence);

              if (ref.canSplitkill(check) && ref.checkPath(cell, check) && ref.cells.length < 3 && ref.splitCooldown <= 0 && !hasSplit) {
                  // Splitkill!
                  ref.gameServer.splitCells(ref);
                  hasSplit = true;
              }

              // Add up forces on the entity
              result.add(force);
          });

          // Normalize the resulting vector
          result.normalize();

          return result;
      } catch(ex) { }
}

BotPlayer.prototype.clearLists = function() {
    this.eatables = [];
    this.threats = [];
    this.splitThreats = [];
    this.obstacles = [];
    this.virus = [];
};

// Library of subfunctions which are directions to what should I do

BotPlayer.prototype.findNearbyVirus = function(cell, checkDist, list) {
    var r = cell.getSize() + 100; // Gets radius + virus radius
    for (var i = 0; i < list.length; i++) {
        var check = list[i];
        var dist = this.distance(cell, check) - r;
        if (checkDist > dist) {
            return check;
        }
    }
    return false; // Returns a bool if no nearby viruses are found
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

BotPlayer.prototype.distance = function(position1, position2) {
    var xs = position1.x - position2.x;
    var ys = position1.y - position2.y;
    return Math.sqrt(xs * xs + ys * ys);
};

BotPlayer.prototype.angle = function(position1, position2) {
    var xs = position1.x - position2.x;
    var ys = position1.y - position2.y;
    return Math.atan2(xs, ys);
};

BotPlayer.prototype.edgeDistance = function(cell, check) {
    // distance - (r1 + r2)
    return this.distance(cell.position, check.position) - this.collideDistance(cell, check);
};

BotPlayer.prototype.isVirus = function(cell) {
    return cell.spiked == 1;
};

BotPlayer.prototype.collideDistance = function(cell, check) {
    // r1 + r2
    return cell.getSize() + check.getSize();
};

BotPlayer.prototype.isMyTeam = function(check) {
    // Is that cell in my team?
    return this.team == check.owner.team && this.gameServer.gameMode.haveTeams;
};

BotPlayer.prototype.canSplitkill = function(cell, check) {
    // Can I split to eat this cell?
    var dist = this.distance(cell.position, check.position);
    var splitDist = this.splitDistance(cell);
    return (cell.mass / 2.6) > check.mass && dist < splitDist;
};

BotPlayer.prototype.checkPath = function(cell, check) {
    // Checks if the cell is in the way

    // Get angle of vector (cell -> path)
    var v1 = Math.atan2(cell.position.x - this.mouse.x, cell.position.y - this.mouse.y);

    // Get angle of vector (virus -> cell)
    var v2 = this.getAngle(check, cell);
    v2 = this.reverseAngle(v2);

    return ((v1 <= (v2 + .31) && (v1 >= (v2 - .31)));
};

BotPlayer.prototype.splitDistance = function(cell) {
    // How long will I go after I have split
    var mass = cell.mass;
    var t = Math.PI * Math.PI;
    var modifier = 3 + Math.log(1 + mass) / 10;
    var splitSpeed = this.gameServer.config.playerSpeed * Math.min(Math.pow(mass, -Math.PI / t / 10) * modifier, 150);
    return Math.max(splitSpeed * 6.8, cell.getSize() * 2); // Checked via C#, final distance is near 6.512x splitSpeed
};

BotPlayer.prototype.abs = function(x) {
    return x < 0 ? -x : x;
};
