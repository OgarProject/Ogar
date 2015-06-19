// Imports
var Commands = require('./modules/CommandList');

// Init variables
var runMaster = false;
var runGame = true;
var showConsole = true;

var masterServer;
var gameServer;

process.argv.forEach(function(val) {
    if (val == "--master") {
        runMaster = true;
    } else if (val == "--game") {
        runGame = true;
    } else if (val == "--noconsole") {
        showConsole = false;
    } else if (val == "--help") {
        console.log("Proper Usage: %s [--master] [--game]", process.argv[0]);
        console.log("    --master            Run the Agar master server.");
        console.log("    --game              Run the Agar game server.");
        console.log("    --noconsole         Disables the console");
        console.log("    --help              Help menu.");
        console.log("");
        console.log("You can use both options simultaneously to run both the master and game server.");
        console.log("");
    }
});

if (runMaster) {
    // Initialize the master server
    MasterServer = require('./MasterServer');
    masterServer = new MasterServer(80);
    masterServer.start();
}

if (runGame) {
    // Initialize the game server
    GameServer = require('./GameServer');
    var gameServer = new GameServer();
    gameServer.start();
    // Add command handler
    gameServer.commands = Commands.list;
    // Initialize the server console
    if (showConsole) {
        var readline = require('readline');
        var in_ = readline.createInterface({ input: process.stdin, output: process.stdout });
        setTimeout(prompt, 100);
    }
}

// Console functions

function prompt() {
    in_.question(">", function(str) {
    	parseCommands(str);
        return prompt(); // Too lazy to learn async
    });	
};

function parseCommands(str) {
    // Splits the string
    var split = str.split(" ");

    // Process the first string value
    var first = split[0].toLowerCase();

    // Get command function
    var execute = gameServer.commands[first];
    if (typeof execute != 'undefined') {
        execute(gameServer,split);
    } else {
        console.log("[Console] Invalid Command!");
    }
};
