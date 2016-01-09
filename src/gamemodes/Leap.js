// Leap gamemode by ogarServ implemented in andrew's ogar

var FFA = require('./FFA') //Base Gamemode
var Entity = require('../entity'); //You can delete if your gamemode doesn't modify entities

function Leap() {
    FFA.apply(this, Array.prototype.slice.call(arguments)); // Delete if you're not using a base gamemode (recommended to use one)
	
    this.ID = 18; // Change the -1 to what number must be inserted into the config. Example: this.ID = 7;
    this.name = "Leap"; // Put the gamemode name inside of the ""
    this.decayMod = 1.0; // Modifier for decay rate (Multiplier)
    this.packetLB = 49; // Packet id for leaderboard packet (48 = Text List, 49 = List, 50 = Pie chart)
    this.haveTeams = false; // True = gamemode uses teams, false = gamemode doesnt use teams

    this.specByLeaderboard = true; // false = spectate from player list instead of leaderboard
}

module.exports = Leap; // Remove the <> and make sure to not put the .js at the end
Leap.prototype = new FFA(); // Change if you want to use a different Base gamemode, or delete this line if you don't want a base gamemode (advanced users)


Leap.prototype.pressSpace = function(gameServer,player) {
     var len = player.cells.length;
    for (var i = 0; i < len; i++) {
		
        var cell = player.cells[i];
        if (!cell) {
            continue;
        }
		
        if (cell.mass < (gameServer.config.playerMinMassSplit * 2)) {
            continue;
        }
		
        // Get angle
        var deltaY = player.mouse.y - cell.position.y;
        var deltaX = player.mouse.x - cell.position.x;
        var angle = Math.atan2(deltaX,deltaY);

        // Get starting position
        var size = cell.getSize()/2;
        var startPos = {
            x: cell.position.x + ( size * Math.sin(angle) ),
            y: cell.position.y + ( size * Math.cos(angle) )
        };
        // Speed & Mass
        var splitSpeed = cell.getSpeed() * 12;
        var newMass = (cell.mass / 10) * 7;
        cell.mass = newMass;
        // Let's go
        var split = new Entity.PlayerCell(gameServer.getNextNodeId(), player, startPos, newMass);
        split.setAngle(angle);
        split.setMoveEngineData(splitSpeed, 32, 0.85); 
        split.calcMergeTime(gameServer.config.playerRecombineTime);
        gameServer.setAsMovingNode(split);
        gameServer.addNode(split);
		gameServer.removeNode(cell);
    }
};
