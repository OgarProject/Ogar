var Cell = require('./Cell');
var Packet = require('./packet');

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
            for (var i = 1; i < view.byteLength; i += 2) {
                var charCode = view.getUint16(i, true);
                if (charCode == 0) {
                    break;
                }

                nick += String.fromCharCode(charCode);
            }
            this.setNickname(nick);
            break;
        case 16:
            // Mouse Move
            var mx = view.getFloat64(1, true);
            var my = view.getFloat64(9, true);
            
            var cell = this.socket.playerTracker.cell;
            if (cell) {
                // Calculate the movement of the cell
                cell.calcMove(mx, my, this.gameServer.border);
                
                // Check if cells nearby (Still buggy)
                var list = this.gameServer.getCellsInRange(cell);
                for (var i = 0; i < list.length ; i++) {
                    //Remove the cells
                    var n = list[i].nodeType;
                    if (n == 1) {
                        this.gameServer.currentFood--;
                    } else if (n == 2) {
                        this.gameServer.currentViruses--;
                    }
                	
                    this.gameServer.removeNode(list[i]);
                    //Add size
                    cell.size += this.gameServer.config.foodMass;
                }
            }
            break;
        case 18: //Q Press (Debug)
            var cell = this.socket.playerTracker.cell;
            if (cell) {
                cell.speed += 10;
            }
            break;
        case 21: //W Press (Debug)
            var cell = this.socket.playerTracker.cell;
            if (cell) {
                cell.size += 10;
            }
            break;
        case 255:
            // Connection
            // Send SetBorder packet first
            var border = this.gameServer.border;
            this.socket.sendPacket(new Packet.SetBorder(border.left, border.right, border.top, border.bottom));
            break;
        default:
            break;
    }
}

PacketHandler.prototype.setNickname = function(newNick) {
    if (!this.socket.playerTracker.cell) {
        this.socket.playerTracker.cell = new Cell(this.gameServer.getNextNodeId(), newNick, this.gameServer.getRandomPosition(), 32.0, 0);
        this.gameServer.addNode(this.socket.playerTracker.cell);
    } else {
        this.socket.playerTracker.cell.name = newNick;
    }
    // Only add player controlled cells with this packet or it will bug the camera
    this.socket.sendPacket(new Packet.AddNodes(this.socket.playerTracker.cell));
}
