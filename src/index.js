// Imports
var Entity = require('./entity');

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
    
    // Initialize the server console
    var readline = require('readline');
    var in_ = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (showConsole) {
        setTimeout(prompt, 100);
    }
}

// Console functions

function prompt() {
    in_.question(">", function(str) {
    	parseCommands(str);
    	prompt();
    });		
}

function parseCommands(str) {
	// Splits the string
    var split = str.split(" ");

    // Process the first string value
    switch (split[0]) {
        case "gamemode":
        	try {
        		var n = parseInt(split[1]);
        		gameServer.gameMode = require('./gamemodes').get(n);
        		gameServer.gameMode.onServerInit(gameServer); // Resets the server
        		console.log("[Game] Changed game mode to " + gameServer.gameMode.name);
        	} catch (e) {
        		console.log("[Console] Invalid game mode selected");
        	}
        	break;
        case "change":
            var key = split[1];
            var value = parseInt(split[2]);
            if (typeof gameServer.config[key] != 'undefined') {
                gameServer.config[key] = value;
                console.log("[Console] Set " + key + " to " + value);
            } else {
                console.log("[Console] Invalid config value");
            }
            break;
        case "setmass":
        	var name = split[1];
        	var amount = parseInt(split[2]);
        	
            for (var i in gameServer.clients) {
                if (gameServer.clients[i].playerTracker.getName() == name) {
                	var client = gameServer.clients[i].playerTracker;
                	for (var j in client.cells) {
                		client.cells[j].mass = Math.max(amount,9);
                	}
                }
            }
        	break;
        case "board":
        	var newLB = [];
        	for (var i = 1; i < split.length; i++) {
        		newLB[i - 1] = split[i];
        	}
        	gameServer.gameMode.packetLB = 48;
    		gameServer.gameMode.updateLB = function(gameServer) {gameServer.leaderboard = newLB}; // Clears the update leaderboard function
        	break;
        case "food":
        	if (typeof split[3] == 'undefined') {
        		split[3] = gameServer.config.foodStartMass;
        	}
        	try {
                var pos = {x: parseInt(split[1]), y: parseInt(split[2])};
                var f = new Entity.Food(gameServer.getNextNodeId(), null, pos, parseInt(split[3]));
                f.setColor(gameServer.getRandomColor());
                gameServer.addNode(f);
                gameServer.currentFood++; 
                console.log("[Console] Spawned 1 food cell at ( "+pos.x+" , "+pos.y+" )");
        	} catch (e) {
                console.log("[Console] Error proccessing that!");
        	}
        	break;
        case "virus":
        	if (typeof split[3] == 'undefined') {
        		split[3] = gameServer.config.virusStartMass;
        	}
        	try {
                var pos = {x: parseInt(split[1]), y: parseInt(split[2])};
                var v = new Entity.Virus(gameServer.getNextNodeId(), null, pos, parseInt(split[3]));
                gameServer.addNode(v);
                console.log("[Console] Spawned 1 virus at ( "+pos.x+" , "+pos.y+" )");
        	} catch (e) {
                console.log("[Console] Error proccessing that!");
        	}
        	break;
        case "pause":
            gameServer.run = !gameServer.run;
            var s = gameServer.run ? "Unpaused" : "Paused";
            console.log("[Console] " + s + " the game.");
            break;
        default:
        	console.log("[Console] Error proccessing that!");
        	break;
    }
}

