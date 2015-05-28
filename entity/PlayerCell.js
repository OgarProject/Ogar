var Cell = require('./Cell');

function PlayerCell() {
    Cell.apply(this, Array.prototype.slice.call(arguments));

    this.cellType = 0;
}

module.exports = PlayerCell;
PlayerCell.prototype = new Cell();

// Main Functions

PlayerCell.prototype.onConsume = function(consumer,gameServer) {
    consumer.addMass(this.mass);
}

PlayerCell.prototype.onAdd = function(gameServer) {
    // Add to special player node list
    gameServer.nodesPlayer.push(this);
    // Gamemode actions
    gameServer.gameMode.onCellAdd(this);
}

PlayerCell.prototype.onRemove = function(gameServer) {
    var index;
    // Remove from player screen
    index = this.owner.cells.indexOf(this);
    if (index != -1) {
        this.owner.cells.splice(index, 1);
    } else {
        console.log("[Warning] Tried to remove a non existant cell from cell list.");
    }
    // Remove from visible list
    index = this.owner.visibleNodes.indexOf(this);
    if (index != -1) {
        this.owner.visibleNodes.splice(index, 1);
    }
    // Remove from special player controlled node list
    index = gameServer.nodesPlayer.indexOf(this);
    if (index != -1) {
        gameServer.nodesPlayer.splice(index, 1);
    } else {
        console.log("[Warning] Tried to remove a non existant cell from player nodes.");
    }
    // Gamemode actions
    gameServer.gameMode.onCellRemove(this);
}