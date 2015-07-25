var Packet = require('./packet');

function PacketHandler(gameServer, socket) {
    this.gameServer = gameServer;
    this.socket = socket;
    // Detect protocol version - we can do something about it later
    this.protocol = 0;

    this.pressQ = false;
    this.pressW = false;
    this.pressSpace = false;
    this.multiCells = [];
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
            // Check for invalid packets
            if ((view.byteLength + 1) % 2 == 1) {
                break;
            }

            // Set Nickname
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
            break;
        case 1:
            // Spectate mode
            if (this.socket.playerTracker.cells.length <= 0) {
                // Make sure client has no cells
                this.gameServer.switchSpectator(this.socket.playerTracker);
                this.socket.playerTracker.spectate = true;
            }
            break;
        case 16:
            // Set Target
            // Discard broken packets, handle float64s or int16s depending on how Zeach feels at the time
            var client = this.socket.playerTracker;
            var newX, newY, nodeId;
            if (view.byteLength == 9) {
                newX = view.getInt16(1, true);
                newY = view.getInt16(3, true);
                nodeId = view.getUint32(5, true);
            } else if (view.byteLength == 21) {
                newX = view.getFloat64(1, true);
                newY = view.getFloat64(9, true);
                nodeId = view.getUint32(17, true);
            } else {
                break;
            }
            if (nodeId == 0) {
                client.mouseCells = []; // Disable individual cell movement
                client.mouse.x = newX;
                client.mouse.y = newY;
            } else {
                client.mouseCells[nodeId] = {x: newX, y: newY};
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
        case 255:
            // Connection Start 
            if (view.byteLength == 5) {
                this.protocol = view.getUint32(1, true);
                // Send SetBorder packet first
                var c = this.gameServer.config;
                this.socket.sendPacket(new Packet.SetBorder(c.borderLeft, c.borderRight, c.borderTop, c.borderBottom));
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

        // If client has no cells... then spawn a player
        this.gameServer.gameMode.onPlayerSpawn(this.gameServer,client);

        // Turn off spectate mode
        client.spectate = false;
    }
};

