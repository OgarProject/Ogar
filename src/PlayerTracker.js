var Packet = require('./packet');
var Vector = require('./modules/Vector');

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
    this.score = 0; // Needed for leaderboard

    this.mouse = {
        x: 0,
        y: 0
    };
    this.ignoreNextMoveTick = false; // Screen mouse matches old screen mouse
    this.mouseCells = []; // For individual cell movement
    this.tickLeaderboard = 0;
    this.tickViewBox = 0;
    
    this.mapUpdate = 0;  // Map update
    this.cellUpdate = 0; // Owned cell update

    this.team = 0;
    this.spectate = false;
    this.freeRoam = false; // Free-roam mode enables player to move in spectate mode

    // Anti-teaming
    this.checkForWMult = false; // Prevent oveload with W multiplier
    this.massDecayMult = 1; // Anti-teaming multiplier

    this.massLossMult = 0; // When mass is lost, it applies here
    this.massGainMult = 0; // When mass is gained, it applies here

    // Scramble the coordinate system for anti-raga
    this.scrambleX = 0;
    this.scrambleY = 0;

    // Gamemode function
    if (gameServer) {
        // Find center
        this.centerPos = new Vector(
            (gameServer.config.borderLeft - gameServer.config.borderRight) / 2,
            (gameServer.config.borderTop - gameServer.config.borderBottom) / 2
        );
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
            if (!this.cells[i]) return; // Error
            s += this.cells[i].mass;
            this.score = s;
        }
    }
    return this.score >> 0;
};

PlayerTracker.prototype.getSizes = function() {
    var s = 0;
    for (var i = 0; i < this.cells.length; i++) {
        if (!this.cells[i]) return; // Error
        s += this.cells[i].getSize();
    }
    return s;
};

PlayerTracker.prototype.setColor = function(color) {
    this.color.r = color.r;
    this.color.g = color.g;
    this.color.b = color.b;
};

PlayerTracker.prototype.getTeam = function() {
    return this.team;
};

// Functions

