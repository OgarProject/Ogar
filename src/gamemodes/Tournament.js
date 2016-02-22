var Mode = require('./Mode');

function Tournament() {
    Mode.apply(this, Array.prototype.slice.call(arguments));

    this.ID = 10;
    this.name = "Tournament";
    this.packetLB = 48;

    // Gamemode Specific Variables
    this.gamePhase = 0; // 0 = Waiting for players, 1 = Prepare to start, 2 = Game in progress, 3 = End

    this.fillTimerStarted = false;

    this.time = 0;
    this.winner;
    this.timer;
}

module.exports = Tournament;
Tournament.prototype = new Mode();

// Gamemode Specific Functions

Tournament.prototype.startGamePrep = function(gameServer) {
    gameServer.run = false;
    this.gamePhase = 1;
    this.timer = gameServer.config.tourneyPrepTime;
};

Tournament.prototype.startGame = function(gameServer) {
    gameServer.run = true;
    this.gamePhase = 2;
    this.timer = gameServer.config.tourneyTimeLimit * 60;
};

Tournament.prototype.endGame = function(gameServer) {
    gameServer.run = true;
    this.gamePhase = 3;
    this.timer = gameServer.config.tourneyEndTime;
};

Tournament.prototype.endGameTimeout = function(gameServer) {
    gameServer.run = false;
    this.gamePhase = 4;
    this.timer = gameServer.config.tourneyEndTime;
};

Tournament.prototype.fillBots = function(gameServer) {
    // Fills the server with bots if there arent enough players
    var fill = gameServer.config.tourneyMaxPlayers - this.contenders.length;
    for (var i = 0; i < fill; i++) {
        gameServer.bots.addBot();
    }
};

Tournament.prototype.kickBots = function(gameServer) {
    for (var i = 0; i < gameServer.clients.length; i++) {
        if (!gameServer.clients[i].remoteAddress) {
            gameServer.clients[i].playerTracker.socket.close();
            i--;
        }
    }
};

Tournament.prototype.onPlayerDeath = function(gameServer, player) {
    // Remove from contenders list
    var index = this.contenders.indexOf(player);
    if (index != -1)
        this.contenders.splice(index, 1);
    this.checkWinner(gameServer);
};

Tournament.prototype.checkWinner = function(gameServer) {
    var humans = gameServer.clients.filter(function(client) {
        return !!client.remoteAddress;
    }).length;
    if (humans <= 1) {
        this.winner = this.contenders[0];
        this.endGame(gameServer);
    }
}

Tournament.prototype.formatTime = function(time) {
    if (time < 0) {
        return "0:00";
    }
    // Format
    var min = Math.floor(time / 60);
    var sec = time % 60;
    sec = (sec > 9) ? sec : "0" + sec.toString();
    return min + ":" + sec;
};

// Override

Tournament.prototype.onServerInit = function(gameServer) {
    // Remove all cells
    var len = gameServer.nodes.length;
    for (var i = 0; i < len; i++) {
        var node = gameServer.nodes[0];

        if (!node) {
            continue;
        }

        gameServer.removeNode(node);
    }

    this.kickBots(gameServer);

    gameServer.bots.loadNames();

    this.contenders = [];

    // Pauses the server
    gameServer.run = false;
    this.gamePhase = 0;

    this.timer = 0;
    // Respawn starting food
    gameServer.startingFood();
};

Tournament.prototype.onPlayerSpawn = function(gameServer, player) {
    // Only spawn players if the game hasnt started yet
    if ((this.gamePhase == 0) && (this.contenders.length < gameServer.config.tourneyMaxPlayers)) {
        player.color = gameServer.getRandomColor(); // Random color
        this.contenders.push(player); // Add to contenders list
        gameServer.spawnPlayer(player);

        if (this.contenders.length == gameServer.config.tourneyMaxPlayers) {
            // Start the game once there is enough players
            this.startGamePrep(gameServer);
        }
    }
};

Tournament.prototype.onCellRemove = function(cell) {
    var owner = cell.owner;

    if (owner.cells.length <= 0)
        this.onPlayerDeath(owner.gameServer, owner);
};

Tournament.prototype.updateLB = function(gameServer) {
    this.timerTick();

    var lb = gameServer.leaderboard;

    switch (this.gamePhase) {
        case 0:
            lb[0] = "Waiting for";
            lb[1] = "players: ";
            lb[2] = this.contenders.length + "/" + gameServer.config.tourneyMaxPlayers;
            if (gameServer.config.tourneyAutoFill) {
                if (this.contenders.length >= gameServer.config.tourneyAutoFillPlayers) {
                    if (!this.fillTimerStarted) {
                        this.fillTimerStarted = true;
                        this.timer = gameServer.config.tourneyAutoFill;
                    }
                } else {
                    this.fillTimerStarted = false;
                }
                if (this.timer == 0 && this.fillTimerStarted) {
                    this.fillTimerStarted = false;
                    this.fillBots(gameServer);
                }
            }
            break;
        case 1:
            lb[0] = "Game starting in";
            lb[1] = this.timer.toString();
            lb[2] = "Good luck!";
            if (this.timer == 0) {
                // Reset the game
                this.startGame(gameServer);
            }
            break;
        case 2:
            lb[0] = "Players Remaining";
            lb[1] = this.contenders.length + "/" + gameServer.config.tourneyMaxPlayers;
            lb[2] = "Time Limit:";
            lb[3] = this.formatTime(this.timer);
            if (this.timer == 0) {
                // Timed out
                this.endGameTimeout(gameServer);
            }
            break;
        case 3:
            lb[0] = "Congratulations";
            lb[1] = this.winner.getName();
            lb[2] = "for winning!";
            if (this.timer == 0) {
                // Reset the game
                this.onServerInit(gameServer);
            } else {
                lb[3] = "Game restarting in";
                lb[4] = this.timer.toString();
            }
            break;
        case 4:
            lb[0] = "Time Limit";
            lb[1] = "Reached!";
            if (this.timer == 0) {
                // Reset the game
                this.onServerInit(gameServer);
            } else {
                lb[2] = "Game restarting in";
                lb[3] = this.timer.toString();
            }
        default:
            break;
    }
};

Tournament.prototype.timerTick = function(gameServer) {
    var newTime = Math.ceil(Number(new Date) / 1000);
    if (newTime > this.time && this.timer > 0) {
        this.timer--;
    }
    this.time = newTime;
}
