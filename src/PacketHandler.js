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
            var reader = new BinaryReader(message);
            reader.readUInt8();
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
            if (view.byteLength == 13) {  // protocol 5,6,7
                client.mouse.x = view.getInt32(1, true) - client.scrambleX;
                client.mouse.y = view.getInt32(5, true) - client.scrambleY;
                client.movePacketTriggered = true;
            } else if (view.byteLength == 9) { // early protocol 5
                client.mouse.x = view.getInt16(1, true) - client.scrambleX;
                client.mouse.y = view.getInt16(3, true) - client.scrambleY;
                client.movePacketTriggered = true;
            } else if (view.byteLength == 21) { // protocol 4
                client.mouse.x = view.getFloat64(1, true) - client.scrambleX;
                client.mouse.y = view.getFloat64(9, true) - client.scrambleY;
                client.movePacketTriggered = true;
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
            var tick = this.gameServer.getTick();
            // antispam: ignore it if the time between two message is smaller than 2 seconds
            if (tick - this.lastChatTick < 40 * 2)
                break;
            this.lastChatTick = tick;
            var reader = new BinaryReader(message);
            reader.readUInt8();                 // message id
            var flags = reader.readUInt8();     // flags
            if (flags & 2) reader.readBytes(4);
            if (flags & 4) reader.readBytes(8);
            if (flags & 8) reader.readBytes(16);
            var text = null;
            if (this.protocol <= 5)
                text = reader.readStringZeroUnicode();
            else
                text = reader.readStringZeroUtf8();
            this.gameServer.onChatMessage(this.socket.playerTracker, null, text);
            break;

        case 254:
            // Connection Start
            if (view.byteLength == 5) {
                this.protocol = view.getUint32(1, true);
                // Send Clear & SetBorder packet first
                this.socket.sendPacket(new Packet.ClearNodes());
                var c = this.gameServer.config;
                this.socket.sendPacket(new Packet.SetBorder(
                    c.borderLeft + this.socket.playerTracker.scrambleX,
                    c.borderRight + this.socket.playerTracker.scrambleX,
                    c.borderTop + this.socket.playerTracker.scrambleY,
                    c.borderBottom + this.socket.playerTracker.scrambleY,
                    0,
                    "MultiOgar 1.0"));
                this.gameServer.sendChatMessage(null, this.socket.playerTracker, "Welcome to MultiOgar server!");
            }
            break;
        default:
            break;
    }
};

PacketHandler.prototype.setNickname = function(text) {
    var client = this.socket.playerTracker;
    if (client.cells.length < 1) {
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
        client.setName(name);
        client.setSkin(skin);
        
        var c = this.gameServer.config;
        this.socket.sendPacket(new Packet.ClearNodes());
        this.socket.sendPacket(new Packet.SetBorder(
            c.borderLeft + this.socket.playerTracker.scrambleX,
            c.borderRight + this.socket.playerTracker.scrambleX,
            c.borderTop + this.socket.playerTracker.scrambleY,
            c.borderBottom + this.socket.playerTracker.scrambleY));

        // If client has no cells... then spawn a player
        this.gameServer.gameMode.onPlayerSpawn(this.gameServer, client);

        // Turn off spectate mode
        client.spectate = false;
    }
};
