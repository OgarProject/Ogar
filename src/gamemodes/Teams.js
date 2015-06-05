var Mode = require('./Mode');

function Teams() {
    Mode.apply(this, Array.prototype.slice.call(arguments));
	
    this.ID = 0;
    this.name = "Teams";
    this.decayMod = 1.5;
    this.packetLB = 50;
    this.haveTeams = true;
    
    // Special
    this.teamAmount = 3; // Amount of teams. Having more than 3 teams will cause the leaderboard to work incorrectly (client issue).
    this.colors = [{'r':245,'b':0,'g':0},{'r':0,'b':0,'g':245},{'r':0,'b':245,'g':0}]; // Make sure you add extra colors here if you wish to increase the team amount [Default colors are: Red, Green, Blue]
    this.nodes = []; // Teams
}

module.exports = Teams;
Teams.prototype = new Mode();

//Gamemode Specific Functions

Teams.prototype.getTeamColor = function(team) {
    var color = this.colors[team];
    return {
        r: color.r,
        b: color.b,
        g: color.g
    };
}

// Override

Teams.prototype.onServerInit = function(gameServer) {
	// Set up teams
    for (var i = 0; i < this.teamAmount; i++) {
        this.nodes[i] = [];
    }
}

Teams.prototype.onPlayerInit = function(player) {
	// Get random team
    player.team = Math.floor(Math.random() * this.teamAmount);
    player.color = this.getTeamColor(player.team);
}

Teams.prototype.onCellAdd = function(cell) {
    // Add to team list
    this.nodes[cell.owner.getTeam()].push(cell);
}

Teams.prototype.onCellRemove = function(cell) {
    // Remove from team list
    var index = this.nodes[cell.owner.getTeam()].indexOf(cell);
    if (index != -1) {
        this.nodes[cell.owner.getTeam()].splice(index, 1);
    }
}

Teams.prototype.updateLB = function(gameServer) {
	var total = 0;
    var teamMass = [];
    // Get mass
    for (var i = 0; i < this.teamAmount; i++) {
        // Set starting mass
        teamMass[i] = 0;
		
        // Loop through cells
        for (var j = 0; j < this.nodes[i].length;j++) {
            var cell = this.nodes[i][j];
			
            if (!cell) {
                continue;
            }
			
            teamMass[i] += cell.mass;
            total += cell.mass;
        }
    }
    // Calc percentage
    for (var i = 0; i < this.teamAmount; i++) {
        // No players
        if (total <= 0) {
            continue;
        }
    	
        gameServer.leaderboard[i] = teamMass[i]/total;
    }
}

