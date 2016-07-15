var Mode = require('./Mode');

function Zombie() {
    Mode.apply(this, Array.prototype.slice.call(arguments));
    
    this.ID = 12;
    this.name = "Zombie FFA";
    this.haveTeams = true;
    this.zombieColor = {
        'r': 223,
        'g': 223,
        'b': 223
    };
    this.zombies = [];
    this.players = [];
}

module.exports = Zombie;
Zombie.prototype = new Mode();

// Gamemode Specific Functions

Zombie.prototype.leaderboardAddSort = function (player, leaderboard) {
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

Zombie.prototype.makeZombie = function (player) {
    // turns a player into a zombie
    player.team = 0;
    player.setColor(this.zombieColor);
    for (var i = 0; i < player.cells.length; i++) {
        // remove cell from players array
        var index = this.players.indexOf(player.cells[i]);
        if (index != -1) {
            this.players.splice(index, 1);
        }
        // change color of cell
        player.cells[i].setColor(this.zombieColor);
        // add cell to zombie array
        this.zombies.push(player.cells[i]);
    }
};

// Override

Zombie.prototype.onPlayerSpawn = function (gameServer, player) {
    // make player a zombie if there are none
    if (this.zombies.length == 0) {
        player.team = 0;
        player.setColor(this.zombieColor);
    } else {
        // use player id as team so that bots are still able to fight (even though they probably turn into zombies very fast)
        player.team = player.pID;
        player.setColor(gameServer.getRandomColor());
    }
    
    // Spawn player
    gameServer.spawnPlayer(player);
};

Zombie.prototype.onCellAdd = function (cell) {
    // Add to team list
    if (cell.owner.getTeam() == 0) {
        this.zombies.push(cell);
    } else {
        this.players.push(cell);
    }
};

Zombie.prototype.onCellRemove = function (cell) {
    // Remove from team list
    if (cell.owner.getTeam() == 0) {
        var index = this.zombies.indexOf(cell);
        if (index != -1) {
            this.zombies.splice(index, 1);
        }
    } else {
        var index = this.players.indexOf(cell);
        if (index != -1) {
            this.players.splice(index, 1);
        }
    }
};

// TODO: remove it (move physics is managed by GameServer)
Zombie.prototype.onCellMove = function (x1, y1, cell) {
    var team = cell.owner.getTeam();
    var r = cell.getSize();
    
    // Find team
    for (var i = 0; i < cell.owner.visibleNodes.length; i++) {
        // Only collide with player cells
        var check = cell.owner.visibleNodes[i];
        
        if ((check.getType() != 0) || (cell.owner == check.owner)) {
            continue;
        }
        
        // Collision with zombies
        if (check.owner.getTeam() == team || check.owner.getTeam() == 0 || team == 0) {
            // Check if in collision range
            var collisionDist = check.getSize() + r; // Minimum distance between the 2 cells
            if (!cell.simpleCollide(x1, y1, check, collisionDist)) {
                // Skip
                continue;
            }
            
            // First collision check passed... now more precise checking
            dist = cell.getDist(cell.position.x, cell.position.y, check.position.x, check.position.y);
            
            // Calculations
            if (dist < collisionDist) { // Collided
                if (check.owner.getTeam() == 0 && team != 0) {
                    // turn player into zombie
                    this.makeZombie(cell.owner);
                } else if (team == 0 && check.owner.getTeam() != 0) {
                    // turn other player into zombie
                    this.makeZombie(check.owner);
                }
                // The moving cell pushes the colliding cell
                var newDeltaY = check.position.y - y1;
                var newDeltaX = check.position.x - x1;
                var newAngle = Math.atan2(newDeltaX, newDeltaY);
                
                var move = collisionDist - dist;
                
                check.setPosition({
                    x: check.position.x + (move * Math.sin(newAngle)) >> 0,
                    y: check.position.y + (move * Math.cos(newAngle)) >> 0
                });
            }
        }
    }
};

Zombie.prototype.updateLB = function (gameServer) {
    gameServer.leaderboardType = this.packetLB;
    var lb = gameServer.leaderboard;
    // Loop through all clients
    for (var i = 0; i < gameServer.clients.length; i++) {
        if (typeof gameServer.clients[i] == "undefined" || gameServer.clients[i].playerTracker.team == 0) {
            continue;
        }
        
        var player = gameServer.clients[i].playerTracker;
        var playerScore = player.getScore();
        if (player.cells.length <= 0) {
            continue;
        }
        
        if (lb.length == 0) {
            // Initial player
            lb.push(player);
            continue;
        } else if (lb.length < 10) {
            this.leaderboardAddSort(player, lb);
        } else {
            // 10 in leaderboard already
            if (playerScore > lb[9].getScore()) {
                lb.pop();
                this.leaderboardAddSort(player, lb);
            }
        }
    }
    
    this.rankOne = lb[0];
};
