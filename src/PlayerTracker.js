var Packet = require('./packet');
var Vector = require('./modules/Vector');
var Rectangle = require('./modules/Rectangle');

function getTime(a) {
    return a[0] * 1000 + a[1] / 1000000;
}

function PlayerTracker(gameServer, socket) {
    this.pID = -1;
    this.disconnect = -1; // Disconnection
    this.fullyDisconnected = false;
    this.name = "";
    this.gameServer = gameServer;
    this.socket = socket;

    this.nodeAdditionQueue = [];
    this.nodeDestroyQueue = [];
    this.visibleNodes = [];

    this.cells = [];
    this.mergeOverride = false; // Triggered by console command
    this.score = 0; // Needed for leaderboard

    this.mouse = new Vector(0, 0);
    this.centerPos = new Vector(0, 0);
    this.lastEject = new Date();
    this.tickLeaderboard = 0;
    this.tickViewBox = 0;
    this.viewScale = 1;

    this.team = 0;
    this.spectate = false;
    this.freeRoam = false; // Free-roam mode enables player to move in spectate mode

    // Anti-teaming
    this.checkForWMult = false; // Prevent oveload with W multiplier
    this.massDecayMult = 1; // Anti-teaming multiplier

    this.massLossMult = 0; // When mass is lost, it applies here
    this.massGainMult = 0; // When mass is gained, it applies here

    // Scramble systems
    this.scrambleX = 0;
    this.scrambleY = 0;
    this.scrambleID = 0;
    this.scrambleColor = {
        from: -1,
        to: -1
    };

    // Gamemode function
    if (gameServer) {
        // Player id
        this.pID = gameServer.getNewPlayerID();
        // Gamemode function
        gameServer.gameMode.onPlayerInit(this);
        this.resetScramble();
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

PlayerTracker.prototype.resetScramble = function() {
    if (this.gameServer.config.scrambleCoords >= 1) {
        this.scrambleX = Math.floor((1 << 15) * (Math.random() - 0.5) * 2);
        this.scrambleY = Math.floor((1 << 15) * (Math.random() - 0.5) * 2);
    } else {
        this.scrambleX = 0;
        this.scrambleY = 0;
    }
    if (this.gameServer.config.scrambleIDs >= 1) this.scrambleID = Math.random() * 2147483648 >> 0;
    else this.scrambleID = 0;
    if (this.gameServer.config.scrambleColors >= 1) this.scrambleColor = {
            from: Math.random() * 3 >> 0,
            to: Math.random() * 3 >> 0
        };
    else this.scrambleColor = {
            from: -1,
            to: -1
        };
};

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
    var nonVisibleNodes = []; // Nodes that are not visible anymore

    // Update & remove nodes if necessary
    for (var i = 0; i < this.nodeAdditionQueue.length; i++) {
        if (!(this.getBox().intersects(this.nodeAdditionQueue[i].getRange()))) continue;
        this.visibleNodes.push(this.nodeAdditionQueue[i]);
        updateNodes.push(this.nodeAdditionQueue[i]);
    }
    for (var i = 0; i < this.nodeDestroyQueue.length; i++) {
        if (this.visibleNodes.indexOf(this.nodeDestroyQueue[i]) == -1) continue; // Wasn't visible anyway
        this.visibleNodes.remove(this.nodeDestroyQueue[i]);
        nonVisibleNodes.push(this.nodeDestroyQueue[i]);
    }

    // Reset view range every 200ms
    if (this.tickViewBox <= 0) {
        var newNodes = this.viewReset(),
            currentNodes = this.visibleNodes;

        // Compare newly visible nodes to currently visible
        for (var i = 0; i < newNodes.length; i++) {
            var index = currentNodes.indexOf(newNodes[i]);
            if (index == -1)
                // New visible node
                updateNodes.push(newNodes[i]);
        }

        // Compare currently visible nodes to newly visible
        for (var i = 0; i < currentNodes.length; i++) {
            var index = newNodes.indexOf(currentNodes[i]);
            if (index == -1)
                // Not visible anymore
                nonVisibleNodes.push(currentNodes[i]);
        }

        this.visibleNodes = newNodes;
        if (this.spectate) this.tickViewBox = 2;
        else this.tickViewBox = 5;
    } else {
        this.tickViewBox--;
    }

    // Check currently visible nodes for updating
    for (var i = 0; i < this.visibleNodes.length; i++) {
        if (!this.visibleNodes[i]) continue;
        // Don't check for update if it's going to be updated
        if (updateNodes.indexOf(this.visibleNodes[i]) == -1 &&
            this.visibleNodes[i].sendUpdate()) updateNodes.push(this.visibleNodes[i]);
    }

    // Send packet
    this.socket.sendPacket(new Packet.UpdateNodes(
        updateNodes,
        nonVisibleNodes,
        this,
        this.socket.packetHandler.protocolVersion
    ));

    this.nodeDestroyQueue = []; // Reset destroy queue
    this.nodeAdditionQueue = []; // Reset addition queue

    // Update leaderboard
    if (this.gameServer.tickLB == 5)
        this.socket.sendPacket(new Packet.UpdateLeaderboard(
            this.gameServer.leaderboard,
            this.gameServer.gameMode.packetLB,
            this.socket.packetHandler.protocolVersion,
            this.pID
        ));

    var box = this.getBox().getBounds();

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
            Math.min(box.left + this.scrambleX, this.gameServer.config.borderLeft + this.scrambleX),
            Math.max(box.right + this.scrambleX, this.gameServer.config.borderRight + this.scrambleX),
            Math.min(box.top + this.scrambleY, this.gameServer.config.borderTop + this.scrambleY),
            Math.max(box.bottom + this.scrambleY, this.gameServer.config.borderBottom + this.scrambleY)
        ));
    }

    // Handles disconnections
    if (this.disconnect > -1) {
        // Player has disconnected... remove it when the timer hits -1
        this.disconnect--;
        // Also remove it when its cells are completely eaten not to back up dead clients
        if (this.disconnect == -1 || this.cells.length == 0) {
            // Remove all client cells
            var len = this.cells.length;

            for (var i = 0; i < len; i++) {
                var cell = this.cells[0];
                if (!cell) continue;

                this.gameServer.removeNode(cell);
            }

            this.fullyDisconnected = true;
            this.gameServer.clients.remove(this.socket);
        }
    }
};

