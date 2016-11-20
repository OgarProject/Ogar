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
    var leaderboard = [];

    // First off remove disconenected or spectating players
    var players = [];
    gameServer.clients.forEach(function(player) {
        if (!player) return;
        if (player.playerTracker.cells.length <= 0) return;
        if (player.playerTracker.disconnect > 0) return;
        players.push(player.playerTracker);
    });

    players.sort(function(a, b) {
        try {
            return b.getScore(true) - a.getScore(true);
        } catch (e) {
            return 0;
        }
    });

    leaderboard = players.slice(0, gameServer.config.serverMaxLB);

    this.rankOne = leaderboard[0];
    gameServer.leaderboard = leaderboard;
};
