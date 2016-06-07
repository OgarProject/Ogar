var Packet = require('./packet');
var BinaryReader = require('./packet/BinaryReader');

function PacketHandler(gameServer, socket) {
    this.gameServer = gameServer;
    this.socket = socket;
    // Detect protocol version - we can do something about it later
    this.protocol = 0;
    this.lastChatTick = 0;

    this.pressQ = false;
    this.pressW = false;
    this.pressSpace = false;
}

module.exports = PacketHandler;

PacketHandler.prototype.handleMessage = function(message) {
    // Discard empty messages
    if (message.length == 0)
        return;
    if (message.length > 2048) {
        // anti-spamming
        this.socket.close(1000, "Spam");
        return;
    }
    var reader = new BinaryReader(message);
    var packetId = reader.readUInt8();

    switch (packetId) {
        case 0:
            var text = null;
            if (this.protocol <= 5)
                text = reader.readStringZeroUnicode();
            else
                text = reader.readStringZeroUtf8();
            this.setNickname(text);
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
            var client = this.socket.playerTracker;
            if (message.length == 13) {
                // protocol late 5, 6, 7
                client.mouse.x = reader.readInt32() - client.scrambleX;
                client.mouse.y = reader.readInt32() - client.scrambleY;
                client.movePacketTriggered = true;
            } else if (message.length == 9) {
                // early protocol 5
                client.mouse.x = reader.readInt16() - client.scrambleX;
                client.mouse.y = reader.readInt16() - client.scrambleY;
                client.movePacketTriggered = true;
            } else if (message.length == 21) {
                // protocol 4
                client.mouse.x = reader.readDouble() - client.scrambleX;
                client.mouse.y = reader.readDouble() - client.scrambleY;
                client.movePacketTriggered = true;
                if (isNaN(client.mouse.x))
                    client.mouse.x = client.centerPos.x;
                if (isNaN(client.mouse.y))
                    client.mouse.y = client.centerPos.y;
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
        case 99:
            // Chat
            if (message.length < 3)             // first validation
                break;
            // chat anti-spam
            // Just ignore if the time between two messages is smaller than 2 seconds
            // The user should stop spamming for at least 2 seconds in order to send next chat message
            var tick = this.gameServer.getTick();
            var deltaTick = tick - this.lastChatTick;
            this.lastChatTick = tick;
            if (deltaTick < 40 * 2)
                break;
            
            var flags = reader.readUInt8();    // flags
            var rvLength = (flags & 2 ? 4:0) + (flags & 4 ? 8:0) + (flags & 8 ? 16:0);
            if (message.length < 3 + rvLength) // second validation
                break;
            reader.skipBytes(rvLength);        // reserved
            var text = null;
            if (this.protocol <= 5)
                text = reader.readStringZeroUnicode();
            else
                text = reader.readStringZeroUtf8();
            this.gameServer.onChatMessage(this.socket.playerTracker, null, text);
            break;

        case 254:
            // Handshake request
            if (this.protocol != 0) // second handshake request is not allowed
                break;
            if (message.length == 5) {
                this.protocol = reader.readUInt32();
                // Send handshake response
                this.socket.sendPacket(new Packet.ClearNodes());
                var border = {
                    left: this.gameServer.config.borderLeft + this.socket.playerTracker.scrambleX,
                    top: this.gameServer.config.borderTop + this.socket.playerTracker.scrambleY,
                    right: this.gameServer.config.borderRight + this.socket.playerTracker.scrambleX,
                    bottom: this.gameServer.config.borderBottom + this.socket.playerTracker.scrambleY
                };
                this.socket.sendPacket(new Packet.SetBorder(border, 0, "MultiOgar 1.0"));
                // Send welcome message
                this.gameServer.sendChatMessage(null, this.socket.playerTracker, "Welcome to MultiOgar server!");
            }
            break;
        default:
            break;
    }
};

PacketHandler.prototype.setNickname = function (text) {
    var name = "";
    var skin = "";
    if (text != null && text.length != 0) {
        var n = -1;
        if (text.charAt(0) == '<' && (n = text.indexOf('>', 1)) >= 0) {
            skin = "%" + text.slice(1, n);
            name = text.slice(n + 1);
            //} else if (text[0] == "|" && (n = text.indexOf("|", 1)) >= 0) {
            //    skin = ":http://i.imgur.com/" + text.slice(1, n);
            //    name = text.slice(n + 1);
        } else {
            name = text;
        }
    }
    if (name.length > this.gameServer.config.playerMaxNickLength) {
        name = name.substring(0, this.gameServer.config.playerMaxNickLength);
    }
    if (this.gameServer.gameMode.haveTeams) {
        skin = "";
    }
    this.socket.playerTracker.joinGame(name, skin);
};
