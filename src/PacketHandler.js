var Packet = require('./packet');

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
    function stobuf(buf) {
        var length = buf.length;
        var arrayBuf = new ArrayBuffer(length);
        var view = new Uint8Array(arrayBuf);

        for (var i = 0; i < length; i++) {
            view[i] = buf[i];
        }

        return view.buffer;
    }

    // Discard empty messages
    if (message.length == 0) {
        return;
    }

    var buffer = stobuf(message);
    var view = new DataView(buffer);
    var packetId = view.getUint8(0, true);

    switch (packetId) {
        case 0:
            // Set Nickname
            if (this.protocolVersion == 5) {
                // Check for invalid packets
                if ((view.byteLength + 1) % 2 == 1) {
                    break;
                }
                var nick = "";
                var maxLen = this.gameServer.config.playerMaxNickLength * 2; // 2 bytes per char
                for (var i = 1; i < view.byteLength && i <= maxLen; i += 2) {
                    var charCode = view.getUint16(i, true);
                    if (charCode == 0) {
                        break;
                    }
    
                    nick += String.fromCharCode(charCode);
                }
                this.setNickname(nick);
            } else {
                this.setNickname(message.slice(1, message.length - 1).toString());
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
            // Set Target
            if (view.byteLength == 13) {
                var client = this.socket.playerTracker;
                client.mouse.x = view.getInt32(1, true) - client.scrambleX;
                client.mouse.y = view.getInt32(5, true) - client.scrambleY;
            }

            client.movePacketTriggered = true;
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
            if (view.byteLength == 5) {
                this.protocolVersion = view.getUint32(1, true);
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
        default:
            break;
    }
};

PacketHandler.prototype.setNickname = function(newNick) {
    var client = this.socket.playerTracker;
    if (client.cells.length < 1) {
        // Set name first
        client.setName(newNick);
        
        // Clear client's nodes
        this.socket.sendPacket(new Packet.ClearNodes());

        // If client has no cells... then spawn a player
        this.gameServer.gameMode.onPlayerSpawn(this.gameServer, client);

        // Turn off spectate mode
        client.spectate = false;
    }
};
