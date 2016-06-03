var Packet = require('./packet');

function PacketHandler(gameServer, socket) {
    this.gameServer = gameServer;
    this.socket = socket;
    // Detect protocol version - we can do something about it later
    this.protocol = 0;

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
            var bufferName = new Buffer(message);
            bufferName = bufferName.slice(1);
            
            var text = "";
            if (bufferName.length > 0) {
                if (this.protocol <= 5) {
                    text = this.readStringUnicode(bufferName);
                } else {
                    text = this.readStringUtf8(bufferName);
                }
            }
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
                    "OgarMulti"));
            }
            break;
        default:
            break;
    }
};

PacketHandler.prototype.readStringUnicode = function (dataBuffer) {
    if (dataBuffer.length > 512) return "";
    
    var buffer = new Buffer(dataBuffer);
    var text = "";
    var maxLength = (buffer.length / 2) >> 0;
    if (maxLength * 2 > buffer.length) maxLength--;
    if (maxLength < 0) maxLength = 0;
    for (var i = 0; i < maxLength; i++) {
        var charCode = buffer.readUInt16LE(i * 2);
        if (charCode == 0) {
            break;
        }
        text += String.fromCharCode(charCode);
    }
    return text;
}

PacketHandler.prototype.readStringUtf8 = function (dataBuffer) {
    if (dataBuffer.length > 512) return "";
    
    var buffer = new Buffer(dataBuffer);
    var maxLen = buffer.length;
    for (var i = 0; i < maxLen; i++) {
        if (buffer[i] == 0) {
            maxLen = i;
            break;
        }
    }
    var text = buffer.toString('utf8', 0, maxLen);  // utf8 => string
    return text;
}

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
