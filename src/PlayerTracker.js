var Packet = require('./packet');
var GameServer = require('./GameServer');

function PlayerTracker(gameServer, socket) {
    this.pID = -1;
    this.disconnect = -1; // Disconnection
    this.name = "";
    this.gameServer = gameServer;
    this.socket = socket;
    this.nodeAdditionQueue = [];
    this.nodeDestroyQueue = [];
    this.visibleNodes = [];
    this.cells = [];
    this.mergeOverride = false; // Triggered by console command
    this.mergeOverrideDuration = 0; // Make sure merge override isn't exploited
    this.score = 0; // Needed for leaderboard

    this.mouse = {
        x: 0,
        y: 0
    };
    this.mouseCells = []; // For individual cell movement
    this.tickLeaderboard = 0;
    this.tickViewBox = 0;

    this.team = 0;
    this.spectate = false;
    this.freeRoam = false; // Free-roam mode enables player to move in spectate mode

    // Anti-teaming
    this.massDecayMult = 1; // Anti-teaming multiplier
    this.Wmult = 0; // W press multiplier, which will also account on duration of effect
    this.checkForWMult = false; // Prevent oveload with W multiplier
    this.virusMult = 0; // Virus explosion multiplier
    this.splittingMult = 0; // Splitting multiplier

    // Viewing box
    this.sightRangeX = 0;
    this.sightRangeY = 0;
    this.centerPos = { // Center of map
        x: 3000,
        y: 3000
    };
    this.viewBox = {
        topY: 0,
        bottomY: 0,
        leftX: 0,
        rightX: 0,
        width: 0, // Half-width
        height: 0 // Half-height
    };

    // Scramble the coordinate system for anti-raga
    this.scrambleX = 0;
    this.scrambleY = 0;

    // Gamemode function
    if (gameServer) {
        // Find center
        this.centerPos.x = (gameServer.config.borderLeft - gameServer.config.borderRight) / 2;
        this.centerPos.y = (gameServer.config.borderTop - gameServer.config.borderBottom) / 2;
        // Player id
        this.pID = gameServer.getNewPlayerID();
        // Gamemode function
        gameServer.gameMode.onPlayerInit(this);
        // Only scramble if enabled in config
        if (gameServer.config.serverScrambleCoords == 1) {
            this.scrambleX = Math.floor((1 << 15) * Math.random());
            this.scrambleY = Math.floor((1 << 15) * Math.random());
        }
    }
}

module.exports = PlayerTracker;

// Setters/Getters

PlayerTracker.prototype.setName = function(name) {
    this.name = name;
};

PlayerTracker.prototype.getName = function() {
    return this.name;
};

PlayerTracker.prototype.getScore = function(reCalcScore) {
    if (reCalcScore) {
        var s = 0;
        for (var i = 0; i < this.cells.length; i++) {
            s += this.cells[i].mass;
            this.score = s;
        }
    }
    return this.score >> 0;
};

PlayerTracker.prototype.setColor = function(color) {
    this.color.r = color.r;
    this.color.b = color.b;
    this.color.g = color.g;
};

PlayerTracker.prototype.getTeam = function() {
    return this.team;
};

// Functions

