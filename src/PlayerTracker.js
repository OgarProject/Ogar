var Packet = require('./packet');
var GameServer = require('./GameServer');

function PlayerTracker(gameServer, socket) {
    this.pID = -1;
    this.disconnect = -1; // Disconnection
    this.name = "";
    this.skin = "";
    this.gameServer = gameServer;
    this.socket = socket;
    this.nodeAdditionQueue = [];
    this.nodeDestroyQueue = [];
    this.visibleNodes = [];
    this.collidingNodes = []; // Perfomance save; all nodes colliding with player's cells
    this.cells = [];
    this.mergeOverride = false; // Triggered by console command
    this.score = 0; // Needed for leaderboard
    this.scale = 1;
    this.isMassChanged = true;

    this.mouse = {
        x: 0,
        y: 0
    };
    this.shouldMoveCells = true; // False if the mouse packet wasn't triggered
    this.notMoved = false; // If one of cells have been moved after splitting this is triggered
    this.movePacketTriggered = false;
    this.mouseCells = []; // For individual cell movement
    this.tickLeaderboard = 0;
    this.tickViewBox = 0;

    this.team = 0;
    this.spectate = false;
    this.freeRoam = false; // Free-roam mode enables player to move in spectate mode

    // Viewing box
    this.sightWidth = 0;
    this.sightHeight = 0;
    this.centerPos = { // Center of map
        x: 3000,
        y: 3000
    };
    this.viewBox = {
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        halfWidth: 0,
        halfHeight: 0
    };

    // Scramble the coordinate system for anti-raga
    this.scrambleX = 0;
    this.scrambleY = 0;
    this.scrambleId = 0;

    // Gamemode function
    if (gameServer) {
        // Find center
        var width = gameServer.config.borderRight - gameServer.config.borderLeft;
        var height = gameServer.config.borderBottom - gameServer.config.borderTop;
        this.centerPos.x = gameServer.config.borderLeft + width / 2;
        this.centerPos.y = gameServer.config.borderTop + height / 2;
        // Player id
        this.pID = gameServer.getNewPlayerID();
        // Gamemode function
        gameServer.gameMode.onPlayerInit(this);
        // Only scramble if enabled in config
        if (gameServer.config.serverScrambleCoords == 1) {
            // avoid mouse packet limitations
            var maxScrambleX = Math.max(0, 32767 - 2000 - width / 2);
            var maxScrambleY = Math.max(0, 32767 - 2000 - height / 2);
            this.scrambleX = Math.floor(maxScrambleX * Math.random());
            this.scrambleY = Math.floor(maxScrambleY * Math.random());
        }
        this.scrambleId = (Math.random() * 0xFFFFFFFF) >>> 0;
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

PlayerTracker.prototype.setSkin = function (skin) {
    this.skin = skin;
};

PlayerTracker.prototype.getSkin = function () {
    return this.skin;
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


PlayerTracker.prototype.setColor = function(color) {
    this.color.r = color.r;
    this.color.g = color.g;
    this.color.b = color.b;
};

PlayerTracker.prototype.getTeam = function() {
    return this.team;
};

// Functions

PlayerTracker.prototype.joinGame = function (name, skin) {
    if (this.cells.length > 0) return;
    if (name == null) name = "";
    if (skin == null) skin = "";
    this.setName(name);
    this.setSkin(skin);
    this.spectate = false;

    this.socket.sendPacket(new Packet.ClearAll());
    this.collidingNodes = [];
    // some clients don't understand ClearAll message
    // so we will send we will do not perform cleanup
    // to allow them to receive remove notifications
    //this.visibleNodes = [];         // Reset visible nodes
    //this.nodeDestroyQueue = [];     // Reset destroy queue
    //this.nodeAdditionQueue = [];    // Reset addition queue

    this.gameServer.gameMode.onPlayerSpawn(this.gameServer, this);
};

PlayerTracker.prototype.update = function () {
    // if initialization is not complete yet then do not update
    if (this.socket.packetHandler.protocol == 0)
        return;
    
    // First reset colliding nodes
    this.collidingNodes = [];
    
    // Move packet update
    if (this.movePacketTriggered) {
        this.movePacketTriggered = false;
        this.shouldMoveCells = true;
    } else {
        this.shouldMoveCells = false;
    }
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
        var newVisible = this.getVisibleNodes();
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
            
            // Scramble minimap
            // TODO: need to send it more rarely (once per second or something like that)
            // also need to make sure that we send it before first cell update
            //var border = {
            //    left: Math.max(this.viewBox.left - this.viewBox.halfWidth, this.gameServer.config.borderLeft),
            //    top: Math.max(this.viewBox.top - this.viewBox.halfHeight, this.gameServer.config.borderTop),
            //    right: Math.min(this.viewBox.right + this.viewBox.halfWidth, this.gameServer.config.borderRight),
            //    bottom: Math.min(this.viewBox.bottom + this.viewBox.halfHeight, this.gameServer.config.borderBottom)
            //};
            //this.socket.sendPacket(new Packet.SetBorder(this, border));
        } catch (err) {
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
        this,
        this.nodeDestroyQueue,
        updateNodes,
        nonVisibleNodes));
    
    this.nodeDestroyQueue = []; // Reset destroy queue
    this.nodeAdditionQueue = []; // Reset addition queue
    
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
    
    // Handles disconnections
    if (this.disconnect > -1) {
        // Player has disconnected... remove it when the timer hits -1
        this.disconnect--;
        // Also remove it when its cells are completely eaten not to back up dead clients
        if (this.disconnect == -1 || this.cells.length == 0) {
            // Remove all client cells
            var len = this.cells.length;
            for (var i = 0; i < len; i++) {
                var cell = this.socket.playerTracker.cells[0];
                if (cell == null) continue;
                
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
    if (squared < 1) return;     // stop threshold
    
    // distance
    var d = Math.sqrt(squared);
    
    var speed = Math.min(d, 32);
    if (speed <= 0) return;
    
    var angle = Math.atan2(dx, dy);
    if (isNaN(angle)) return;
    
    this.setCenterPos(
        this.centerPos.x + speed * Math.sin(angle),
        this.centerPos.y + speed * Math.cos(angle));
};

PlayerTracker.prototype.updateViewBox = function () {
    var scale = this.getScale();
    this.sightWidth = (this.gameServer.config.serverViewBaseX + 100) / scale;
    this.sightHeight = (this.gameServer.config.serverViewBaseY + 100) / scale;
    var halfWidth = this.sightWidth / 2;
    var halfHeight = this.sightHeight / 2;
    this.viewBox = {
        left: this.centerPos.x - halfWidth,
        top: this.centerPos.y - halfHeight,
        right: this.centerPos.x + halfWidth,
        bottom: this.centerPos.y + halfHeight,
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
        this.scale = 0.25;
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
    this.collidingNodes = [];
    var newVisible = [];
    for (var i = 0; i < this.gameServer.nodes.length; i++) {
        var node = this.gameServer.nodes[i];
        if (node == null) continue;

        if (node.owner == this || node.visibleCheck(this.viewBox)) {
            // Cell is in range of viewBox
            newVisible.push(node);
            
            // TODO: rewrite that!
            // Check if it's colliding with one of player's cells
            // To save perfomance, check if any client's cell collides with this cell
            for (var j = 0; j < this.cells.length; j++) {
                var cell = this.cells[j];
                if (cell == null || cell == node)
                    continue;
                
                // circle collision detector
                var dx = cell.position.x - node.position.x;
                var dy = cell.position.y - node.position.y;
                var r = cell.getSize() + node.getSize();
                if (dx * dx + dy * dy < r * r) {
                    // circle collision detected
                    this.collidingNodes.push(node);
                }
            }
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
    if (this.centerPos.x < this.gameServer.config.borderLeft)
        this.centerPos.x = this.gameServer.config.borderLeft;
    if (this.centerPos.x > this.gameServer.config.borderRight)
        this.centerPos.x = this.gameServer.config.borderRight;
    if (this.centerPos.y < this.gameServer.config.borderTop)
        this.centerPos.y = this.gameServer.config.borderTop;
    if (this.centerPos.y > this.gameServer.config.borderBottom)
        this.centerPos.y = this.gameServer.config.borderBottom;
};

PlayerTracker.prototype.sendPosPacket = function() {
    // TODO: Send packet elsewhere so it is sent more often
    this.socket.sendPacket(new Packet.UpdatePosition(
        this.centerPos.x + this.scrambleX,
        this.centerPos.y + this.scrambleY,
        this.getScale()
    ));
};

PlayerTracker.prototype.getAngle = function(x1, y1, x2, y2) {
    var deltaY = y1 - y2;
    var deltaX = x1 - x2;
    return Math.atan2(deltaX, deltaY);
};
