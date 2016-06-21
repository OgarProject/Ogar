var Packet = require('./packet');
var GameServer = require('./GameServer');

function PlayerTracker(gameServer, socket) {
    this.gameServer = gameServer;
    this.socket = socket;
    this.pID = -1;
    this.isRemoved = false;
    this.isCloseRequested = false;
    this.name = "";
    this.skin = "";
    this.color = { r: 0, g: 0, b: 0 };
    this.visibleNodes = [];
    this.cells = [];
    this.mergeOverride = false; // Triggered by console command
    this.score = 0; // Needed for leaderboard
    this.scale = 1;
    this.isMassChanged = true;
    this.borderCounter = 0;

    this.mouse = {
        x: 0,
        y: 0
    };
    this.tickLeaderboard = 0;

    this.team = 0;
    this.spectate = false;
    this.freeRoam = false; // Free-roam mode enables player to move in spectate mode

    this.centerPos = {
        x: 0,
        y: 0
    };
    this.viewBox = {
        minx: 0,
        miny: 0,
        maxx: 0,
        maxy: 0,
        width: 0,
        height: 0,
        halfWidth: 0,
        halfHeight: 0
    };

    // Scramble the coordinate system for anti-raga
    this.scrambleX = 0;
    this.scrambleY = 0;
    this.scrambleId = 0;

    // Gamemode function
    if (gameServer) {
        this.centerPos.x = gameServer.border.centerx;
        this.centerPos.y = gameServer.border.centery;
        // Player id
        this.pID = gameServer.getNewPlayerID();
        // Gamemode function
        gameServer.gameMode.onPlayerInit(this);
        // Only scramble if enabled in config
        this.scramble();
    }
}

module.exports = PlayerTracker;

// Setters/Getters

PlayerTracker.prototype.scramble = function () {
    this.scrambleId = (Math.random() * 0xFFFFFFFF) >>> 0;
    
    if (!this.gameServer.config.serverScrambleCoords)
        return;
    // avoid mouse packet limitations
    var maxx = Math.max(0, 32767 - 1000 - this.gameServer.border.width);
    var maxy = Math.max(0, 32767 - 1000 - this.gameServer.border.height);
    var x = maxx * Math.random();
    var y = maxy * Math.random();
    if (Math.random() >= 0.5) x = -x;
    if (Math.random() >= 0.5) y = -y;
    this.scrambleX = x;
    this.scrambleY = y;
    this.borderCounter = 0;
};

PlayerTracker.prototype.getFriendlyName = function () {
    var name = this.getName();
    if (!name) name = "";
    name = name.trim();
    if (name.length == 0)
        name = "An unnamed cell";
    return name;
};

PlayerTracker.prototype.setName = function(name) {
    this.name = name;
};

PlayerTracker.prototype.getName = function() {
    return this.name;
};

PlayerTracker.prototype.setSkin = function (skin) {
    this.skin = skin;
};

PlayerTracker.prototype.getSkin = function () {
    return this.skin;
};

PlayerTracker.prototype.getColor = function (color) {
    return this.color;
};

PlayerTracker.prototype.setColor = function (color) {
    this.color.r = color.r;
    this.color.g = color.g;
    this.color.b = color.b;
};

PlayerTracker.prototype.getTeam = function () {
    return this.team;
};

PlayerTracker.prototype.getScore = function () {
    if (this.isMassChanged)
        this.updateMass();
    return this.score;
};

PlayerTracker.prototype.getScale = function () {
    if (this.isMassChanged)
        this.updateMass();
    return this.scale;
};

PlayerTracker.prototype.updateMass = function () {
    var totalSize = 0;
    var totalMass = 0;
    for (var i = 0; i < this.cells.length; i++) {
        var node = this.cells[i];
        if (node == null) continue;
        totalSize += node.getSize();
        totalMass += node.getMass();
    }
    if (totalSize == 0) {
        //do not change scale for spectators or not in game players
        this.score = 0;
    } else {
        this.score = totalMass;
        this.scale = Math.pow(Math.min(64 / totalSize, 1), 0.4);
    }
    this.isMassChanged = false;
};

PlayerTracker.prototype.massChanged = function () {
    this.isMassChanged = true;    
};

// Functions

PlayerTracker.prototype.joinGame = function (name, skin) {
    if (this.cells.length > 0) return;
    if (name == null) name = "";
    if (skin == null) skin = "";
    this.setName(name);
    this.setSkin(skin);
    this.spectate = false;
    this.freeRoam = false;

    // some old clients don't understand ClearAll message
    // so we will send update for them
    if (this.socket.packetHandler.protocol < 6) {
        this.socket.sendPacket(new Packet.UpdateNodes(this, [], [], [], this.visibleNodes));
    }
    this.socket.sendPacket(new Packet.ClearAll());
    this.visibleNodes = [];
    this.scramble();
    this.gameServer.gameMode.onPlayerSpawn(this.gameServer, this);
};

