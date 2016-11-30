// Imports
var Commands = require('./modules/CommandList');
var GameServer = require('./GameServer');
var AsyncConsole = require('asyncconsole');
// Init variables
var showConsole = true;
// Start message
console.log("[Game] Ogar - An open source Agar.io server implementation");

// Handle arguments
process.argv.forEach(function(val) {
    if (val == "--noconsole") {
        showConsole = false;
    } else if (val == "--help") {
        console.log("Proper Usage: node index.js");
        console.log("    --noconsole         Disables the console");
        console.log("    --help              Help menu.");
        console.log("");
    }
});

var gameServer;
startServer();

function startServer() {
    gameServer = new GameServer();
    gameServer.start();

    // Add handles
    gameServer.shutdownHandle = function() {
        process.exit(0);
    };
    gameServer.restartHandle = function(timeout) {
        gameServer.restartScheduled = new Date();
        gameServer.restartAt = new Date(Date.now() + timeout);
        gameServer.restartId = setTimeout(function() {
                                   gameServer.socketServer.close();
                                   gameServer.httpServer.close();
                                   gameServer = null;
                                   if (global.gc) global.gc(); // Force garbage collection
                                   process.stdout.write("\u001b[2J\u001b[0;0H"); // Clear the console
                                   startServer();
                               }, timeout);
    };
}

// Initialize the server console
if (showConsole) {
    setTimeout(function() {
    var input = new AsyncConsole('> ',function(command) {
        parseCommands(command);
    })
    },200)
}

// Console functions


function parseCommands(str) {
    // Log the string
    gameServer.log.onCommand(str);

    // Don't process ENTER
    if (str === '')
        return;

    // Splits the string
    var split = str.split(" ");

    // Process the first string value
    var first = split[0].toLowerCase();

    gameServer.pluginHandler.executeCommand(first, split);
}
