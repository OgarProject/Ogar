var pjson = require('../package.json');
var Packet = require('./packet');
var BinaryReader = require('./packet/BinaryReader');

function PacketHandler(gameServer, socket) {
    this.gameServer = gameServer;
    this.socket = socket;
    this.protocol = 0;
    this.handshakeProtocol = null;
    this.handshakeKey = null;
    this.lastChatTick = 0;
    this.lastJoinTick = 0;
    this.lastMouseTick = 0;
    
    this.pressQ = false;
    this.pressW = false;
    this.pressSpace = false;
    this.lastStatTime = +new Date;
}

module.exports = PacketHandler;

PacketHandler.prototype.handleMessage = function (message) {
    // Validation
    if (message.length == 0) {
        return;
    }
    if (message.length > 256) {
        // anti-spamming
        this.socket.close(1009, "Spam");
        return;
    }
    if (this.handshakeProtocol == null || this.handshakeKey == null) {
        this.handleHandshake(message);
        return;
    }
    this.socket.lastAliveTime = +new Date;
    
    if (this.socket.playerTracker.isMinion && this.socket.playerTracker.spawnCounter >= 2) {
        return;
    }
    
    switch (message[0]) {
        case 0:
            if (this.lastJoinTick == this.gameServer.getTick()) {
                break;
            }
            this.lastJoinTick = this.gameServer.getTick();
            if (this.socket.playerTracker.cells.length > 0) {
                break;
            }
            var reader = new BinaryReader(message);
            reader.skipBytes(1);
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
            // Mouse
            if (this.lastMouseTick == this.gameServer.getTick()) {
                break;
            }
            this.lastMouseTick = this.gameServer.getTick();
            
            var client = this.socket.playerTracker;
            if (message.length == 13) {
                // protocol late 5, 6, 7
                var reader = new BinaryReader(message);
                reader.skipBytes(1);
                client.mouse.x = reader.readInt32() - client.scrambleX;
                client.mouse.y = reader.readInt32() - client.scrambleY;
            } else if (message.length == 9) {
                // early protocol 5
                var reader = new BinaryReader(message);
                reader.skipBytes(1);
                client.mouse.x = reader.readInt16() - client.scrambleX;
                client.mouse.y = reader.readInt16() - client.scrambleY;
            } else if (message.length == 21) {
                // protocol 4
                var reader = new BinaryReader(message);
                reader.skipBytes(1);
                client.mouse.x = reader.readDouble() - client.scrambleX;
                client.mouse.y = reader.readDouble() - client.scrambleY;
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
            
            var flags = message[1];    // flags
            var rvLength = (flags & 2 ? 4:0) + (flags & 4 ? 8:0) + (flags & 8 ? 16:0);
            if (message.length < 3 + rvLength) // second validation
                break;
            
            var reader = new BinaryReader(message);
            reader.skipBytes(2 + rvLength);     // reserved
            
            var text = null;
            if (this.protocol < 6)
                text = reader.readStringZeroUnicode();
            else
                text = reader.readStringZeroUtf8();
            this.gameServer.onChatMessage(this.socket.playerTracker, null, text);
            break;
        
        case 254:
            // Server stat
            var time = +new Date;
            var dt = time - this.lastStatTime;
            this.lastStatTime = time;
            if (dt < 1000) break;
            this.socket.sendPacket(new Packet.ServerStat(this.socket.playerTracker));
            break;
        
        default:
            break;
    }
};

PacketHandler.prototype.handleHandshake = function (message) {
    if (message.length != 5) {
        this.socket.close(1002, "Invalid protocol");
        return;
    }
    if (message[0] == 254) {
        this.handshakeProtocol = message[1] | (message[2] << 8) | (message[3] << 16) | (message[4] << 24);
        if (this.handshakeProtocol < 1 || this.handshakeProtocol > 8) {
            this.socket.close(1002, "Not supported protocol");
        }
    }
    if (message[0] == 255) {
        this.handshakeKey = message[1] | (message[2] << 8) | (message[3] << 16) | (message[4] << 24);
        if (this.handshakeProtocol > 6 && this.handshakeKey != 0) {
            this.socket.close(1002, "Not supported protocol");
        }
    }
    if (this.handshakeProtocol == null || this.handshakeKey == null) {
        return;
    }
    this.protocol = this.handshakeProtocol;

    // Send handshake response
    this.socket.sendPacket(new Packet.ClearAll());
    this.socket.sendPacket(new Packet.SetBorder(this.socket.playerTracker, this.gameServer.border, this.gameServer.config.serverGamemode, "MultiOgar " + pjson.version));
    // Send welcome message
    this.gameServer.sendChatMessage(null, this.socket.playerTracker, "MultiOgar " + pjson.version);
    if (this.gameServer.config.serverWelcome1)
        this.gameServer.sendChatMessage(null, this.socket.playerTracker, this.gameServer.config.serverWelcome1);
    if (this.gameServer.config.serverWelcome2)
        this.gameServer.sendChatMessage(null, this.socket.playerTracker, this.gameServer.config.serverWelcome2);
    if (this.gameServer.config.serverChat == 0)
        this.gameServer.sendChatMessage(null, this.socket.playerTracker, "This server's chat is disabled.");
    if (this.protocol < 4)
        this.gameServer.sendChatMessage(null, this.socket.playerTracker, "WARNING: Protocol " + this.protocol + " assumed as 4!");
};

PacketHandler.prototype.setNickname = function (text) {
    var name = "";
    var skin = null;
    if (text != null && text.length > 0) {
        var skinName = null;
        var userName = text;
        var n = -1;
        if (text[0] == '<' && (n = text.indexOf('>', 1)) >= 1) {
            if (n > 1)
                skinName = "%" + text.slice(1, n);
            else
                skinName = "";
            userName = text.slice(n + 1);
        }
        //else if (text[0] == "|" && (n = text.indexOf('|', 1)) >= 0) {
        //    skinName = ":http://i.imgur.com/" + text.slice(1, n) + ".png";
        //    userName = text.slice(n + 1);
        //}
        if (skinName && !this.gameServer.checkSkinName(skinName)) {
            skinName = null;
            userName = text;
        }
        skin = skinName;
        name = userName;
    }
    if (name.length > this.gameServer.config.playerMaxNickLength) {
        name = name.substring(0, this.gameServer.config.playerMaxNickLength);
    }
    if (this.gameServer.checkBadWord(name)) {
        skin = null;
        name = "Hi there!";
    }
    this.socket.playerTracker.joinGame(name, skin);
};
