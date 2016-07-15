// TODO: fix this game mode has outdated code and probably will not works
var Mode = require('./Mode.js');
var Cell = require('../entity/Cell.js');
var Entity = require('../entity');
var Virus = require('../entity/Virus.js');

var GameServer = null; // represent GameServer Type
var GS_getRandomColor = null; // backup getRandomColor function of GameServer type
var GS_getNearestVirus = null;
var GS_getCellsInRange = null;
var GS_splitCells = null;
var GS_newCellVirused = null;
var Virus_onEaten = Virus.prototype.onEaten;

var GameState = {
    WF_PLAYERS: 0,
    WF_START: 1,
    IN_PROGRESS: 2
};

// new Cell Type IDs of HERO and BRAIN are calculated based on Game Mode ID
var CellType = {
    PLAYER: 0,
    FOOD: 1,
    VIRUS: 2,
    EJECTED_MASS: 3,
    HERO: 130,
    BRAIN: 131
};

var localLB = [];

function TeamZ() {
    Mode.apply(this, Array.prototype.slice.call(arguments));
    
    this.ID = 13;
    this.name = 'Zombie Team';
    this.packetLB = 48;
    this.haveTeams = true;
    
    // configurations:
    this.minPlayer = 2; // game is auto started if there are at least 2 players
    this.gameDuration = 18000; // ticks, 1 tick = 50 ms (20 ticks = 1 s)
    this.warmUpDuration = 600; // ticks, time to wait between games
    this.crazyDuration = 200; // ticks
    this.heroEffectDuration = 1000; // ticks
    this.brainEffectDuration = 200; // ticks
    this.spawnBrainInterval = 1200; // ticks
    this.spawnHeroInterval = 600; // ticks
    this.defaultColor = {
        r: 0x9b,
        g: 0x30,
        b: 0xff
    };
    
    this.colorFactorStep = 5;
    this.colorLower = 50; // Min 0
    this.colorUpper = 225; // Max 255
    this.maxBrain = -1; // set this param to any negative number to keep the number of brains not exceed number of humans
    this.maxHero = 4; // set this param to any negative number to keep the number of heroes not exceed number of zombies
    
    // game mode data:
    this.state = GameState.WF_PLAYERS;
    this.winTeam = -1;
    this.gameTimer = 0;
    this.zombies = []; // the clients of zombie players
    this.humans = []; // the clients of human players
    
    this.heroes = [];
    this.brains = [];
    
    this.spawnHeroTimer = 0;
    this.spawnBrainTimer = 0;
}

module.exports = TeamZ;
TeamZ.prototype = new Mode();

// Gamemode Specific Functions

TeamZ.prototype.createZColorFactor = function (client) {
    client.zColorFactor = (Math.random() * (this.colorUpper - this.colorLower + 1)) >> 0 + this.colorLower;
    client.zColorIncr = true; // color will be increased if TRUE - otherwise it will be decreased.
};

TeamZ.prototype.nextZColorFactor = function (client) {
    if (client.zColorIncr == true) {
        if (client.zColorFactor + this.colorFactorStep >= this.colorUpper) {
            client.zColorFactor = this.colorUpper;
            client.zColorIncr = false;
        } else {
            client.zColorFactor += this.colorFactorStep;
        }
    } else {
        if (client.zColorFactor - this.colorFactorStep <= this.colorLower) {
            client.zColorFactor = this.colorLower;
            client.zColorIncr = true;
        } else {
            client.zColorFactor -= this.colorFactorStep;
        }
    }
};

TeamZ.prototype.updateZColor = function (client, mask) {
    var color = {
        r: (mask & 0x4) > 0 ? client.zColorFactor : 7,
        g: (mask & 0x2) > 0 ? client.zColorFactor : 7,
        b: (mask & 0x1) > 0 ? client.zColorFactor : 7
    };
    client.setColor(color);
    for (var i = 0; i < client.cells.length; i++) {
        var cell = client.cells[i];
        cell.setColor(color);
    }
};

TeamZ.prototype.isCrazy = function (client) {
    return (typeof (client.crazyTimer) != 'undefined' && client.crazyTimer > 0 && client.team > 0);
};

TeamZ.prototype.hasEatenHero = function (client) {
    return (typeof (client.eatenHeroTimer) != 'undefined' && client.eatenHeroTimer > 0);
};

