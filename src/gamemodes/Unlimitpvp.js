var Mode = require('./Mode');

function Unlimitpvp() {
    Mode.apply(this, Array.prototype.slice.call(arguments));

    this.ID = 5;
    this.name = "Unlimitpvp";
    this.packetLB = 48;

    // Config (1 tick = 1000 ms)
    this.prepTime = 5; // Amount of ticks after the server fills up to wait until starting the game
    this.endTime = 15; // Amount of ticks after someone wins to restart the game
    this.autoFill = false;
    this.autoFillPlayers = 1;
    this.dcTime = 0;

    // Gamemode Specific Variables
    this.gamePhase = 0; // 0 = Waiting for players, 1 = Prepare to start, 2 = Game in progress, 3 = End
    this.contenders = [];
    this.maxContenders = 2;

    this.winner;
    this.timer;
    this.timeLimit = 3600; // in seconds
}




module.exports = Unlimitpvp;
Unlimitpvp.prototype = new Mode();

// Gamemode Specific Functions

Unlimitpvp.prototype.startGamePrep = function(gameServer) {
    this.gamePhase = 1;
    this.timer = this.prepTime;
    gameServer.config.playerRecombineTime = -1000;
    gameServer.config.playerMaxCells = 100000;
};

Unlimitpvp.prototype.startGame = function(gameServer) {
    gameServer.run = true;
    this.gamePhase = 2;
    this.getSpectate(); // Gets a random person to spectate
    gameServer.config.playerDisconnectTime = this.dcTime; // Reset config
};

Unlimitpvp.prototype.endGame = function(gameServer) {
    this.winner = this.contenders[0];
    this.gamePhase = 3;
    this.timer = 10; // 30 Seconds
};

Unlimitpvp.prototype.endGameTimeout = function(gameServer) {
    gameServer.run = false;
    this.gamePhase = 4;
    this.timer = 10; // 30 Seconds
};

Unlimitpvp.prototype.fillBots = function(gameServer) {
    // Fills the server with bots if there arent enough players
    var fill = this.maxContenders - this.contenders.length;
    for (var i = 0;i < fill;i++) {
        gameServer.bots.addBot();
    }
};

Unlimitpvp.prototype.getSpectate = function() {
    // Finds a random person to spectate
    var index = Math.floor(Math.random() * this.contenders.length);
    this.rankOne = this.contenders[index];
};

Unlimitpvp.prototype.prepare = function(gameServer) {
    // Remove all cells
    var len = gameServer.nodes.length;
    for (var i = 0; i < len; i++) {
        var node = gameServer.nodes[0];

        if (!node) {
            continue;
        }

        gameServer.removeNode(node);
    }

    gameServer.bots.loadNames();

    // Pauses the server
    gameServer.run = false;
    this.gamePhase = 0;

    // Get config values
    if (gameServer.config.tourneyAutoFill > 0) {
        this.timer = gameServer.config.tourneyAutoFill;
        this.autoFill = true;
        this.autoFillPlayers = gameServer.config.tourneyAutoFillPlayers;
    }
    // Handles disconnections
    this.dcTime = gameServer.config.playerDisconnectTime;
    gameServer.config.playerDisconnectTime = 0;
    gameServer.config.playerMinMassDecay = gameServer.config.playerStartMass;

    this.prepTime = gameServer.config.tourneyPrepTime;
    this.endTime = gameServer.config.tourneyEndTime;
    this.maxContenders = 2;

    // Time limit
    this.timeLimit = 600; // in seconds
};

Unlimitpvp.prototype.onPlayerDeath = function(gameServer) {
    // Nothing
}

Unlimitpvp.prototype.formatTime = function(time) {
    if (time < 0) {
        return "0:00";
    }
    // Format
    var min = Math.floor(this.timeLimit/60);
    var sec = this.timeLimit%60;
    sec = (sec > 9) ? sec : "0" + sec.toString() ; 
    return min+":"+sec;
}

// Override

Unlimitpvp.prototype.onServerInit = function(gameServer) {
    this.prepare(gameServer);
};

Unlimitpvp.prototype.onPlayerSpawn = function(gameServer,player) {
    // Only spawn players if the game hasnt started yet
    if ((this.gamePhase == 0) && (this.contenders.length < this.maxContenders)) {
        player.color = gameServer.getRandomColor(); // Random color
        this.contenders.push(player); // Add to contenders list
        gameServer.spawnPlayer(player);

        if (this.contenders.length == this.maxContenders) {
            // Start the game once there is enough players
            this.startGamePrep(gameServer);
        }
    }
};

Unlimitpvp.prototype.onCellRemove = function(cell) {
    var owner = cell.owner,
        human_just_died = false;

    if (owner.cells.length <= 0) {
        // Remove from contenders list
        var index = this.contenders.indexOf(owner);
        if (index != -1) {
            if ('_socket' in this.contenders[index].socket) {
                human_just_died = true;
            }
            this.contenders.splice(index,1);
        }

        // Victory conditions
        var humans = 0;
        for (var i = 0; i < this.contenders.length; i++) {
            if ('_socket' in this.contenders[i].socket) {
                humans++;
            }
        }

        // the game is over if:
        // 1) there is only 1 player left, OR
        // 2) all the humans are dead, OR
        // 3) the last-but-one human just died
        if ((this.contenders.length == 1 || humans == 0 || (humans == 1 && human_just_died)) && this.gamePhase == 2) {
            this.endGame(cell.owner.gameServer);
        } else {
            // Do stuff
            this.onPlayerDeath(cell.owner.gameServer);
        }
    }
};

Unlimitpvp.prototype.updateLB = function(gameServer) {
    var lb = gameServer.leaderboard;

    switch (this.gamePhase) {
        case 0:
            lb[0] = "Welcome to";
            lb[1] = "Andrews server,"
            lb[2] = "Waiting for";
            lb[3] = "players: ";
            lb[4] = this.contenders.length+"/"+this.maxContenders;
            if (this.autoFill) {
                if (this.timer <= 0) {
                    this.fillBots(gameServer);
                } else if (this.contenders.length >= this.autoFillPlayers) {
                    this.timer--;
                }
            }
            break;
        case 1:
            lb[0] = "Game starting in";
            lb[1] = this.timer.toString();
            lb[2] = "Good luck!";
            if (this.timer <= 0) {
                // Reset the game
                this.startGame(gameServer);
            } else {
                this.timer--;
            }
            break;
        case 2:
            lb[0] = "Players Remaining";
            lb[1] = this.contenders.length+"/"+this.maxContenders;
            lb[2] = "Time Limit:";
            lb[3] = this.formatTime(this.timeLimit);
            if (this.timeLimit < 0) {
                // Timed out
                this.endGameTimeout(gameServer);
            } else {
                this.timeLimit--;
            }
            break;
        case 3:
            lb[0] = "Congratulations";
            lb[1] = this.winner.getName();
            lb[2] = "for winning!";
            if (this.timer <= 0) {
                // Reset the game
                this.onServerInit(gameServer);
                // Respawn starting food
                gameServer.startingFood();
            } else {
                lb[3] = "Game restarting in";
                lb[4] = this.timer.toString();
                this.timer--;
            }
            break;
        case 4:
            lb[0] = "Time Limit"; 
            lb[1] = "Reached!";
            if (this.timer <= 0) {
                // Reset the game
                this.onServerInit(gameServer);
                // Respawn starting food
                gameServer.startingFood();
            } else {
                lb[2] = "Game restarting in";
                lb[3] = this.timer.toString();
                this.timer--;
            }
        default:
            break;
    }
};

