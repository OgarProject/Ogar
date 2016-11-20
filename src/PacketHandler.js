var Packet = require('./packet');
var Vector = require('./modules/Vector');

function PacketHandler(gameServer, socket) {
    this.gameServer = gameServer;
    this.socket = socket;
    // Detect protocol version - we can do something about it later
    this.protocolVersion = 0;

    this.pressQ = false;
    this.pressW = false;
    this.pressSpace = false;
}

module.exports = PacketHandler;

PacketHandler.prototype.handleMessage = function(message) {
    // Discard empty messages
    if (message.length == 0) return;
    var packetId = message.readUInt8(0, true);

    switch (packetId) {
        case 0:
            // Set Nickname
            if (this.protocolVersion == 5) {
                // Check for invalid packets
                if ((message.length + 1) % 2 == 1) break;
                var name = message.slice(1, message.length - 1).toString('ucs2').substr(0, this.gameServer.config.playerMaxNickLength);
                this.setNickname(name);
            } else {
                var name = message.slice(1, message.length - 1).toString('utf-8').substr(0, this.gameServer.config.playerMaxNickLength);
                this.setNickname(name);
            }
            break;
        case 1:
            // Spectate mode
            if (this.socket.playerTracker.cells.length <= 0) {
                // Make sure client has no cells
                this.socket.playerTracker.spectate = true;
            }
            break;
        case 16:
            var client = this.socket.playerTracker;
            // Set Target
            switch (message.length) {
                case 13:
                    client.mouse.x = message.readInt32LE(1, true) - client.scrambleX;
                    client.mouse.y = message.readInt32LE(5, true) - client.scrambleY;
                    break;
                case 9:
                    client.mouse.x = message.readInt16LE(1, true) - client.scrambleX;
                    client.mouse.y = message.readInt16LE(3, true) - client.scrambleY;
                    break;
                case 21:
                    client.mouse.x = message.readDoubleLE(1, true) - client.scrambleX;
                    client.mouse.y = message.readDoubleLE(9, true) - client.scrambleY;
                    break;
            }
            break;
        case 17:
            // Space Press - Split cell
            this.pressSpace = true;
            break;
        case 18:
            // Q Key Pressed
            this.pressQ = true;
            break;
        case 19:
            // Q Key Released
            break;
        case 21:
            // W Press - Eject mass
            this.pressW = true;
            break;
        case 254:
            // Connection Start
            if (message.length == 5) {
                this.protocolVersion = message.readUInt32LE(1, true);
                // Send on connection packets
                this.socket.sendPacket(new Packet.ClearNodes(this.protocolVersion));
                var c = this.gameServer.config;
                this.socket.sendPacket(new Packet.SetBorder(
                    c.borderLeft + this.socket.playerTracker.scrambleX,
                    c.borderRight + this.socket.playerTracker.scrambleX,
                    c.borderTop + this.socket.playerTracker.scrambleY,
                    c.borderBottom + this.socket.playerTracker.scrambleY
                ));
            }
            break;
        case 255:
            if (message.length == 5) {
                // Set client's center pos to middle of server
                var borders = this.gameServer.rangeBorders(),
                    playerTracker = this.socket.playerTracker;

                playerTracker.centerPos = new Vector(borders.x, borders.y);
                playerTracker.sendPosPacket(1.5 / (Math.sqrt(200) / Math.log(200)));
            }
            break;
        default:
            break;
    }
};

PacketHandler.prototype.setNickname = function(newNick) {
    var client = this.socket.playerTracker;
    // Set name (changing name while playing is accepted)
    client.setName(newNick);

    if (client.cells.length < 1) {
        // Clear client's nodes
        this.socket.sendPacket(new Packet.ClearNodes());

        // If client has no cells... then spawn a player
        this.gameServer.gameMode.onPlayerSpawn(this.gameServer, client);

        // Turn off spectate mode
        client.spectate = false;
    }
};