TeamZ.prototype.hasEatenBrain = function (client) {
    return (typeof (client.eatenBrainTimer) != 'undefined' && client.eatenBrainTimer > 0);
};

TeamZ.prototype.spawnDrug = function (gameServer, cell) { // spawn HERO or BRAIN
    var max = 0;
    var proceedNext = false;
    if (cell.getType() == CellType.HERO) {
        max = this.maxHero < 0 ? this.zombies.length : this.maxHero;
        proceedNext = this.heroes.length < max;
    } else if (cell.getType() == CellType.BRAIN) {
        max = this.maxBrain < 0 ? this.humans.length : this.maxBrain;
        proceedNext = this.brains.length < max;
    }
    if (proceedNext) {
        var pos = gameServer.getRandomPosition();
        
        // Check for players
        var size = cell.getSize();
        var bound = {
            minx: pos.x - size,
            miny: pos.y - size,
            maxx: pos.x + size,
            maxy: pos.y + size
        };
        if (gameServer.quadTree.any(bound, function (item) { return item.cell.cellType == 0; })) {
            // FAILED because of collision
            return false;
        }
        cell.setPosition(pos);
        gameServer.addNode(cell);
        return true; // SUCCESS with spawn
    }
    return true; // SUCCESS without spawn
};

// Call to change a human client to a zombie
TeamZ.prototype.turnToZombie = function (client) {
    client.team = 0; // team Z
    this.createZColorFactor(client);
    this.updateZColor(client, 0x7); // Gray
    
    // remove from human list
    var index = this.humans.indexOf(client);
    if (index >= 0) {
        this.humans.splice(index, 1);
    }
    
    // add to zombie list
    this.zombies.push(client);
};

TeamZ.prototype.boostSpeedCell = function (cell) {
    if (typeof cell.originalSpeed == 'undefined' || cell.originalSpeed == null) {
        cell.originalSpeed = cell.getSpeed;
        cell.getSpeed = function () {
            return 2 * this.originalSpeed();
        };
    }
};

TeamZ.prototype.boostSpeed = function (client) {
    for (var i = 0; i < client.cells.length; i++) {
        var cell = client.cells[i];
        if (typeof cell == 'undefined')
            continue;
        this.boostSpeedCell(cell);
    }
};

TeamZ.prototype.resetSpeedCell = function (cell) {
    if (typeof cell.originalSpeed != 'undefined' && cell.originalSpeed != null) {
        cell.getSpeed = cell.originalSpeed;
        cell.originalSpeed = null;
    }
};

TeamZ.prototype.resetSpeed = function (client) {
    for (var i = 0; i < client.cells.length; i++) {
        var cell = client.cells[i];
        if (typeof cell == 'undefined')
            continue;
        this.resetSpeedCell(cell);
    }
};

TeamZ.prototype.startGame = function (gameServer) {
    for (var i = 0; i < this.humans.length; i++) {
        var client = this.humans[i];
        client.team = client.pID;
        client.crazyTimer = 0;
        client.eatenHeroTimer = 0;
        client.eatenBrainTimer = 0;
        client.setColor(gameServer.getRandomColor());
        for (var j = 0; j < client.cells.length; j++) {
            var cell = client.cells[j];
            if (cell) {
                cell.setColor(client.getColor());
                cell.setSize(gameServer.config.playerMinSize);
                this.resetSpeedCell(cell);
            }
        }
    }
    
    // Select random human to be the zombie
    var zombie = this.humans[(Math.random() * this.humans.length) >> 0];
    this.turnToZombie(zombie);
    
    this.winTeam = -1;
    this.state = GameState.IN_PROGRESS;
    this.gameTimer = this.gameDuration;
};

TeamZ.prototype.endGame = function (gameServer) {
    // reset game
    for (var i = 0; i < this.zombies.length; i++) {
        var client = this.zombies[i];
        var index = this.humans.indexOf(client);
        if (index < 0) {
            this.humans.push(client);
        }
    }
    this.zombies = [];
    this.spawnHeroTimer = 0;
    this.spawnBrainTimer = 0;
    localLB = []; // reset leader board
    
    for (var i = 0; i < this.humans.length; i++) {
        var client = this.humans[i];
        client.color = this.defaultColor;
        client.team = 1;
        for (var j = 0; j < client.cells.length; j++) {
            var cell = client.cells[j];
            cell.setColor(this.defaultColor);
        }
    }
    
    this.state = GameState.WF_PLAYERS;
    this.gameTimer = 0;
};

