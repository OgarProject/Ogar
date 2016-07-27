var Mode = require('./Mode');

function FFA() {
    Mode.apply(this, Array.prototype.slice.call(arguments));

    this.ID = 0;
    this.name = "Free For All";
    this.specByLeaderboard = true;
}

module.exports = FFA;
FFA.prototype = new Mode();

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
            if (e.moveEngineTicks > 0) {
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
            startMass = Math.max(e.mass, gameServer.config.playerStartMass);

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
    var lb = gameServer.leaderboard;
    // Loop through all clients
    for (var i = 0; i < gameServer.clients.length; i++) {
        if (typeof gameServer.clients[i] == "undefined") {
            continue;
        }

        var player = gameServer.clients[i].playerTracker;
        if (player.disconnect > -1) continue; // Don't add disconnected players to list
        var playerScore = player.getScore(true);
        if (player.cells.length <= 0) {
            continue;
        }

        if (lb.length == 0) {
            // Initial player
            lb.push(player);
            continue;
        } else if (lb.length < gameServer.config.serverMaxLB) {
            this.leaderboardAddSort(player, lb);
        } else {
            // 10 in leaderboard already
            if (playerScore > lb[gameServer.config.serverMaxLB - 1].getScore(false)) {
                lb.pop();
                this.leaderboardAddSort(player, lb);
            }
        }
    }

    this.rankOne = lb[0];
}
