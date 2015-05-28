var GameMode = require('./gamemodes');

if (process.argv.length < 4) {
    console.log("Ogar - an open source Agar.io server implementation");
    console.log("Usage: %s %s [--master] [--game] [gamemode]", process.argv[0], process.argv[1]);
    console.log("    --master            Run the Agar master server.");
    console.log("    --game              Run the Agar game server.");
    console.log("");
    console.log("Gamemodes:");
    console.log("    0 : Free For All");
    console.log("    1 : Teams");
    console.log("");
    console.log("You can use both options simultaneously to run both the master and game server.");
    return 1;
}

var runMaster = false;
var runGame = false;
var mode;

process.argv.forEach(function(val) {
    if (val == "--master") {
        runMaster = true;
    } else if (val == "--game") {
        runGame = true;
    } 
    // Gamemodes
    if (val == 1) {
        mode = new GameMode.Teams();
    } else if (val == 2) {
        mode = new GameMode.Custom();
    } else {
    }
});

if (runMaster) {
    // Initialize the master server
    var MasterServer = require('./MasterServer');
    var master = new MasterServer(80);
    master.start();
}

if (runGame) {
    // Initialize the game server
    var GameServer = require('./GameServer');
    var game = new GameServer(443,mode);
    game.start();
}
