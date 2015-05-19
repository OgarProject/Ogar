var Cell = require('./Cell');

function PacketHandler(gameServer, socket) {
    this.gameServer = gameServer;
    this.socket = socket;
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

    var buffer = stobuf(message);
    var view = new DataView(buffer);
    var packetId = view.getUint8(0, true);

    switch (packetId) {
        case 0:
            // Set Nickname
            var nick = "";
            for (var i = 1; i < buffer.length; i += 2) {
                var charCode = view.getUint16(i, true);
                if (charCode == 0) {
                    break;
                }

                nick += String.fromCharCode(i);
            }

            this.setNickname(nick);
            break;
        default:
            break;
    }
}

PacketHandler.prototype.setNickname = function(newNick) {
    if (!this.socket.playerTracker.cell) {
        this.socket.playerTracker.cell = new Cell(this.gameServer.getNextNodeId(), newNick, this.gameServer.getRandomPosition(), 10);
        this.gameServer.addNode(this.socket.playerTracker.cell);
    } else {
        this.socket.playerTracker.cell.name = newNick;
    }
}
