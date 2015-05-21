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
            var client = this.socket.playerTracker;
            client.setMouseX(view.getFloat64(1, true));
            client.setMouseY(view.getFloat64(9, true));
            
            var cell = this.socket.playerTracker.cell;
            if (cell) {
                // Calculate the movement of the cell
                cell.calcMove(client.getMouseX(), client.getMouseY(), this.gameServer.border);
                
                // Check if cells nearby (Still buggy)
                var list = this.gameServer.getCellsInRange(cell);
                for (var i = 0; i < list.length ; i++) {
                    //Remove the cells
                    var n = list[i].getType();
                    
                    switch (n) {
                        case 3: // Ejected Mass
                        case 0: // Player Cell
                            cell.size += n.size; // Placeholder until i get the proper formula
                            break;
                        case 1: // Food
                            this.gameServer.currentFood--;
                            cell.size += this.gameServer.config.foodMass;
                            break;
                        case 2: // Virus
                            this.gameServer.currentViruses--;
                            break;
                        default:
                            break;
                    }
                    this.gameServer.removeNode(list[i]);       
                }
            }
            break;
        case 18: //Q Press (Debug)
            var cell = this.socket.playerTracker.cell;
            if (cell) {
                cell.speed += 10;
            }
            break;
        case 21: //W Press
            var cell = this.socket.playerTracker.cell;
            if (cell) {
                var deltaY = this.socket.playerTracker.getMouseY() - cell.getPos().y;
                var deltaX = this.socket.playerTracker.getMouseX() - cell.getPos().x;
                var angle = Math.atan2(deltaX,deltaY);
            	
                // Get starting position
                var startPos = {
                    x: cell.getPos().x + ( (cell.size + this.gameServer.config.ejectStartSize) * Math.sin(angle) ), 
                    y: cell.getPos().y + ( (cell.size + this.gameServer.config.ejectStartSize) * Math.cos(angle) )
                };
                // Create cell
                ejected = new Cell(this.gameServer.getNextNodeId(), "", startPos, this.gameServer.config.ejectStartSize, 3);
                ejected.setAngle(angle);
                ejected.setEnergy(5);
                ejected.setSpeed(50);
            	
                // Add to moving cells list
                this.gameServer.addMovingCell(ejected);
                this.gameServer.addNode(ejected);
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