PlayerTracker.prototype.update = function() {
    // Actions buffer (So that people cant spam packets)
    if (this.socket.packetHandler.pressSpace) { // Split cell
        this.gameServer.gameMode.pressSpace(this.gameServer, this);
        this.socket.packetHandler.pressSpace = false;
    }

    if (this.socket.packetHandler.pressW) { // Eject mass
        this.gameServer.gameMode.pressW(this.gameServer, this);
        this.socket.packetHandler.pressW = false;
        this.checkForWMult = true;
    }

    if (this.socket.packetHandler.pressQ) { // Q Press
        this.gameServer.gameMode.pressQ(this.gameServer, this);
        this.socket.packetHandler.pressQ = false;
    }

    var updateNodes = []; // Nodes that need to be updated via packet

    // Remove nodes from visible nodes if possible
    var d = 0;
    while (d < this.nodeDestroyQueue.length) {
        var index = this.visibleNodes.indexOf(this.nodeDestroyQueue[d]);
        if (index > -1) {
            this.visibleNodes.splice(index, 1);
            d++; // Increment
        } else {
            // Node was never visible anyways
            this.nodeDestroyQueue.splice(d, 1);
        }
    }

    // Get visible nodes every 400 ms
    var nonVisibleNodes = []; // Nodes that are not visible
    if (this.tickViewBox <= 0) {
        var newVisible = this.calcViewBox();
        try { // Add a try block in any case

            // Compare and destroy nodes that are not seen
            for (var i = 0; i < this.visibleNodes.length; i++) {
                var index = newVisible.indexOf(this.visibleNodes[i]);
                if (index == -1) {
                    // Not seen by the client anymore
                    nonVisibleNodes.push(this.visibleNodes[i]);
                }
            }

            // Add nodes to client's screen if client has not seen it already
            for (var i = 0; i < newVisible.length; i++) {
                var index = this.visibleNodes.indexOf(newVisible[i]);
                if (index == -1) {
                    updateNodes.push(newVisible[i]);
                }
            }
        } finally {} // Catch doesn't work for some reason

        this.visibleNodes = newVisible;
        // Reset Ticks
        this.tickViewBox = 2;
    } else {
        this.tickViewBox--;
        // Add nodes to screen
        for (var i = 0; i < this.nodeAdditionQueue.length; i++) {
            var node = this.nodeAdditionQueue[i];
            this.visibleNodes.push(node);
            updateNodes.push(node);
        }
    }

    // Update moving nodes
    for (var i = 0; i < this.visibleNodes.length; i++) {
        var node = this.visibleNodes[i];
        if (node.sendUpdate()) {
            // Sends an update if cell is moving
            updateNodes.push(node);
        }
    }

    // Send packet
    this.socket.sendPacket(new Packet.UpdateNodes(
        this.nodeDestroyQueue,
        updateNodes,
        nonVisibleNodes,
        this.scrambleX,
        this.scrambleY
    ));

    this.nodeDestroyQueue = []; // Reset destroy queue
    this.nodeAdditionQueue = []; // Reset addition queue

    // Update merge override
    if (this.mergeOverrideDuration > 0) {
        this.mergeOverrideDuration--;
        this.mergeOverride = true;
    } else this.mergeOverride = false;

    // Update leaderboard
    if (this.tickLeaderboard <= 0) {
        this.socket.sendPacket(this.gameServer.lb_packet);
        this.tickLeaderboard = 10; // 20 ticks = 1 second
    } else {
        this.tickLeaderboard--;
    }

    // Handles disconnections
    if (this.disconnect > -1) {
        // Player has disconnected... remove it when the timer hits -1
        this.disconnect--;
        if (this.disconnect == -1) {
            // Remove all client cells
            var len = this.cells.length;
            for (var i = 0; i < len; i++) {
                var cell = this.socket.playerTracker.cells[0];

                if (!cell) {
                    continue;
                }

                this.gameServer.removeNode(cell);
            }

            // Remove from client list
            var index = this.gameServer.clients.indexOf(this.socket);
            if (index != -1) {
                this.gameServer.clients.splice(index, 1);
            }
        }
    }
};

PlayerTracker.prototype.antiTeamTick = function() {
    // ANTI-TEAMING DECAY
    // Calculated even if anti-teaming is disabled.
    var effectSum = this.Wmult / 1.5 + this.virusMult + this.splittingMult;
    if (this.Wmult > 0) this.Wmult -= 0.0004;
    this.virusMult *= 0.998;
    this.splittingMult *= 0.9955;
    // Apply anti-teaming if required
    if (effectSum > 1) this.massDecayMult = Math.min(effectSum, 2.5);
    else this.massDecayMult = 1;
}

// Viewing box

PlayerTracker.prototype.updateSightRange = function() { // For view distance
    var totalSize = 1.0;
    var len = this.cells.length;

    for (var i = 0; i < len; i++) {
        if (!this.cells[i]) {
            continue;
        }

        totalSize += this.cells[i].getSize();
    }

    var factor = Math.pow(Math.min(64.0 / totalSize, 1), 0.4);
    this.sightRangeX = this.gameServer.config.serverViewBaseX / factor;
    this.sightRangeY = this.gameServer.config.serverViewBaseY / factor;
};

PlayerTracker.prototype.updateCenter = function() { // Get center of cells
    var len = this.cells.length;

    if (len <= 0) {
        return; // End the function if no cells exist
    }

    var X = 0;
    var Y = 0;
    for (var i = 0; i < len; i++) {
        if (!this.cells[i]) {
            continue;
        }

        X += this.cells[i].position.x;
        Y += this.cells[i].position.y;
    }

    this.centerPos.x = X / len;
    this.centerPos.y = Y / len;
};

PlayerTracker.prototype.calcViewBox = function() {
    if (this.spectate) {
        // Spectate mode
        return this.getSpectateNodes();
    }

    // Main function
    this.updateSightRange();
    this.updateCenter();

    // Box
    this.viewBox.topY = this.centerPos.y - this.sightRangeY;
    this.viewBox.bottomY = this.centerPos.y + this.sightRangeY;
    this.viewBox.leftX = this.centerPos.x - this.sightRangeX;
    this.viewBox.rightX = this.centerPos.x + this.sightRangeX;
    this.viewBox.width = this.sightRangeX;
    this.viewBox.height = this.sightRangeY;

    var newVisible = this.calcVisibleNodes();

    return newVisible;
};

