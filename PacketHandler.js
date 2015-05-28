var Entity = require('./entity');
var Packet = require('./packet');

function PacketHandler(gameServer, socket) {
    this.gameServer = gameServer;
    this.socket = socket;
    this.properInit = false;
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
    
    // Client with mods tried to connect
    if (packetId != 254 && !this.properInit && !this.gameServer.config.serverAllowMods) {
        console.log("[Game] Client at %s tried to connect with mods enabled.", this.socket.remoteAddress);
        this.socket.close();
    }

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
            break;
		case 17: // Space Press - Split cell
            var client = this.socket.playerTracker;
            var len = client.cells.length;
            for (var i = 0; i < len; i++) {
                var cell = client.cells[i];
				
                if (client.cells.length >= this.gameServer.config.playerMaxCells) {
                    // Player cell limit
                    continue;
                }

                if (!cell) {
                    console.log("[Warning] Tried to split a non existing cell.");
                    continue;
                }
                
                if (cell.mass < this.gameServer.config.playerMinMassSplit) {
                    continue;
                }
				
                // Get angle
                var deltaY = client.getMouseY() - cell.position.y;
                var deltaX = client.getMouseX() - cell.position.x;
                var angle = Math.atan2(deltaX,deltaY);
            	
                // Get starting position
                var size = cell.getSize();
                var startPos = {
                    x: cell.position.x + ( (size + this.gameServer.config.ejectMass) * Math.sin(angle) ), 
                    y: cell.position.y + ( (size + this.gameServer.config.ejectMass) * Math.cos(angle) )
                };
                // Calculate mass of splitting cell
                var newMass = cell.mass / 2;
                cell.mass = newMass;
                // Create cell
                split = new Entity.PlayerCell(this.gameServer.getNextNodeId(), client, startPos, newMass);
                split.setAngle(angle);
                split.setMoveEngineData(120 + cell.getSpeed(), 10);
                split.setRecombineTicks(this.gameServer.config.playerRecombineTime);
            	
                // Add to moving cells list
                this.gameServer.setAsMovingNode(split);
                this.gameServer.addNode(split);
            }
            break;
        case 21: // W Press - Eject mass
            var client = this.socket.playerTracker;
            for (var i = 0; i < client.cells.length; i++) {
                var cell = client.cells[i];
				
                if (!cell) {
                    continue;
                }
                
                if (cell.mass < this.gameServer.config.playerMinMassEject) {
                    continue;
                }
				
                var deltaY = client.getMouseY() - cell.position.y;
                var deltaX = client.getMouseX() - cell.position.x;
                var angle = Math.atan2(deltaX,deltaY);
            	
                // Get starting position
                var size = cell.getSize() + 5;
                var startPos = {
                    x: cell.position.x + ( (size + this.gameServer.config.ejectMass) * Math.sin(angle) ), 
                    y: cell.position.y + ( (size + this.gameServer.config.ejectMass) * Math.cos(angle) )
                };
                // Remove mass from parent cell
                cell.mass -= this.gameServer.config.ejectMass;
                // Create cell
                ejected = new Entity.EjectedMass(this.gameServer.getNextNodeId(), null, startPos, this.gameServer.config.ejectMass);
                ejected.setAngle(angle);
                ejected.setMoveEngineData(this.gameServer.config.ejectSpeed, 10);
                ejected.setColor(cell.getColor());
            	
                // Add to moving cells list
                this.gameServer.addNode(ejected);
                this.gameServer.setAsMovingNode(ejected);
            }
            break;
        case 254:
            this.properInit = true;
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
    var client = this.socket.playerTracker;
    if (client.cells.length < 1) {
        // If client has no cells...
        var pos = this.gameServer.getRandomPosition();
        var cell = new Entity.PlayerCell(this.gameServer.getNextNodeId(), client, pos, this.gameServer.config.playerStartMass);
        this.gameServer.addNode(cell);
        
        // Set initial mouse coords
        client.setMouseX(pos.x);
        client.setMouseY(pos.y);
    }
	client.setName(newNick);
}