PlayerTracker.prototype.getAntiteamMult = function() {
    return Math.min((this.massLossMult + this.massGainMult) / (this.getScore(true) / 2), 2.8);
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
            this.massLossMult += n * (0.3 + this.getAntiteamMult());
            break;
        case 1: // Gain
            this.massGainMult += n * (0.3 + this.getAntiteamMult());
            break;
    }
};

// Viewing box

PlayerTracker.prototype.getBox = function() { // For view distance
    if (this.cells.length > 0) {
        var totalSize = this.getSizes();

        this.viewScale = Math.sqrt(totalSize) / Math.log(totalSize);
    }

    var w = this.gameServer.config.serverViewBaseX * this.viewScale,
        h = this.gameServer.config.serverViewBaseY * this.viewScale;

    return new Rectangle(
        this.centerPos.x - w / 2,
        this.centerPos.y - h / 2,
        w,
        h
    );
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
    var ts = process.hrtime();
    if (this.spectate) {
        // Spectate mode
        return this.getSpectateNodes();
    }

    // Update center
    this.updateCenter();

    // Box
    var box = this.getBox();
    var newVisible = this.calcVisibleNodes(box);

    this.gameServer.playerHandler.tPFOV += getTime(process.hrtime(ts));
    return newVisible;
};

PlayerTracker.prototype.getSpectateNodes = function() {
    if (!this.freeRoam) {
        var specPlayer = this.gameServer.largestClient;
        if (!specPlayer) return this.moveInFreeRoam(); // There are probably no players

        // Get spectate player's location and calculate zoom amount
        var totalSize = specPlayer.getSizes();
        var specZoom = 1.5 / (Math.sqrt(totalSize) / Math.log(totalSize));

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
    var speed = Math.min(dist / 3, 80); // Not to break laws of universe by going faster than light speed

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
    var newVisible = this.calcVisibleNodes(new Rectangle(
        this.centerPos.x - baseX / 2,
        this.centerPos.y - baseY / 2,
        baseX,
        baseY
    ));
    this.sendPosPacket(0.4995);
    return newVisible;
};

PlayerTracker.prototype.calcVisibleNodes = function(box) {
    return this.gameServer.quadTree.query(box);
};

PlayerTracker.prototype.setCenterPos = function(x, y) {
    this.centerPos.x = x;
    this.centerPos.y = y;
    if (this.freeRoam) this.checkBorderPass();
};

PlayerTracker.prototype.checkBorderPass = function() {
    // A check while in free-roam mode to avoid player going into nothingness
    if (this.centerPos.x < this.gameServer.config.borderLeft) this.centerPos.x = this.gameServer.config.borderLeft;
    if (this.centerPos.x > this.gameServer.config.borderRight) this.centerPos.x = this.gameServer.config.borderRight;
    if (this.centerPos.y < this.gameServer.config.borderTop) this.centerPos.y = this.gameServer.config.borderTop;
    if (this.centerPos.y > this.gameServer.config.borderBottom) this.centerPos.y = this.gameServer.config.borderBottom;
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
