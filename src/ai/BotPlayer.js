var PlayerTracker = require('../PlayerTracker');
var Vector = require('../modules/Vector');

function BotPlayer() {
    PlayerTracker.apply(this, Array.prototype.slice.call(arguments));
    //this.color = gameServer.getRandomColor();

    this.splitCooldown = 0;
}

module.exports = BotPlayer;
BotPlayer.prototype = new PlayerTracker();

// Functions

BotPlayer.prototype.getLowestCell = function() {
    // Gets the cell with the lowest mass
    if (this.cells.length <= 0) return null;

    // Sort the cells by Array.sort() function to avoid errors
    var sorted = this.cells.valueOf();
    sorted.sort(function(a, b) {
        return b.mass - a.mass;
    });

    return sorted[0];
};

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
        
    if (this.splitCooldown > 0) this.splitCooldown--;
        
    // Calculate nodes
    this.visibleNodes = this.viewReset();
    var cell = this.getLowestCell();
    // Action
    this.decide(cell);
    
    // Reset queues
    this.nodeDestroyQueue = [];
    this.nodeAdditionQueue = [];
};

// Custom
BotPlayer.prototype.decide = function(cell) {
    if (!cell) return; // Cell was eaten, check in the next tick (I'm too lazy)
    
    var mouse = new Vector(0, 0),
        possibleTargets = [],
        splitThreatLevel = 0; // Nearby viruses or larger cells are considered split threats

    for (var i = 0; i < this.visibleNodes.length; i++) {
        if (isNaN(mouse.x) || isNaN(mouse.y)) break;
        var check = this.visibleNodes[i];
        if (!check) continue;
        if (check.owner) if (this.pID == check.owner.pID) continue; // Owned cell
        
        var attraction = 0;
        
        // Get attraction of the cell - avoid larger and same team cells, and target smaller
        if (check.cellType == 0) {
            // Player cells
            if (check.owner.team == this.team) attraction = -check.mass; // My team
            else {
                if (cell.mass / 10 > check.mass) continue; // Too small to check
                // Not my team - check for targets/threats
                if (cell.mass / 1.3 > check.mass) {
                    // Can eat it
                    attraction = check.mass;
                    if (cell.mass / 2.6 > check.mass) possibleTargets.push(check);
                } else {
                    if (check.mass / 1.3 > cell.mass) attraction = -check.mass; // Can eat me
                    // Split threat - distance relative
                    splitThreatLevel += cell.position.distanceTo(check.position) * (1 +check.mass - cell.mass);
                }
            }
        }
        if (check.cellType == 1) {
            // Food
            if (cell.mass > 600) continue; // Too large to eat food
            attraction = check.mass;
        }
        if (check.cellType == 2) {
            // Virus
            if (cell.mass / 1.3 > check.mass) {
                if (this.cells.length >= this.gameServer.config.playerMaxCells) attraction = check.mass; // Won't explode
                else {
                    // Split threat - distance relative
                    attraction = -check.mass;
                    splitThreatLevel += cell.position.distanceTo(check.position);
                }
            }
        }
        if (check.cellType == 3) {
            // Ejected mass
            if (cell.mass / 1.3 > check.mass) attraction = check.mass; // Can eat it
        }
        
        if (attraction == 0) continue; // Can't do anything with check
        
        // Get distance
        var distance = cell.position.clone().sub(check.position);
        console.log(distance);
        
        // Negative attraction - get edge distance
        if (attraction < 0) distance.addDistance(-cell.position - check.position);
        
        // Apply to mouse
        mouse.add(distance.normalize().scale(attraction));
    }
    console.log(i)
    
    if (possibleTargets.length > 0 && splitThreatLevel < cell.mass) {
        // See for targets
        possibleTargets.sort(function(a, b) {
            return cell.position.sqDistanceTo(a.position) - cell.position.sqDistanceTo(b.position);
        });
        
        for (var i = 0; i < possibleTargets.length; i++) {
            var check = possibleTargets[i];
            
            // Check if I can splitkill it
            var dist = cell.position.distanceTo(check.position);
            var splitDist = Math.max(this.splitDistance(cell), cell.getSize() * 3);
            
            if (dist < splitDist) {
                // Split-kill
                this.mouse.x = check.position.x;
                this.mouse.y = check.position.y;
                this.splitCooldown = 16;
                this.gameServer.nodeHandler.splitCells(this);
                return;
            }
        }
    }
    mouse.normalize().scale(800);

    this.mouse.x = mouse.x;
    this.mouse.y = mouse.y;
};
// Subfunctions

BotPlayer.prototype.largest = function(list) {
    // Sort the cells by Array.sort() function to avoid errors
    var sorted = list.valueOf();
    sorted.sort(function(a, b) {
        return b.mass - a.mass;
    });

    return sorted[0];
};

BotPlayer.prototype.splitDistance = function(cell) {
    // Calculate split distance and check if it is larger than the raw distance
    var mass = cell.mass;
    var t = Math.PI * Math.PI;
    var modifier = 3 + Math.log(1 + mass) / 10;
    var splitSpeed = cell.owner.gameServer.config.playerSpeed * Math.min(Math.pow(mass, -Math.PI / t / 10) * modifier, 150);
    var endDist = Math.max(splitSpeed * 12.8, cell.getSize() * 2); // Checked via C#, final distance is near 6.512x splitSpeed
    
    return endDist;
};