PlayerTracker.prototype.getSpectateNodes = function() {
    var specPlayer = this.gameServer.largestClient;

    if (!this.freeRoam) {

        if (!specPlayer) return this.moveInFreeRoam(); // There are probably no players

        // Get spectate player's location and calculate zoom amount
        var specZoom = Math.sqrt(100 * specPlayer.score);
        specZoom = Math.pow(Math.min(40.5 / specZoom, 1.0), 0.4) * 0.6;

        this.setCenterPos(specPlayer.centerPos.x, specPlayer.centerPos.y);
        this.sendPosPacket(specZoom);

        return specPlayer.visibleNodes.slice(0);
    }
    // Behave like client is in free-roam as function didn't return nodes
    return this.moveInFreeRoam();
};

PlayerTracker.prototype.moveInFreeRoam = function() {
    // User is in free roam
    // To mimic agar.io, get distance from center to mouse and apply a part of the distance

    var dist = this.gameServer.getDist(this.mouse.x, this.mouse.y, this.centerPos.x, this.centerPos.y);
    var angle = this.getAngle(this.mouse.x, this.mouse.y, this.centerPos.x, this.centerPos.y);
    var speed = Math.min(dist / 10, 190); // Not to break laws of universe by going faster than light speed

    this.centerPos.x += speed * Math.sin(angle);
    this.centerPos.y += speed * Math.cos(angle);

    // Check if went away from borders
    this.checkBorderPass();

    // Now that we've updated center pos, get nearby cells
    // We're going to use config's view base times 2.5

    var mult = 2.5; // To simplify multiplier, in case this needs editing later on
    this.viewBox.topY = this.centerPos.y - this.gameServer.config.serverViewBaseY * mult;
    this.viewBox.bottomY = this.centerPos.y + this.gameServer.config.serverViewBaseY * mult;
    this.viewBox.leftX = this.centerPos.x - this.gameServer.config.serverViewBaseX * mult;
    this.viewBox.rightX = this.centerPos.x + this.gameServer.config.serverViewBaseX * mult;
    this.viewBox.width = this.gameServer.config.serverViewBaseX * mult;
    this.viewBox.height = this.gameServer.config.serverViewBaseY * mult;

    // Use calcViewBox's way of looking for nodes
    var newVisible = this.calcVisibleNodes();
    var specZoom = Math.sqrt(100 * 150);
    specZoom = Math.pow(Math.min(40.5 / 150, 1.0), 0.4) * 0.6; // Constant zoom
    this.sendPosPacket(specZoom);
    return newVisible;
};

PlayerTracker.prototype.calcVisibleNodes = function() {
    var newVisible = [];
    for (var i = 0; i < this.gameServer.nodes.length; i++) {
        node = this.gameServer.nodes[i];
        if (!node) {
            continue;
        }

        if (node.visibleCheck(this.viewBox, this.centerPos) || node.owner == this) {
            // Cell is in range of viewBox
            newVisible.push(node);
        }
    }
    return newVisible;
};

PlayerTracker.prototype.setCenterPos = function(x, y) {
    this.centerPos.x = x;
    this.centerPos.y = y;
    if (this.freeRoam) this.checkBorderPass();
};

PlayerTracker.prototype.checkBorderPass = function() {
    // A check while in free-roam mode to avoid player going into nothingness
    if (this.centerPos.x < this.gameServer.config.borderLeft) {
        this.centerPos.x = this.gameServer.config.borderLeft;
    }
    if (this.centerPos.x > this.gameServer.config.borderRight) {
        this.centerPos.x = this.gameServer.config.borderRight;
    }
    if (this.centerPos.y < this.gameServer.config.borderTop) {
        this.centerPos.y = this.gameServer.config.borderTop;
    }
    if (this.centerPos.y > this.gameServer.config.borderBottom) {
        this.centerPos.y = this.gameServer.config.borderBottom;
    }
};

PlayerTracker.prototype.sendPosPacket = function(specZoom) {
    // TODO: Send packet elsewhere so it is sent more often
    this.socket.sendPacket(new Packet.UpdatePosition(
        this.centerPos.x + this.scrambleX,
        this.centerPos.y + this.scrambleY,
        specZoom
    ));
};

PlayerTracker.prototype.sendCustomPosPacket = function(x, y, specZoom) {
    // TODO: Send packet elsewhere so it is sent more often
    this.socket.sendPacket(new Packet.UpdatePosition(
        x + this.scrambleX,
        y + this.scrambleY,
        specZoom
    ));
};

PlayerTracker.prototype.getAngle = function(x1, y1, x2, y2) {
    var deltaY = y1 - y2;
    var deltaX = x1 - x2;
    return Math.atan2(deltaX, deltaY);
};
