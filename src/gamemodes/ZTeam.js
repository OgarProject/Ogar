var Mode = require('./Mode.js');

var GameState = { WF_START: 0, IN_PROGRESS: 1 };
function ZTeam() {
    Mode.apply(this, Array.prototype.slice.call(arguments));

    this.ID = 13;
    this.name = "Zombie Team";
    this.packetLB = 48;
    this.haveTeams = true;

    // configurations:
    this.gameDuration = 30 * 60 * 1000; // milliseconds
    this.warmUpDuration = 60 * 1000; // time to wait between games
    
    // game mode data:
    this.state = GameState.WF_START;
    this.zombies = []; // the clients of zombie players
    this.humans = []; // the clients of human players
    this.crazyHumans = []; // humans being crazy
}

module.exports = ZTeam;
ZTeam.prototype = new Mode();

// Internal functions:
var createZColorFactor = function (client) {
    client.zColorFactor = (Math.random() * 256) >> 0;
    client.zColorIncr = true; // color will increase if TRUE - otherwise decrease.
};

var nextZColorFactor = function (client) {
    if (client.zColorIncr == true) {
        if (client.zColorFactor + 5 >= 255) {
            client.zColorFactor = 255;
            client.zColorIncr = false;
        }
        else {
            client.zColorFactor += 5;
        }
    }
    else {
        if (client.zColorFactor - 5 >= 0) {
            client.zColorFactor = 0;
            client.zColorIncr = true;
        }
        else {
            client.zColorFactor -= 5;
        }
    }
};

// Gamemode Specific Functions

ZTeam.prototype.turnToZombie = function (client) {
    client.team = 0; // team Z
    createZColorFactor(client);
    var zColor = { r: client.zColorFactor, g: client.zColorFactor, b: client.zColorFactor };
    for (var i = 0; i < client.cells.length; i++) {
        var cell = client.cells[i];
        cell.setColor(zColor);
    }
    this.zombies.push(client);
};

// Override

ZTeam.prototype.onTick = function (gameServer) {
    // Called on every game tick 
};

// ----------------------------------------------------------------------------
// Game mode entities:
// ZOMBIE CELL:
function Zombie() {

}

// HERO POISON CELL:
function Hero() {

}

// BRAIN CELL:
function Brain() {

}