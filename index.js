if (process.argv.length < 3) {
    console.log("Ogar - an open source Agar.io server implementation");
    console.log("Usage: %s %s [--master] [--game]", process.argv[0], process.argv[1]);
    console.log("    --master            Run the Agar master server.");
    console.log("    --game              Run the Agar game server.");
    console.log("You can use both options simultaneously to run both the master and game server.");
    return 1;
}

var runMaster = false;
var runGame = false;

process.argv.forEach(function(val) {
    if (val == "--master") {
        runMaster = true;
    } else if (val == "--game") {
        runGame = true;
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
    var game = new GameServer(443);
    game.start();
}
