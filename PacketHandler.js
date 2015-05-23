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
			
            for (var i = 0; i < client.cells.length; i++){
                var cell = client.cells[i];
				
                if (!cell) {
                    continue;
                }
				
                cell.calcMove(client.getMouseX(), client.getMouseY(), this.gameServer.border);
                
                // Check if cells nearby (Still buggy)
                var list = this.gameServer.getCellsInRange(cell);
                for (var j = 0; j < list.length ; j++) {
                    //Remove the cells
                    var n = list[j].getType();
                    
                    switch (n) {
                        case 3: // Ejected Mass
                            cell.mass += this.gameServer.config.ejectMassGain;
                            break;                      	
                        case 0: // Player Cell
                            cell.mass += list[j].mass;
                            break;
                        case 1: // Food
                            this.gameServer.currentFood--;
                            cell.mass += this.gameServer.config.foodMass;
                            break;
                        case 2: // Virus - viruses do not give mass when eaten
                            this.gameServer.currentViruses--;
                            // Split (Placeholder formula)
                            var n = this.gameServer.config.playerMaxCells - client.cells.length; // Get amount of splits
                            var angle = 0;
                            var splitMass = 16; // Filler
                            
                            for (var k = 0; k < n; k++) {
                                angle += 2/n; // Get directions of splitting cells
                                this.newCellVirused(client, cell, angle, splitMass);
                            }
                            cell.mass = cell.mass / 2; // Filler
                            break;
                        default:
                            break;
                    }
                    this.gameServer.removeNode(list[j]); 
                }
            }
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
                    continue;
                }
                
                if (cell.mass < this.gameServer.config.playerMinMassSplit) {
                    continue;
                }
				
                // Get angle
                var deltaY = client.getMouseY() - cell.getPos().y;
                var deltaX = client.getMouseX() - cell.getPos().x;
                var angle = Math.atan2(deltaX,deltaY);
            	
                // Get starting position
                var size = cell.getSize() + 10;
                var startPos = {
                    x: cell.getPos().x + ( (size + this.gameServer.config.ejectMass) * Math.sin(angle) ), 
                    y: cell.getPos().y + ( (size + this.gameServer.config.ejectMass) * Math.cos(angle) )
                };
                // Calculate mass of splitting cell
                var newMass = cell.mass / 2;
                cell.mass = newMass;
                // Create cell
                split = new Cell(this.gameServer.getNextNodeId(), client, startPos, newMass, 0);
                split.setAngle(angle);
                split.setMoveEngineData(140, 10);
                split.setRecombineTicks(this.gameServer.config.playerRecombineTime);
            	
                // Add to moving cells list
                this.gameServer.setAsMovingNode(split);
                this.gameServer.addNode(split);
            }
            break;
		case 18: // Q - Debug purposes
            var client = this.socket.playerTracker;
            for (var i = 0; i < client.cells.length; i++) {
                var cell = client.cells[i];
				
                if (!cell) {
                    continue;
                }
				
                cell.mass += 100;
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
				
                var deltaY = client.getMouseY() - cell.getPos().y;
                var deltaX = client.getMouseX() - cell.getPos().x;
                var angle = Math.atan2(deltaX,deltaY);
            	
                // Get starting position
                var size = cell.getSize();
                var startPos = {
                    x: cell.getPos().x + ( (size + this.gameServer.config.ejectMass) * Math.sin(angle) ), 
                    y: cell.getPos().y + ( (size + this.gameServer.config.ejectMass) * Math.cos(angle) )
                };
                // Remove mass from parent cell
                cell.mass -= this.gameServer.config.ejectMass;
                // Create cell
                ejected = new Cell(this.gameServer.getNextNodeId(), null, startPos, this.gameServer.config.ejectMass, 3);
                ejected.setAngle(angle);
                ejected.setMoveEngineData(200, 10);
            	
                // Add to moving cells list
                this.gameServer.addNode(ejected);
                this.gameServer.setAsMovingNode(ejected);
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
    var client = this.socket.playerTracker;
    if (client.cells.length < 1) {
        // If client has no cells...
        var cell = new Cell(this.gameServer.getNextNodeId(), client, this.gameServer.getRandomPosition(), this.gameServer.config.playerStartMass, 0);
        this.gameServer.addNode(cell);
    }
	client.setName(newNick);
}

PacketHandler.prototype.newCellVirused = function(client, parent, angle, mass) {
    // Starting position
	var startPos = {
        x: parent.getPos().x, 
        y: parent.getPos().y
    };
	
	// Create cell
	newCell = new Cell(this.gameServer.getNextNodeId(), client, startPos, mass, 0);
	newCell.setAngle(angle);
	newCell.setMoveEngineData(300, 5);
	newCell.setRecombineTicks(this.gameServer.config.playerRecombineTime);
	newCell.setCollisionOff(true); // Turn off collision
	
    // Add to moving cells list
    this.gameServer.addNode(newCell);
    this.gameServer.setAsMovingNode(newCell);
}
