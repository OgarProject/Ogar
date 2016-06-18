var Mode = require('./Mode');

function FFA() {
    Mode.apply(this, Array.prototype.slice.call(arguments));

    this.ID = 0;
    this.name = "Free For All";
    this.specByLeaderboard = true;
}

module.exports = FFA;
FFA.prototype = new Mode();

// Gamemode Specific Functions

FFA.prototype.leaderboardAddSort = function(player, leaderboard) {
    // Adds the player and sorts the leaderboard
    var len = leaderboard.length - 1;
    var loop = true;
    while ((len >= 0) && (loop)) {
        // Start from the bottom of the leaderboard
        if (player.getScore() <= leaderboard[len].getScore()) {
            leaderboard.splice(len + 1, 0, player);
            loop = false; // End the loop if a spot is found
        }
        len--;
    }
    if (loop) {
        // Add to top of the list because no spots were found
        leaderboard.splice(0, 0, player);
    }
};

// Override

FFA.prototype.onPlayerSpawn = function(gameServer, player) {
    // Random color
    player.color = gameServer.getRandomColor();

    // Set up variables
    var pos, startMass;

    // Check if there are ejected mass in the world.
    if (gameServer.nodesEjected.length > 0) {
        var index = Math.floor(Math.random() * 100) + 1;
        if (index >= gameServer.config.ejectSpawnPlayer) {
            // Get ejected cell
            index = Math.floor(Math.random() * gameServer.nodesEjected.length);
            var e = gameServer.nodesEjected[index];
            if (e.boostDistance > 0) {
                // Ejected cell is currently moving
                gameServer.spawnPlayer(player, pos, startMass);
            }

            // Remove ejected mass
            gameServer.removeNode(e);

            // Inherit
            pos = {
                x: e.position.x,
                y: e.position.y
            };
            startMass = Math.max(e.getMass(), gameServer.config.playerStartMass);

            var color = e.getColor();
            player.setColor({
                'r': color.r,
                'g': color.g,
                'b': color.b
            });
        }
    }

    // Spawn player
    gameServer.spawnPlayer(player, pos, startMass);
};

FFA.prototype.updateLB = function(gameServer) {
    gameServer.leaderboardType = this.packetLB;
    var lb = gameServer.leaderboard;
    // Loop through all clients
    for (var i = 0; i < gameServer.clients.length; i++) {
        var client = gameServer.clients[i];
        if (client == null) continue;

        var player = client.playerTracker;
        if (player.isRemoved)
            continue; // Don't add disconnected players to list
        
        var playerScore = player.getScore();
        
        if (player.cells.length <= 0)
            continue;

        if (lb.length == 0) {
            // Initial player
            lb.push(player);
            continue;
        } else if (lb.length < gameServer.config.serverMaxLB) {
            this.leaderboardAddSort(player, lb);
        } else {
            // 10 in leaderboard already
            if (playerScore > lb[gameServer.config.serverMaxLB - 1].getScore()) {
                lb.pop();
                this.leaderboardAddSort(player, lb);
            }
        }
    }

    this.rankOne = lb[0];
}
