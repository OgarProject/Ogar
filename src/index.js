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
}

function parseCommands(str) {
    // Splits the string
    var split = str.split(" ");

    // Process the first string value
    var first = split[0].toLowerCase();
    switch (first) {
        case "addbot":
            var add = parseInt(split[1]);
            if (isNaN(add)) {
                add = 1; // Adds 1 bot if user doesnt specify a number
            }
		
            for (var i = 0; i < add; i++) {
                gameServer.bots.addBot();
            }
            console.log("[Console] Added "+add+" player bots");
            break;
        case "board":
            // Create new leaderboard
            var newLB = [];
            for (var i = 1; i < split.length; i++) {
                newLB[i - 1] = split[i];
            }
		
            // Clears the update leaderboard function and replaces it with our own
            gameServer.gameMode.packetLB = 48;
            gameServer.gameMode.updateLB = function(gameServer) {gameServer.leaderboard = newLB}; 
            console.log("[Console] Successfully changed leaderboard values");
            break;
        case "boardreset":
            // Gets the current gamemode
        	var gm = require('./gamemodes').get(gameServer.gameMode.ID);
            
            // Replace functions
            gameServer.gameMode.packetLB = gm.packetLB;
            gameServer.gameMode.updateLB = gm.updateLB; 
            console.log("[Console] Successfully reset leaderboard");
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
        case "color":
            // Validation checks
            var name = split[1];
            if (typeof name == 'undefined') {
                console.log("[Console] Please specify a valid name");
                break;
            }
			
            var color = {r: 0, g: 0, b: 0};
            color.r = Math.max(Math.min(parseInt(split[2]), 255), 0);
            color.g = Math.max(Math.min(parseInt(split[3]), 255), 0);
            color.b = Math.max(Math.min(parseInt(split[4]), 255), 0);
			
            // Sets color to the specified amount
            for (var i in gameServer.clients) {
                if (gameServer.clients[i].playerTracker.getName() == name) {
                    var client = gameServer.clients[i].playerTracker;
                    client.setColor(color); // Set color
                    for (var j in client.cells) {
                        client.cells[j].setColor(color);
                    }
                }
            }
            break;
        case "food":
            var pos = {x: parseInt(split[1]), y: parseInt(split[2])};
            var mass = parseInt(split[3]);
			 
            // Make sure the input values are numbers
            if (isNaN(pos.x) || isNaN(pos.y)) {
                console.log("[Console] Invalid coordinates");
                break;
            } if (isNaN(mass)) {
                mass = gameServer.config.foodStartMass;
            }
			
            // Spawn
            var f = new Entity.Food(gameServer.getNextNodeId(), null, pos, mass);
            f.setColor(gameServer.getRandomColor());
            gameServer.addNode(f);
            gameServer.currentFood++; 
            console.log("[Console] Spawned 1 food cell at ("+pos.x+" , "+pos.y+")");
            break;
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
		case "kill":
            var name = split[1];
			var action = function (cell) {gameServer.removeNode(cell)};
            if (typeof name == 'undefined') {
                console.log("[Console] Please specify a valid name");
                break;
        	}
			
			var count = 0;
            for (var i in gameServer.clients) {
                if (gameServer.clients[i].playerTracker.getName() == name) {
                    var client = gameServer.clients[i].playerTracker;
                    var len = client.cells.length;
                    for (var j = 0; j < len; j++) {
                        gameServer.removeNode(client.cells[0]);
                        count++;
                    }
                }
            }
            console.log("[Console] Removed " + count + " cells");
            break;
		case "killall":
            var count = 0;
            var len = gameServer.nodesPlayer.length;
            for (var i = 0; i < len; i++) {
                gameServer.removeNode(gameServer.nodesPlayer[0]);
				count++;
            }
			console.log("[Console] Removed " + count + " cells");
            break;
		case "mass":
            // Validation checks
            var name = split[1];
            if (typeof name == 'undefined') {
                console.log("[Console] Please specify a valid name");
                break;
            }
			
            var amount = Math.max(parseInt(split[2]),9);
            if (isNaN(amount)) {
                console.log("[Console] Please specify a valid number");
                break;
            }

            // Sets mass to the specified amount
            for (var i in gameServer.clients) {
                if (gameServer.clients[i].playerTracker.getName() == name) {
                    var client = gameServer.clients[i].playerTracker;
                    for (var j in client.cells) {
                        client.cells[j].mass = amount;
                    }
                }
            }
            break;
		case "playerlist":
			console.log("[Console] Showing "+gameServer.clients.length+" players: ");
			for (var i = 0; i < gameServer.clients.length; i++) {
				var client = gameServer.clients[i].playerTracker;
				
                // Get name
                var nick;
                if (client.spectate) {
                    nick = "SPECTATOR";
                } else {
                    nick = client.name;
                    if (nick == "") {
                        nick = "An unnamed cell";
                    }
                }
				
                // Output
                console.log("#"+(i+1)+"  Nick: "+nick+"  Cells: "+client.cells.length+"  Score: "+client.getScore()+"  Position: ("+client.centerPos.x+" , "+client.centerPos.y+")");
			}
            break;
        case "pause":
            gameServer.run = !gameServer.run; // Switches the pause state
            var s = gameServer.run ? "Unpaused" : "Paused";
            console.log("[Console] " + s + " the game.");
            break;
		case "status":
            console.log("[Console] Connected players: "+gameServer.clients.length+"/"+gameServer.config.serverMaxConnections);
            console.log("[Console] Current game mode is "+gameServer.gameMode.name);
            break;
		case "virus":
            var pos = {x: parseInt(split[1]), y: parseInt(split[2])};
            var mass = parseInt(split[3]);
			 
            // Make sure the input values are numbers
            if (isNaN(pos.x) || isNaN(pos.y)) {
                console.log("[Console] Invalid coordinates");
                break;
            } if (isNaN(mass)) {
                mass = gameServer.config.virusStartMass;
            }
			
            // Spawn
            var v = new Entity.Virus(gameServer.getNextNodeId(), null, pos, mass);
            gameServer.addNode(v);
            console.log("[Console] Spawned 1 virus at ("+pos.x+" , "+pos.y+")");
            break;
        default:
            console.log("[Console] Invalid Command!");
            break;
    }
}
