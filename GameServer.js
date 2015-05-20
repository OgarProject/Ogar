// Library imports
var WebSocket = require('ws');

// Project imports
var Packet = require('./packet');
var PlayerTracker = require('./PlayerTracker');
var PacketHandler = require('./PacketHandler');
var Cell = require('./Cell');

// GameServer implementation
function GameServer(port) {
    this.border = {
        left: 0,
        right: 11180.3398875,
        top: 11180.3398875,
        bottom: 0
    };
    this.lastNodeId = 1;
    this.clients = [];
    this.nodes = [];
    this.port = port;
}

module.exports = GameServer;

GameServer.prototype.start = function() {
    this.socketServer = new WebSocket.Server({ port: this.port }, function() {
        console.log("[Game] Listening on port %d", this.port);
        setInterval(this.updateAll.bind(this), 100);
    }.bind(this));

    this.socketServer.on('connection', connectionEstablished.bind(this));

    function connectionEstablished(ws) {
        function close(error) {
            console.log("[Game] Disconnect: %s:%d", this.socket.remoteAddress, this.socket.remotePort);
            var index = this.server.clients.indexOf(this.socket);
            if (index != -1) {
                this.server.clients.splice(index, 1);
            }

            if (this.socket.playerTracker.cell) {
                this.server.removeNode(this.socket.playerTracker.cell);
            }
        }

        console.log("[Game] Connect: %s:%d", ws._socket.remoteAddress, ws._socket.remotePort);
        ws.remoteAddress = ws._socket.remoteAddress;
        ws.remotePort = ws._socket.remotePort;
        ws.playerTracker = new PlayerTracker(this, ws);
        ws.packetHandler = new PacketHandler(this, ws);
        ws.on('message', ws.packetHandler.handleMessage.bind(ws.packetHandler));

        var bindObject = { server: this, socket: ws };
        ws.on('error', close.bind(bindObject));
        ws.on('close', close.bind(bindObject));
        this.clients.push(ws);
    }
}

GameServer.prototype.getNextNodeId = function() {
    return this.lastNodeId++;
}

GameServer.prototype.getRandomPosition = function() {
    return {
        x: Math.floor(Math.random() * (this.border.right - this.border.left)) + this.border.left,
        y: Math.floor(Math.random() * (this.border.bottom - this.border.top)) + this.border.top
    };
}

GameServer.prototype.addNode = function(node) {
    this.nodes[node.nodeId] = node;

    for (var i = 0; i < this.clients.length; i++) {
        if (typeof this.clients[i] == "undefined") {
            continue;
        }

        this.clients[i].playerTracker.nodeAdditionQueue.push(node);
    }
}

GameServer.prototype.removeNode = function(node) {
    var index = this.nodes.indexOf(node);
    if (index != -1) {
        this.nodes.splice(index, 1);
    }

    for (var i = 0; i < this.clients.length; i++) {
        if (typeof this.clients[i] == "undefined") {
            continue;
        }

        this.clients[i].playerTracker.nodeDestroyQueue.push(node);
    }
}

GameServer.prototype.updateAll = function() {
    for (var i = 0; i < this.clients.length; i++) {
        if (typeof this.clients[i] == "undefined") {
            continue;
        }

        this.clients[i].playerTracker.update();
    }
}

// Custom prototype functions
WebSocket.prototype.sendPacket = function(packet) {
    function getbuf(data) {
        var array = new Uint8Array(data.buffer || data);
        var l = data.byteLength || data.length;
        var o = data.byteOffset || 0;
        var buffer = new Buffer(l);

        for (var i = 0; i < l; i++) {
            buffer[i] = array[o + i];
        }

        return buffer;
    }

    if (this.readyState == WebSocket.OPEN && packet.build) {
        var buf = packet.build();
        this.send(getbuf(buf), { binary: true });
    }
}