PlayerTracker.prototype.update = function() {
    // Don't send any messages if client didn't respond with protocol version
    if (this.socket.packetHandler.protocolVersion == 0) return;
    
    // Actions buffer (So that people cant spam packets)
    if (this.socket.packetHandler.pressSpace) { // Split cell
        if (!this.mergeOverride) this.gameServer.gameMode.pressSpace(this.gameServer, this);
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
        var newVisible = this.viewReset();
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
        } catch(err) {
            console.error(err);
        }
    
        this.visibleNodes = newVisible;
        // Reset Ticks
        this.tickViewBox = 0;
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
    
    // Update leaderboard
    if (this.tickLeaderboard <= 0) {
        this.socket.sendPacket(new Packet.UpdateLeaderboard(
            this.gameServer.leaderboard,
            this.gameServer.gameMode.packetLB,
            this.protocolVersion,
            this.pID
        ));
        this.tickLeaderboard = 10; // 20 ticks = 1 second
    } else {
        this.tickLeaderboard--;
    }
    
    //var box = this.getBox();
    /*
    if (this.cells.length == 0 && this.gameServer.config.serverScrambleMinimaps >= 1) {
        // Update map, it may have changed
        this.socket.sendPacket(new Packet.SetBorder(
        this.gameServer.config.borderLeft + this.scrambleX,
            this.gameServer.config.borderRight + this.scrambleX,
            this.gameServer.config.borderTop + this.scrambleY,
            this.gameServer.config.borderBottom + this.scrambleY
        ));
    } else {
        // Send a border packet to fake the map size
        this.socket.sendPacket(new Packet.SetBorder(
            Math.max(this.centerPos.x + this.scrambleX - box.width, this.gameServer.config.borderLeft + this.scrambleX),
            Math.min(this.centerPos.x + this.scrambleX + box.width, this.gameServer.config.borderRight + this.scrambleX),
            Math.max(this.centerPos.y + this.scrambleY - box.height, this.gameServer.config.borderTop + this.scrambleY),
            Math.min(this.centerPos.y + this.scrambleY + box.height, this.gameServer.config.borderBottom + this.scrambleY)
        ));
    }*/
    
    // Handles disconnections
    if (this.disconnect > -1) {
        // Player has disconnected... remove it when the timer hits -1
        this.disconnect--;
        // Also remove it when its cells are completely eaten not to back up dead clients
        if (this.disconnect == -1 || this.cells.length == 0) {
            // Remove all client cells
            var len = this.cells.length;
            
            for (var i = 0; i < len; i++) {
                var cell = this.cells[i];
                if (!cell) continue;

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

PlayerTracker.prototype.getAntiteamMult = function() {
    return Math.min((this.massLossMult + this.massGainMult) / (this.getScore(true) / 2), 2);
};

PlayerTracker.prototype.antiTeamTick = function() {
    // ANTI-TEAMING DECAY
    // Calculated even if anti-teaming is disabled.
    this.massLossMult *= 0.997;
    this.massGainMult *= 0.997;
    var div = this.getAntiteamMult();
    if (div > 1) this.massDecayMult = div;
};

PlayerTracker.prototype.applyTeaming = function(n, type) {
    // Called when player does an action which increases anti-teaming
    switch (type) {
        case -1: // Loss
            this.massLossMult += n * (0.5 + this.getAntiteamMult());
            break;
        case 1: // Gain
            this.massGainMult += n * (0.5 + this.getAntiteamMult());
            break;
    }
};

// Viewing box

PlayerTracker.prototype.getBox = function() { // For view distance
    var totalSize = this.getSizes();
    var scale = Math.sqrt(totalSize) / Math.log(totalSize);
    var w = this.gameServer.config.serverViewBaseX * scale,
        h = this.gameServer.config.serverViewBaseY * scale;
    
    return {
        width: w,
        height: h,
        top: this.centerPos.y - h,
        bottom: this.centerPos.y + h,
        left: this.centerPos.x + w,
        right: this.centerPos.x - w
    };
};

PlayerTracker.prototype.updateCenter = function() { // Get center of cells
    var len = this.cells.length;

    if (len <= 0) return;

    var X = 0;
    var Y = 0;
    for (var i = 0; i < len; i++) {
        // Error check
        if (!this.cells[i]) {
            len--;
            continue;
        }
        var cell = this.cells[i];

        X += cell.position.x;
        Y += cell.position.y;
    }

    this.centerPos = new Vector(X / len, Y / len);
};

PlayerTracker.prototype.viewReset = function() {
    if (this.spectate) {
        // Spectate mode
        return this.getSpectateNodes();
    }

    // Update center
    this.updateCenter();

    // Box
    var box = this.getBox();
    var newVisible = this.calcVisibleNodes(box);

    return newVisible;
};

PlayerTracker.prototype.getSpectateNodes = function() {
    if (!this.freeRoam) {
        var specPlayer = this.gameServer.largestClient;
        if (!specPlayer) return this.moveInFreeRoam(); // There are probably no players

        // Get spectate player's location and calculate zoom amount
        var specZoom = Math.pow(Math.log(specPlayer.getScore(false)), -0.5);

        this.setCenterPos(specPlayer.centerPos.x, specPlayer.centerPos.y);
        this.sendPosPacket(specZoom);

        return specPlayer.visibleNodes.slice(0);
    }
    // Behave like client is in free-roam as function didn't return nodes
    return this.moveInFreeRoam();
};

PlayerTracker.prototype.moveInFreeRoam = function() {
    // Player is in free roam
    
    var dist = this.centerPos.distanceTo(this.mouse);
    var angle = this.centerPos.angleTo(this.mouse);
    var speed = Math.min(dist / 10, 30); // Not to break laws of universe by going faster than light speed

    this.centerPos.sub(
        Math.sin(angle) * speed,
        Math.cos(angle) * speed
    );
    
    // Check if went away from borders
    this.checkBorderPass();

    // Now that we've updated center pos, get nearby cells
    var mult = 2.5;
    var baseX = this.gameServer.config.serverViewBaseX * mult;
    var baseY = this.gameServer.config.serverViewBaseY * mult;

    // Use calcVisibleNodes's way of looking for nodes
    var newVisible = this.calcVisibleNodes({
        width: baseX,
        height: baseY,
        top: this.centerPos.y - baseY,
        bottom: this.centerPos.y + baseY,
        left: this.centerPos.x - baseX,
        right: this.centerPos.x + baseX
    });
    this.sendPosPacket(0.5199);
    return newVisible;
};

PlayerTracker.prototype.calcVisibleNodes = function(box) {
    var newVisible = [];
    for (var i = 0; i < this.gameServer.nodes.length; i++) {
        var node = this.gameServer.nodes[i];
        if (!node) {
            continue;
        }

        var check = node.visibleCheck(box, this.centerPos);
        if (check || node.owner == this) {
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
    this.socket.sendPacket(new Packet.UpdatePosition(
        this.centerPos.x + this.scrambleX,
        this.centerPos.y + this.scrambleY,
        specZoom
    ));
};

PlayerTracker.prototype.sendCustomPosPacket = function(x, y, specZoom) {
    this.socket.sendPacket(new Packet.UpdatePosition(
        x + this.scrambleX,
        y + this.scrambleY,
        specZoom
    ));
};