PlayerTracker.prototype.update = function () {
    if (this.isRemoved) return;
    // Handles disconnection
    var time = +new Date;
    if (!this.socket.isConnected) {
        // wait for playerDisconnectTime
        var dt = (time - this.socket.closeTime) / 1000;
        if (this.cells.length == 0 || dt >= this.gameServer.config.playerDisconnectTime) {
            // Remove all client cells
            var cells = this.cells;
            this.cells = [];
            for (var i = 0; i < cells.length; i++) {
                this.gameServer.removeNode(cells[i]);
            }
            // Mark to remove
            this.isRemoved = true;
        }
        // update visible nodes/mouse (for spectators, if any)
        var nodes = this.getVisibleNodes();
        nodes.sort(function (a, b) { return a.nodeId - b.nodeId; });
        this.visibleNodes = nodes;
        this.mouse.x = this.centerPos.x;
        this.mouse.y = this.centerPos.y;
        this.socket.packetHandler.pressSpace = false;
        this.socket.packetHandler.pressW = false;
        this.socket.packetHandler.pressQ = false;
        return;
    }
    // Check timeout
    if (!this.isCloseRequested && this.gameServer.config.serverTimeout) {
        var dt = (time - this.socket.lastAliveTime) / 1000;
        if (dt >= this.gameServer.config.serverTimeout) {
            this.socket.close(1000, "Connection timeout");
            this.isCloseRequested = true;
        }
    }

    // if initialization is not complete yet then do not send update
    if (!this.socket.packetHandler.protocol)
        return;
    
    // Actions buffer (So that people cant spam packets)
    if (this.socket.packetHandler.pressSpace) { // Split cell
        if (!this.mergeOverride) this.gameServer.gameMode.pressSpace(this.gameServer, this);
        this.socket.packetHandler.pressSpace = false;
    }
    
    if (this.socket.packetHandler.pressW) { // Eject mass
        this.gameServer.gameMode.pressW(this.gameServer, this);
        this.socket.packetHandler.pressW = false;
    }
    
    if (this.socket.packetHandler.pressQ) { // Q Press
        this.gameServer.gameMode.pressQ(this.gameServer, this);
        this.socket.packetHandler.pressQ = false;
    }
    
    var newVisible = this.getVisibleNodes();
    newVisible.sort(function (a, b) { return a.nodeId - b.nodeId; });
    var delNodes = [];
    var eatNodes = [];
    var addNodes = [];
    var updNodes = [];
    var newIndex = 0;
    var oldIndex = 0;
    for (; newIndex < newVisible.length && oldIndex < this.visibleNodes.length;) {
        if (newVisible[newIndex].nodeId < this.visibleNodes[oldIndex].nodeId) {
            addNodes.push(newVisible[newIndex]);
            newIndex++;
            continue;
        }
        if (newVisible[newIndex].nodeId > this.visibleNodes[oldIndex].nodeId) {
            var node = this.visibleNodes[oldIndex];
            if (node.isRemoved)
                eatNodes.push(node);
            else
                delNodes.push(node);
            oldIndex++;
            continue;
        }
        var node = newVisible[newIndex];
        // skip food & eject if no moving
        if (node.isMoving || (node.cellType != 1 && node.cellType != 3))
            updNodes.push(node);
        newIndex++;
        oldIndex++;
    }
    for (; newIndex < newVisible.length; ) {
        var node = newVisible[newIndex];
        addNodes.push(newVisible[newIndex]);
        newIndex++;
    }
    for (; oldIndex < this.visibleNodes.length; ) {
        var node = this.visibleNodes[oldIndex];
        if (node.isRemoved)
            eatNodes.push(node);
        else 
            delNodes.push(node);
        oldIndex++;
    }
    this.visibleNodes = newVisible;
    
    if (this.gameServer.config.serverScrambleCoords) {
        if (this.borderCounter == 0) {
            var bound = {
                minx: Math.max(this.gameServer.border.minx, this.viewBox.minx - this.viewBox.halfWidth),
                miny: Math.max(this.gameServer.border.miny, this.viewBox.miny - this.viewBox.halfHeight),
                maxx: Math.min(this.gameServer.border.maxx, this.viewBox.maxx + this.viewBox.halfWidth),
                maxy: Math.min(this.gameServer.border.maxy, this.viewBox.maxy + this.viewBox.halfHeight)
            };
            this.socket.sendPacket(new Packet.SetBorder(this, bound));
        }
        this.borderCounter++;
        if (this.borderCounter >= 20)
            this.borderCounter = 0;
    }

    // Send packet
    this.socket.sendPacket(new Packet.UpdateNodes(
        this,
        addNodes,
        updNodes,
        eatNodes,
        delNodes));
    
    // Update leaderboard
    if (this.tickLeaderboard <= 0) {
        if (this.gameServer.leaderboardType >= 0) {
            var packet = new Packet.UpdateLeaderboard(this, this.gameServer.leaderboard, this.gameServer.leaderboardType);
            this.socket.sendPacket(packet);
        }
        // 1 / 0.040 = 25 (once per second)
        this.tickLeaderboard = 25;
    } else {
        this.tickLeaderboard--;
    }
};