TeamZ.prototype.leaderboardAddSort = function (player, leaderboard) {
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

TeamZ.prototype.onServerInit = function (gameServer) {
    // Called when the server starts
    gameServer.run = true;
    
    // Overwrite some server functions:
    GameServer = require('../GameServer.js');
    GS_getRandomColor = GameServer.prototype.getRandomColor; // backup
    GS_getNearestVirus = GameServer.prototype.getNearestVirus;
    GS_getCellsInRange = GameServer.prototype.getCellsInRange;
    GS_splitCells = GameServer.prototype.splitCells;
    GS_newCellVirused = GameServer.prototype.newCellVirused;
    
    //OVERWRITE GLOBAL FUNCTIONs to adapt Zombie Team mode
    
    GameServer.prototype.getRandomColor = function () {
        var colorRGB = [0xFF, 0x07, (Math.random() * 256) >> 0];
        colorRGB.sort(function () {
            return 0.5 - Math.random();
        });
        return {
            r: colorRGB[0],
            b: colorRGB[1],
            g: colorRGB[2]
        };
    };
    
    GameServer.prototype.getNearestVirus = function (cell) {
        // More like getNearbyVirus
        var virus = null;
        
        // loop through all heroes
        for (var i = 0; i < this.gameMode.heroes.length; i++) {
            var check = this.gameMode.heroes[i];
            if (typeof check === 'undefined') {
                continue;
            }
            if (this.checkCellCollision(cell, check) == null) {
                continue;
            }
            virus = check;
            break;
        }
        if (virus != null)
            return virus;
        
        // loop through all brains
        for (var i = 0; i < this.gameMode.brains.length; i++) {
            var check = this.gameMode.brains[i];
            if (typeof check === 'undefined') {
                continue;
            }
            if (this.checkCellCollision(cell, check) == null) {
                continue;
            }
            virus = check;
            break;
        }
        
        if (virus != null)
            return virus;
        
        // Call base:
        // Loop through all viruses on the map. There is probably a more efficient way of doing this but whatever
        var len = this.nodesVirus.length;
        for (var i = 0; i < len; i++) {
            var check = this.nodesVirus[i];
            
            if (typeof check === 'undefined') {
                continue;
            }
            
            if (this.checkCellCollision(cell, check) == null) {
                continue;
            }
            
            // Add to list of cells nearby
            virus = check;
            break; // stop checking when a virus found
        }
        return virus;
    };
    
    // this is almost same to the legacy function
    GameServer.prototype.getCellsInRange = function (cell) {
        var list = new Array();
        
        if (this.gameMode.state != GameState.IN_PROGRESS)
            return list;
        
        var squareR = cell.getSizeSquared(); // Get cell squared radius
        
        // Loop through all cells that are visible to the cell. There is probably a more efficient way of doing this but whatever
        var len = cell.owner.visibleNodes.length;
        for (var i = 0; i < len; i++) {
            var check = cell.owner.visibleNodes[i];
            
            if (typeof check === 'undefined') {
                continue;
            }
            
            // if something already collided with this cell, don't check for other collisions
            if (check.isRemoved) {
                continue;
            }
            
            // HERO and BRAIN checking
            if (cell.owner.getTeam() == 0) {
                // Z team
                if (check.getType() == CellType.HERO)
                    continue;
            } else {
                // H team
                if (check.getType() == CellType.BRAIN)
                    continue;
            }
            
            // Can't eat itself
            if (cell.nodeId == check.nodeId) {
                continue;
            }
            
            // Can't eat cells that have collision turned off
            if ((cell.owner == check.owner) && (cell.ignoreCollision)) {
                continue;
            }
            
            // AABB Collision
            if (gameServer.checkCellCollision(cell, check) == null) {
                continue;
            }
            
            // Cell type check - Cell must be bigger than this number times the mass of the cell being eaten
            var multiplier = 1.25;
            
            switch (check.getType()) {
                case 1:// Food cell
                    list.push(check);
                    check.isRemoved = true; // skip future collision checks for this food
                    continue;
                case 2:// Virus
                    multiplier = 1.33;
                    break;
                case 0:// Players
                    // Can't eat self if it's not time to recombine yet
                    if (check.owner == cell.owner) {
                        if (!cell.canRemrege() || !check.canRemerge()) {
                            continue;
                        }
                        
                        multiplier = 1.00;
                    }
                    
                    // Can't eat team members
                    if (this.gameMode.haveTeams) {
                        if (!check.owner) { // Error check
                            continue;
                        }
                        
                        if ((check.owner != cell.owner) && (check.owner.getTeam() == cell.owner.getTeam())) {
                            continue;
                        }
                    }
                    break;
                default:
                    break;
            }
            
            // Make sure the cell is big enough to be eaten.
            if ((check.getMass() * multiplier) > cell.getMass()) {
                continue;
            }
            
            // Eating range
            var xs = Math.pow(check.position.x - cell.position.x, 2);
            var ys = Math.pow(check.position.y - cell.position.y, 2);
            var dist = Math.sqrt(xs + ys);
            
            var eatingRange = cell.getSize() - check.getSize() / Math.PI; // Eating range = radius of eating cell + 40% of the radius of the cell being eaten
            if (dist > eatingRange) {
                // Not in eating range
                continue;
            }
            
            // Add to list of cells nearby
            list.push(check);
            
            // Something is about to eat this cell; no need to check for other collisions with it
            check.isRemoved = true;
        }
        return list;
    };
    
    // this is almost same to the legacy function
    GameServer.prototype.splitCells = function (client) {
        var len = client.cells.length;
        for (var i = 0; i < len; i++) {
            if (client.cells.length >= this.config.playerMaxCells) {
                // Player cell limit
                continue;
            }
            
            var cell = client.cells[i];
            if (!cell) {
                continue;
            }
            
            if (cell.getSize() < this.config.playerMinSplitSize) {
                continue;
            }
            
            // Get angle
            var deltaY = client.mouse.y - cell.position.y;
            var deltaX = client.mouse.x - cell.position.x;
            var angle = Math.atan2(deltaX, deltaY);
            
            // Get starting position
            var size = cell.getSize() / 2;
            var startPos = {
                x: cell.position.x + (size * Math.sin(angle)),
                y: cell.position.y + (size * Math.cos(angle))
            };
            // Calculate mass and speed of splitting cell
            var splitSpeed = cell.getSpeed() * 6;
            var newSize = cell.getSplitSize();
            cell.setSize(newSize);
            // Create cell
            var split = new Entity.PlayerCell(this, client, startPos, newSize);
            // TODO: check distance
            split.setBoost(splitSpeed * 32, angle);
            
            // boost speed if zombie eats brain
            if (this.gameMode.hasEatenBrain(client) || this.gameMode.isCrazy(client)) {
                this.gameMode.boostSpeedCell(split);
            }
            // gain effect if human eat hero
            else if (this.gameMode.hasEatenHero(client)) {
                // fix "unable to split" bug: cell can be merged after finish moving (2nd param in setMoveEngineData)
                //split.recombineTicks = 2; // main-ticks, 1 main-tick = 1 s
                //TODO: fix?
            }
            this.addNode(split);
        }
    };
    
    // this function is almost same to the legacy
    GameServer.prototype.newCellVirused = function (client, parent, angle, mass, speed) {
        // Starting position
        var startPos = {
            x: parent.position.x,
            y: parent.position.y
        };
        
        var size = Math.sqrt(mass);
        // Create cell
        newCell = new Entity.PlayerCell(this, client, startPos, size);
        // TODO: check distance
        newCell.setBoost(speed * 10, angle);
        //newCell.setAngle(angle);
        //newCell.setMoveEngineData(speed, 10);
        newCell.ignoreCollision = true; // Turn off collision
        
        // boost speed if zombie eats brain
        if (this.gameMode.hasEatenBrain(client) || this.gameMode.isCrazy(client)) {
            this.gameMode.boostSpeedCell(newCell);
        }
        // gain effect if human eat hero
        else if (this.gameMode.hasEatenHero(client)) {
            // fix "unable to split" bug
            //newCell.recombineTicks = 1;
            // TODO: fix?
        }
        
        // Add to moving cells list
        this.addNode(newCell);
    };
    
    Virus.prototype.onEaten = function (consumer) {
        var client = consumer.owner;
        var maxSplits = Math.floor(consumer.getMass() / 16) - 1; // Maximum amount of splits
        var numSplits = this.gameServer.config.playerMaxCells - client.cells.length; // Get number of splits
        numSplits = Math.min(numSplits, maxSplits);
        var splitMass = Math.min(consumer.getMass() / (numSplits + 1), 36); // Maximum size of new splits
        
        // Cell cannot split any further
        if (numSplits <= 0) {
            return;
        }
        
        // Big cells will split into cells larger than 36 mass (1/4 of their mass)
        var bigSplits = 0;
        var endMass = consumer.getMass() - (numSplits * splitMass);
        if ((endMass > 300) && (numSplits > 0)) {
            bigSplits++;
            numSplits--;
        }
        if ((endMass > 1200) && (numSplits > 0)) {
            bigSplits++;
            numSplits--;
        }
        if ((endMass > 3000) && (numSplits > 0)) {
            bigSplits++;
            numSplits--;
        }
        
        // Splitting
        var angle = 0; // Starting angle
        for (var k = 0; k < numSplits; k++) {
            angle += 6 / numSplits; // Get directions of splitting cells
            this.gameServer.newCellVirused(client, consumer, angle, splitMass, 150);
            consumer.setSize(Math.sqrt(consumer.getSize() * consumer.getSize() - splitMass * splitMass));
        }
        
        for (var k = 0; k < bigSplits; k++) {
            angle = Math.random() * 6.28; // Random directions
            splitMass = consumer.getMass() / 4;
            this.gameServer.newCellVirused(client, consumer, angle, splitMass, 20);
            consumer.setSize(Math.sqrt(consumer.getSize() * consumer.getSize() - splitMass * splitMass));
        }
        
        if (this.gameServer.gameMode.hasEatenHero(client)) {
            //consumer.recombineTicks = 0;
            // TODO: fix?
        }
    };
    
    // Handle "gamemode" command:
    for (var i = 0; i < this.gameServer.clients.length; i++) {
        var client = this.gameServer.clients[i].playerTracker;
        if (!client)
            continue;
        
        if (client.cells.length > 0) {
            client.eatenBrainTimer = 0;
            client.eatenHeroTimer = 0;
            client.crazyTimer = 0;
            client.setColor(this.defaultColor);
            client.team = 1;
            for (var j = 0; j < client.cells.length; j++) {
                var cell = client.cells[j];
                cell.setColor(this.defaultColor);
            }
            this.humans.push(client);
        }
    }
};

TeamZ.prototype.onChange = function (gameServer) {
    // Called when someone changes the gamemode via console commands
    // remove Brain and Hero
    for (var i = 0; this.brains.length; i++) {
        var node = this.brains[i];
        gameServer.removeNode(node);
    }
    for (var i = 0; this.heroes.length; i++) {
        var node = this.heroes[i];
        gameServer.removeNode(node);
    }
    
    // discard all boost:
    for (var i = 0; i < this.humans.length; i++) {
        var client = this.humans[i];
        if (this.isCrazy(client)) {
            this.resetSpeed(client);
        }
    }
    for (var i = 0; i < this.zombies.length; i++) {
        var client = this.zombies[i];
        if (this.hasEatenBrain(client)) {
            this.resetSpeed(client);
        }
    }
    
    // revert to default:
    GameServer.prototype.getRandomColor = GS_getRandomColor;
    GameServer.prototype.getNearestVirus = GS_getNearestVirus;
    GameServer.prototype.getCellsInRange = GS_getCellsInRange;
    GameServer.prototype.splitCells = GS_splitCells;
    GameServer.prototype.newCellVirused = GS_newCellVirused;
    Virus.prototype.onEaten = Virus_onEaten;
};

TeamZ.prototype.onTick = function (gameServer) {
    // Called on every game tick
    
    switch (this.state) {
        case GameState.WF_PLAYERS:
            if (this.humans.length >= this.minPlayer) {
                this.state = GameState.WF_START;
                this.gameTimer = this.warmUpDuration;
            }
            break;
        case GameState.WF_START:
            this.gameTimer--;
            if (this.gameTimer == 0) {
                if (this.humans.length >= this.minPlayer) {
                    // proceed:
                    this.startGame(gameServer);
                } else {
                    // back to previous state:
                    this.state = GameState.WF_PLAYERS;
                }
            }
            break;
        case GameState.IN_PROGRESS:
            this.gameTimer--;
            if (this.gameTimer == 0) {
                // human wins
                this.winTeam = 1;
            } else {
                if (this.humans.length == 0) { // no human left
                    // zombie wins
                    this.winTeam = 0;
                } else if (this.zombies.length == 0) { // no zombie left
                    // human wins
                    this.winTeam = 1;
                }
            }
            
            if (this.winTeam >= 0) {
                this.endGame(gameServer);
            }
            
            break;
    }
    
    // change color of zombies
    for (var i = 0; i < this.zombies.length; i++) {
        var client = this.zombies[i];
        this.nextZColorFactor(client);
        
        if (this.hasEatenBrain(client)) {
            client.eatenBrainTimer--;
            
            if (client.eatenBrainTimer > 0) {
                this.updateZColor(client, 0x5); // Pink
                continue;
            } else {
                // reset speed:
                this.resetSpeed(client);
            }
        }
        
        this.updateZColor(client, 0x7); // Gray
    }
    
    for (var i = 0; i < this.humans.length; i++) {
        var client = this.humans[i];
        if (this.isCrazy(client)) {
            client.crazyTimer--;
            if (client.crazyTimer == 0) {
                for (var j = 0; j < client.cells.length; j++) {
                    var cell = client.cells[j];
                    // reset speed:
                    this.resetSpeedCell(cell);
                    
                    // reset color:
                    if (client.cured == true)
                        cell.setColor(client.getColor());
                }
                
                if (client.cured == true) {
                    client.cured = false; // reset
                } else {
                    // turn player to zombie
                    this.turnToZombie(client);
                    continue;
                }
            } else {
                client.colorToggle++;
                if (client.colorToggle % 10 == 0) {
                    var blinkColor = null;
                    
                    if (client.colorToggle == 20) {
                        blinkColor = client.getColor();
                        client.colorToggle = 0;
                    } else {
                        if (client.cured == true) {
                            blinkColor = {
                                r: 255,
                                g: 255,
                                b: 7
                            }; // Yellow
                        } else {
                            blinkColor = {
                                r: 75,
                                g: 75,
                                b: 75
                            }; // Gray
                        }
                    }
                    
                    for (var j = 0; j < client.cells.length; j++) {
                        var cell = client.cells[j];
                        cell.setColor(blinkColor);
                    }
                }
            }
        } else if (this.hasEatenHero(client)) {
            client.eatenHeroTimer--;
            var color = null;
            if (client.eatenHeroTimer > 0) {
                client.heroColorFactor = (client.heroColorFactor + 5) % 401;
                if (client.heroColorFactor <= 200) {
                    color = {
                        r: 255,
                        g: 255,
                        b: client.heroColorFactor
                    }; // Yellow scheme
                } else {
                    color = {
                        r: 255,
                        g: 255,
                        b: 400 - client.heroColorFactor
                    }; // Yellow scheme
                }
            } else {
                color = client.getColor(); // reset
            }
            
            for (var j = 0; j < client.cells.length; j++) {
                var cell = client.cells[j];
                cell.setColor(color);
            }
        }
    }
    
    // check timer to spawn Hero:
    this.spawnHeroTimer++;
    if (this.spawnHeroTimer >= this.spawnHeroInterval) {
        this.spawnHeroTimer = 0;
        var cell = new Hero(gameServer.getNextNodeId(), null);
        while (!this.spawnDrug(gameServer, cell))        ; // collision detect algorithm needs enhancement
    }
    
    // check timer to spawn Brain:
    this.spawnBrainTimer++;
    if (this.spawnBrainTimer >= this.spawnBrainInterval) {
        this.spawnBrainTimer = 0;
        var cell = new Brain(gameServer.getNextNodeId(), null);
        while (!this.spawnDrug(gameServer, cell))        ; // collision detect algorithm needs enhancement
    }
};

TeamZ.prototype.onCellAdd = function (cell) {
    // Called when a player cell is added
    var client = cell.owner;
    if (client.cells.length == 1) { // first cell
        client.team = client.pID;
        client.setColor(cell.getColor());
        client.eatenBrainTimer = 0;
        client.eatenHeroTimer = 0;
        client.crazyTimer = 0;
        this.humans.push(client);
        
        if (this.state == GameState.IN_PROGRESS) {
            this.turnToZombie(client);
        } else {
            client.setColor(this.defaultColor);
            cell.setColor(this.defaultColor);
            client.team = 1; // game not started yet
        }
    }
};

TeamZ.prototype.onCellRemove = function (cell) {
    // Called when a player cell is removed
    var client = cell.owner;
    if (client.cells.length == 0) { // last cell
        if (client.getTeam() == 0) {
            // Z team
            var index = this.zombies.indexOf(client);
            if (index >= 0)
                this.zombies.splice(index, 1);
        } else {
            // H team
            var index = this.humans.indexOf(client);
            if (index >= 0)
                this.humans.splice(index, 1);
        }
    }
};

// TODO: remove it (move physics is managed by GameServer)
TeamZ.prototype.onCellMove = function (x1, y1, cell) {
    // Called when a player cell is moved
    var team = cell.owner.getTeam();
    var r = cell.getSize();
    
    // Find team
    for (var i = 0; i < cell.owner.visibleNodes.length; i++) {
        // Only collide with player cells
        var check = cell.owner.visibleNodes[i];
        
        if ((check.getType() != 0) || (cell.owner == check.owner)) {
            continue;
        }
        
        if ((this.hasEatenHero(check.owner)) || (this.hasEatenHero(cell.owner))) {
            continue;
        }
        
        // Collision with zombies
        if (check.owner.getTeam() == 0 || team == 0) {
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
                var crazyClient = null;
                if (check.owner.getTeam() == 0 && team != 0) {
                    crazyClient = cell.owner;
                } else if (team == 0 && check.owner.getTeam() != 0) {
                    crazyClient = check.owner;
                }
                
                if (crazyClient != null && !this.isCrazy(crazyClient)) {
                    crazyClient.crazyTimer = this.crazyDuration;
                    crazyClient.colorToggle = 0;
                    this.boostSpeed(crazyClient);
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

TeamZ.prototype.updateLB = function (gameServer) {
    gameServer.leaderboardType = this.packetLB;
    var lb = gameServer.leaderboard;
    
    if (this.winTeam == 0) {
        lb.push('ZOMBIE WINS');
        lb.push('_______________');
    } else if (this.winTeam > 0) {
        lb.push('HUMAN WINS');
        lb.push('_______________');
    }
    
    switch (this.state) {
        case GameState.WF_PLAYERS:
            lb.push('WAITING FOR');
            lb.push('PLAYERS...');
            lb.push(this.humans.length + '/' + this.minPlayer);
            break;
        case GameState.WF_START:
            lb.push('GAME STARTS IN:');
            var min = (this.gameTimer / 20 / 60) >> 0;
            var sec = ((this.gameTimer / 20) >> 0) % 60;
            lb.push((min < 10 ? '0' : '') + min + ':' + (sec < 10 ? '0' : '') + sec);
            break;
        case GameState.IN_PROGRESS:
            var min = (this.gameTimer / 20 / 60) >> 0;
            var sec = ((this.gameTimer / 20) >> 0) % 60;
            lb.push((min < 10 ? '0' : '') + min + ':' + (sec < 10 ? '0' : '') + sec);
            lb.push('HUMAN: ' + this.humans.length);
            lb.push('ZOMBIE: ' + this.zombies.length);
            lb.push('_______________');
            
            // Loop through all clients
            localLB = [];
            for (var i = 0; i < gameServer.clients.length; i++) {
                if (typeof gameServer.clients[i] == 'undefined' || gameServer.clients[i].playerTracker.team == 0) {
                    continue;
                }
                
                var player = gameServer.clients[i].playerTracker;
                if (player.cells.length <= 0) {
                    continue;
                }
                var playerScore = player.getScore();
                
                if (localLB.length == 0) {
                    // Initial player
                    localLB.push(player);
                    continue;
                } else if (localLB.length < 6) {
                    this.leaderboardAddSort(player, localLB);
                } else {
                    // 6 in leaderboard already
                    if (playerScore > localLB[5].getScore()) {
                        localLB.pop();
                        this.leaderboardAddSort(player, localLB);
                    }
                }
            }
            for (var i = 0; i < localLB.length && lb.length < 10; i++) {
                lb.push(localLB[i].getName());
            }
            
            break;
        default:
            lb.push('ERROR STATE');
            break;
    }

};

// ----------------------------------------------------------------------------
// Game mode entities:

// HERO POISON CELL:
function Hero() {
    Cell.apply(this, Array.prototype.slice.call(arguments));
    
    this.cellType = CellType.HERO;
    //this.isSpiked = true;
    this.setColor({ r: 255, g: 255, b: 7 });
    this.setSize(78);
}

Hero.prototype = new Cell();

Hero.prototype.getName = function () {
    return 'HERO';
};

Hero.prototype.calcMove = null;

Hero.prototype.onAdd = function (gameServer) {
    gameServer.gameMode.heroes.push(this);
};

Hero.prototype.onRemove = function (gameServer) {
    var index = gameServer.gameMode.heroes.indexOf(this);
    if (index != -1) {
        gameServer.gameMode.heroes.splice(index, 1);
    } else {
        console.log('[Warning] Tried to remove a non existing HERO node!');
    }
};

Hero.prototype.feed = function (feeder, gameServer) {
    gameServer.removeNode(feeder);
    
    // TODO: check distance
    this.setBoost(60 * 5, feeder.getAngle());
    //this.setAngle(feeder.getAngle());
    //this.moveEngineTicks = 5; // Amount of times to loop the movement function
    //this.moveEngineSpeed = 60;
    
    var index = gameServer.movingNodes.indexOf(this);
    if (index == -1) {
        gameServer.movingNodes.push(this);
    }
};

Hero.prototype.onEaten = function (consumer) {
    // Called when the cell is consumed
    var client = consumer.owner;
    
    // delicious
    
    if (this.gameServer.gameMode.isCrazy(client)) {
        // Neutralize the Zombie effect
        client.cured = true;
    } else {
        // Become a hero
        client.eatenHeroTimer = this.gameServer.gameMode.heroEffectDuration;
        client.heroColorFactor = 0;

        // Merge immediately
        //for (var i = 0; i < client.cells.length; i++) {
        //    var cell = client.cells[i];
        //    cell.recombineTicks = 0;
        //}
        // TODO: fix?

    }
};

// ----------------------------------------------------------------------------
// BRAIN CELL:
function Brain() {
    Cell.apply(this, Array.prototype.slice.call(arguments));
    
    this.cellType = CellType.BRAIN;
    //this.isSpiked = true;
    this.setColor({ r: 255, g: 7, b: 255 });
    this.setSize(78);
}

Brain.prototype = new Cell();

Brain.prototype.getName = function () {
    return 'BRAIN';
};

Brain.prototype.calcMove = null;

Brain.prototype.onAdd = function (gameServer) {
    gameServer.gameMode.brains.push(this);
};

Brain.prototype.onRemove = function (gameServer) {
    var index = gameServer.gameMode.brains.indexOf(this);
    if (index != -1) {
        gameServer.gameMode.brains.splice(index, 1);
    } else {
        console.log('[Warning] Tried to remove a non existing BRAIN node!');
    }
};

Brain.prototype.feed = function (feeder, gameServer) {
    gameServer.removeNode(feeder);
    
    // TODO: check distance
    this.setBoost(60 * 5, feeder.getAngle());
    //this.setAngle(feeder.getAngle());
    //this.moveEngineTicks = 5; // Amount of times to loop the movement function
    //this.moveEngineSpeed = 60;
    
    var index = gameServer.movingNodes.indexOf(this);
    if (index == -1) {
        gameServer.movingNodes.push(this);
    }
};

Brain.prototype.onEaten = function (consumer) {
    // Called when the cell is consumed
    var client = consumer.owner;
    
    // yummy!
    
    client.eatenBrainTimer = this.gameServer.gameMode.brainEffectDuration;
    
    // Boost speed
    this.gameServer.gameMode.boostSpeed(client);
};
