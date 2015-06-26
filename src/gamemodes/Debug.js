var FFA = require('./FFA'); // Base gamemode
var Packet = require('../packet');

function Debug() {
    FFA.apply(this, Array.prototype.slice.call(arguments));

    this.ID = 21;
    this.name = "Debug Mode";
    this.specByLeaderboard = false;
}

module.exports = Debug;
Debug.prototype = new FFA();

// Gamemode Specific Functions

Debug.prototype.testPath = function(gameServer,player) {
    var cell = player.cells[0];
    var check = gameServer.nodesVirus[0];

    var v1 = Math.atan2(cell.position.x - player.mouse.x,cell.position.y - player.mouse.y);

    // Get angle of vector (cell -> virus)
    var v2 = this.getAngle(cell,check);
    var dist = this.getDist(cell,check);
    console.log(v1);
    console.log(v2);

    var inRange = Math.atan((2 * cell.getSize())/dist); // Opposite/adjacent
    console.log(inRange);
    if ((v1 <= (v2 + inRange)) && (v1 >= (v2 - inRange))) {
        console.log("Collided!");
    } 
}

Debug.prototype.getAngle = function(c1,c2) {
    var deltaY = c1.position.y - c2.position.y;
    var deltaX = c1.position.x - c2.position.x;
    return Math.atan2(deltaX,deltaY);
};

Debug.prototype.getDist = function(cell,check) {
    // Fastest distance - I have a crappy computer to test with :(
    var xd = (check.position.x - cell.position.x);
    xd = xd < 0 ? xd * -1 : xd; // Math.abs is slow

    var yd = (check.position.y - cell.position.y);
    yd = yd < 0 ? yd * -1 : yd; // Math.abs is slow

    return (xd + yd);
};

// Override

Debug.prototype.pressW = function(gameServer,player) {
    // Called when the Q key is pressed
    console.log("Test:");
    this.testPath(gameServer,player);
    player.socket.sendPacket(new Packet.DrawLine(player.mouse.x,player.mouse.y));
};