// Viewing box

PlayerTracker.prototype.updateCenterInGame = function() { // Get center of cells
    var len = this.cells.length;
    if (len <= 0) return;
    var cx = 0;
    var cy = 0;
    var count = 0;
    for (var i = 0; i < len; i++) {
        var node = this.cells[i];
        if (node == null) continue;
        cx += node.position.x;
        cy += node.position.y;
        count++;
    }
    if (count == 0) return;
    this.setCenterPos(cx / count, cy / count);
};

PlayerTracker.prototype.updateCenterFreeRoam = function () {
    var dx = this.mouse.x - this.centerPos.x;
    var dy = this.mouse.y - this.centerPos.y;
    var squared = dx * dx + dy * dy;
    if (squared == 0) return;     // stop threshold
    
    // distance
    var d = Math.sqrt(squared);
    
    var invd = 1 / d;
    var nx = dx * invd;
    var ny = dy * invd;
    
    var speed = Math.min(d, 32);
    if (speed <= 0) return;
    
    var x = this.centerPos.x + nx * speed;
    var y = this.centerPos.y + ny * speed;
    // check border
    x = Math.max(x, this.gameServer.border.minx);
    y = Math.max(y, this.gameServer.border.miny);
    x = Math.min(x, this.gameServer.border.maxx);
    y = Math.min(y, this.gameServer.border.maxy);
    this.setCenterPos(x, y);
};

PlayerTracker.prototype.updateViewBox = function () {
    var scale = this.getScale();
    var width = (this.gameServer.config.serverViewBaseX + 100) / scale;
    var height = (this.gameServer.config.serverViewBaseY + 100) / scale;
    var halfWidth = width / 2;
    var halfHeight = height / 2;
    this.viewBox = {
        minx: this.centerPos.x - halfWidth,
        miny: this.centerPos.y - halfHeight,
        maxx: this.centerPos.x + halfWidth,
        maxy: this.centerPos.y + halfHeight,
        width: width,
        height: height,
        halfWidth: halfWidth,
        halfHeight: halfHeight
    };
};

PlayerTracker.prototype.getVisibleNodes = function () {
    if (this.spectate) {
        var specPlayer = this.gameServer.largestClient;
        if (!this.freeRoam && specPlayer != null) {
            // top player spectate
            this.setCenterPos(specPlayer.centerPos.x, specPlayer.centerPos.y);
            this.scale = specPlayer.getScale();
            this.sendPosPacket();
            this.updateViewBox();
            return specPlayer.visibleNodes.slice(0);
        }
        // free roam spectate
        this.updateCenterFreeRoam();
        this.scale = this.gameServer.config.serverSpectatorScale;//0.25;
        this.sendPosPacket();
    } else {
        // in game
        this.updateCenterInGame();
        // scale will be calculated on first call to this.getScale() inside updateViewBox()
    }
    this.updateViewBox();
    return this.calcVisibleNodes();
}

PlayerTracker.prototype.calcVisibleNodes = function() {
    var newVisible = [];
    var self = this;
    this.gameServer.quadTree.find(this.viewBox, function (quadItem) {
        if (quadItem.cell.owner != self)
            newVisible.push(quadItem.cell);
    });
    return newVisible.concat(this.cells);
};

PlayerTracker.prototype.setCenterPos = function(x, y) {
    this.centerPos.x = x;
    this.centerPos.y = y;
    if (this.freeRoam) this.checkBorderPass();
};

PlayerTracker.prototype.checkBorderPass = function() {
    // A check while in free-roam mode to avoid player going into nothingness
    this.centerPos.x = Math.max(this.centerPos.x, this.gameServer.border.minx);
    this.centerPos.y = Math.max(this.centerPos.y, this.gameServer.border.miny);
    this.centerPos.x = Math.min(this.centerPos.x, this.gameServer.border.maxx);
    this.centerPos.y = Math.min(this.centerPos.y, this.gameServer.border.maxy);
};

PlayerTracker.prototype.sendPosPacket = function() {
    // TODO: Send packet elsewhere so it is sent more often
    this.socket.sendPacket(new Packet.UpdatePosition(
        this,
        this.centerPos.x,
        this.centerPos.y,
        this.getScale()
    ));
};
