var PlayerTracker = require('../PlayerTracker');
var gameServer = require('../GameServer');
var Vector = require('vector2-node');

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
    if (this.cells.length <= 0) {
        return null; // Error!
    }

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
    setTimeout(function() {
        // Calculate nodes
        this.visibleNodes = this.calcViewBox();

        // Calc predators/prey
        var cell = this.getLowestCell();

        // Action
        this.decide(cell);

        // Reset queues
        this.nodeDestroyQueue = [];
        this.nodeAdditionQueue = [];
    }.bind(this), 0);
};

// Custom
BotPlayer.prototype.decide = function(cell) {
    if (!cell) return; // Cell was eaten, check in the next tick (I'm too lazy)
    var cellPos = cell.position;
    var result = new Vector(0, 0);
    // Splitting
    var cellLength = this.cells.length,
        splitCooldown = this.splitCooldown,
        split = false,
        splitTarget = null,
        threats = [];

    var algorithm = function(check, influence) {
        // Calculate separation between cell and check
        var checkPos = check.position;
        var displacement = new Vector(checkPos.x - cellPos.x, checkPos.y - cellPos.y);

        // Figure out distance between cells
        var distance = displacement.length();
        if (influence < 0) {
            // Get edge distance
            distance -= cell.getSize() + check.getSize();
            if (check.cellType == 0) threats.push(check);
        }

        // The farther they are the smaller influnce it is
        if (distance < 1) distance = 1; // Avoid NaN and positive influence with negative distance & attraction
        influence /= distance;

        // Produce force vector exerted by this entity on the cell
        var force = displacement.normalize().scale(influence);

        // Splitting conditions
        if (check.cellType == 0 && cell.mass / 2.6 > check.mass && cell.mass / 5 < check.mass &&
            !split && splitCooldown == 0 && cellLength < 3) {

            // Calculate split distance and check if it is larger than the raw distance
            var mass = cell.mass;
            var t = Math.PI * Math.PI;
            var modifier = 3 + Math.log(1 + mass) / 10;
            var splitSpeed = cell.owner.gameServer.config.playerSpeed * Math.min(Math.pow(mass, -Math.PI / t / 10) * modifier, 150);
            var endDist = Math.max(splitSpeed * 6.8, cell.getSize() * 2); // Checked via C#, final distance is near 6.512x splitSpeed

            if (endDist > distance) {
                // Set the target to split after every entity in visible nodes has passed
                splitTarget = check;
                split = true;
            }
        } else {
            // Add up forces on the entity
            result.add(force);
        }
    }

    this.visibleNodes.forEach(function(check) {
        // Get attraction of the cells - avoid larger cells, viruses and same team cells
        var influence = 0;
        if (check.cellType == 0) {
            // Player cell
            if (cell.owner.gameServer.gameMode.hasTeams && (cell.owner.team == check.owner.team)) influence = -1; // Same team cell
            else if (cell.mass / 1.3 > check.mass) influence = check.getSize(); // Can eat it
            else if (check.mass / 1.3 > cell.mass) influence = -check.getSize(); // Can eat me
        } else if (check.cellType == 1) {
            // Food
            influence = 1;
        } else if (check.cellType == 2) {
            // Virus
            if (cell.mass / 1.3 > check.mass) influence = -1; // Can eat it
        } else if (check.cellType == 3) {
            // Ejected mass
            if (cell.mass / 1.3 > check.mass) influence = check.getSize();
        } else {
            influence = check.getSize(); // Might be TeamZ
        }

        // Apply influence if it isn't 0 or my cell
        if (influence != 0 && cell.owner != check.owner) algorithm(check, influence);
    });

    // Normalize the resulting vector
    result.normalize();

    // Check for splitkilling and threats
    if (split) {
        if (threats.length > 0) if (this.largest(threats).mass / 2.6 > cell.mass) {
            // Splitkill the target
            this.mouse = {
                x: splitTarget.position.x,
                y: splitTarget.position.y
            };
            this.splitCooldown = 16;
            this.gameServer.splitCells(this);
            return;
        }
    }
    this.mouse = {
        x: cellPos.x + result.x * 500,
        y: cellPos.y + result.y * 500
    };
};

// Subfunctions

BotPlayer.prototype.largest = function(list) {
    // Sort the cells by Array.sort() function to avoid errors
    var sorted = list.valueOf();
    sorted.sort(function(a, b) {
        return a.mass - b.mass;
    });

    return sorted[0];
};
