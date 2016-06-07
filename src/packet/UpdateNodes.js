// Import
var BinaryWriter = require("./BinaryWriter");


function UpdateNodes(destroyQueue, nodes, nonVisibleNodes, scrambleX, scrambleY) {
    this.destroyQueue = destroyQueue;
    this.nodes = nodes;
    this.nonVisibleNodes = nonVisibleNodes;
    this.scrambleX = scrambleX;
    this.scrambleY = scrambleY;
}

module.exports = UpdateNodes;

UpdateNodes.prototype.build = function (protocol) {
    if (!protocol) return null;
    
    if (protocol <= 4) return this.build4();
    else if (protocol == 5) return this.build5();
    else return this.build6();
}

// protocol 4
UpdateNodes.prototype.build4 = function () {
    var writer = new BinaryWriter();
    writer.writeUInt8(0x10);                                // Packet ID
    
    var deadCells = [];
    for (var i = 0; i < this.destroyQueue.length; i++) {
        var node = this.destroyQueue[i];
        if (!node) continue;
        deadCells.push(node);
    }
    writer.writeUInt16(deadCells.length >> 0);            // EatRecordCount
    for (var i = 0; i < deadCells.length; i++) {
        var node = deadCells[i];
        var hunterId = 0;
        if (node.getKiller()) {
            hunterId = node.getKiller().nodeId;
        }
        writer.writeUInt32(hunterId >> 0);               // Hunter ID
        writer.writeUInt32(node.nodeId >> 0);            // Prey ID
    }
    
    for (var i = 0; i < this.nodes.length; i++) {
        var node = this.nodes[i];
        if (node==null || node.nodeId == 0)
            continue;
        
        var cellX = node.position.x + this.scrambleX;
        var cellY = node.position.y + this.scrambleY;
        var cellSize = node.getSize();
        var cellName = node.getName();
        if (!cellName) cellName = "";
        
        
        var isVirus = (node.spiked & 0x01) != 0;
        var isAgitated = false;                // true = high wave amplitude on a cell outline
        var isEject = node.cellType == 3;
        
        // Write update record
        writer.writeUInt32(node.nodeId >> 0);         // Cell ID
        writer.writeInt16(cellX >> 0);                // Coordinate X
        writer.writeInt16(cellY >> 0);                // Coordinate Y
        writer.writeUInt16(cellSize >>> 0);           // Cell Size (not to be confused with mass, because mass = size*size/100)
        writer.writeUInt8(node.color.r >> 0);         // Color R
        writer.writeUInt8(node.color.g >> 0);         // Color G
        writer.writeUInt8(node.color.b >> 0);         // Color B
        
        var flags = 0;
        if (isVirus)
            flags |= 0x01;
        if (isAgitated)
            flags |= 0x10;
        if (isEject)
            flags |= 0x20;
        writer.writeUInt8(flags >> 0);                  // Flags
        writer.writeStringZeroUnicode(cellName);        // Name
    }
    writer.writeUInt32(0);                              // Cell Update record terminator
    
    for (var i = 0; i < this.nonVisibleNodes.length; i++) {
        var node = this.nonVisibleNodes[i];
        if (!node) continue;
        deadCells.push(node);
    }
    writer.writeUInt32(deadCells.length >> 0);          // RemoveRecordCount
    for (var i = 0; i < deadCells.length; i++) {
        var node = deadCells[i];
        writer.writeUInt32(node.nodeId);                // Cell ID
    }
    return writer.ToBuffer();
}

// protocol 5
UpdateNodes.prototype.build5 = function () {
    var writer = new BinaryWriter();
    writer.writeUInt8(0x10);                                // Packet ID
    
    var deadCells = [];
    for (var i = 0; i < this.destroyQueue.length; i++) {
        var node = this.destroyQueue[i];
        if (!node) continue;
        deadCells.push(node);
    }
    writer.writeUInt16(deadCells.length >> 0);              // EatRecordCount
    for (var i = 0; i < deadCells.length; i++) {
        var node = deadCells[i];
        var hunterId = 0;
        if (node.getKiller()) {
            hunterId = node.getKiller().nodeId;
        }
        writer.writeUInt32(hunterId >> 0);                  // Hunter ID
        writer.writeUInt32(node.nodeId >> 0);               // Prey ID
    }
    
    for (var i = 0; i < this.nodes.length; i++) {
        var node = this.nodes[i];
        if (node==null || node.nodeId == 0)
            continue;
        
        var cellX = node.position.x + this.scrambleX;
        var cellY = node.position.y + this.scrambleY;
        var cellSize = node.getSize();
        var skinName = node.getSkin();
        var cellName = node.getName();
        if (!skinName) skinName = "";
        if (!cellName) cellName = "";
        
        
        var isVirus = (node.spiked & 0x01) != 0;
        var isSkinPresent = !isVirus && skinName != null && skinName.length > 0;
        var isAgitated = false;                // true = high wave amplitude on a cell outline
        var isEject = node.cellType == 3;
        
        // Write update record
        writer.writeUInt32(node.nodeId >> 0);         // Cell ID
        writer.writeInt32(cellX >> 0);                // Coordinate X
        writer.writeInt32(cellY >> 0);                // Coordinate Y
        writer.writeUInt16(cellSize >>> 0);           // Cell Size (not to be confused with mass, because mass = size*size/100)
        writer.writeUInt8(node.color.r >> 0);         // Color R
        writer.writeUInt8(node.color.g >> 0);         // Color G
        writer.writeUInt8(node.color.b >> 0);         // Color B
        
        var flags = 0;
        if (isVirus)
            flags |= 0x01;
        if (isSkinPresent)
            flags |= 0x04;
        if (isAgitated)
            flags |= 0x10;
        if (isEject)
            flags |= 0x20;
        writer.writeUInt8(flags >> 0);                  // Flags
        
        if (isSkinPresent)
            writer.writeStringZeroUtf8(skinName);       // Skin Name in UTF8
        
        writer.writeStringZeroUnicode(cellName);        // Cell Name
    }
    writer.writeUInt32(0 >> 0);                         // Cell Update record terminator
    
    for (var i = 0; i < this.nonVisibleNodes.length; i++) {
        var node = this.nonVisibleNodes[i];
        if (!node) continue;
        deadCells.push(node);
    }
    writer.writeUInt32(deadCells.length >> 0);          // RemoveRecordCount
    for (var i = 0; i < deadCells.length; i++) {
        var node = deadCells[i];
        writer.writeUInt32(node.nodeId >> 0);           // Cell ID
    }
    return writer.ToBuffer();
}

// protocol 6
UpdateNodes.prototype.build6 = function () {
    var writer = new BinaryWriter();
    writer.writeUInt8(0x10);                                // Packet ID
    
    var deadCells = [];
    for (var i = 0; i < this.destroyQueue.length; i++) {
        var node = this.destroyQueue[i];
        if (!node) continue;
        deadCells.push(node);
    }
    writer.writeUInt16(deadCells.length >> 0);              // EatRecordCount
    for (var i = 0; i < deadCells.length; i++) {
        var node = deadCells[i];
        var hunterId = 0;
        if (node.getKiller()) {
            hunterId = node.getKiller().nodeId;
        }
        writer.writeUInt32(hunterId >> 0);                  // Hunter ID
        writer.writeUInt32(node.nodeId >> 0);               // Prey ID
    }
    
    for (var i = 0; i < this.nodes.length; i++) {
        var node = this.nodes[i];
        if (node==null || node.nodeId == 0)
            continue;
        
        var cellX = node.position.x + this.scrambleX;
        var cellY = node.position.y + this.scrambleY;
        var cellSize = node.getSize();
        var skinName = node.getSkin();
        var cellName = node.getName();
        
        var isVirus = (node.spiked & 0x01) != 0;
        var isColorPresent = true;             // we always include color
        var isSkinPresent = !isVirus && skinName != null && skinName.length > 0;
        var isNamePresent = !isVirus && cellName != null && cellName.length > 0;
        var isAgitated = false;                // true = high wave amplitude on a cell outline
        var isEject = node.cellType==3;
        
        // Write update record
        writer.writeUInt32(node.nodeId >> 0);         // Cell ID
        writer.writeInt32(cellX >> 0);                // Coordinate X
        writer.writeInt32(cellY >> 0);                // Coordinate Y
        writer.writeUInt16(cellSize >>> 0);           // Cell Size (not to be confused with mass, because mass = size*size/100)
        
        var flags = 0;
        if (isVirus)
            flags |= 0x01;
        if (isColorPresent)
            flags |= 0x02;
        if (isSkinPresent)
            flags |= 0x04;
        if (isNamePresent)
            flags |= 0x08;
        if (isAgitated)
            flags |= 0x10;
        if (isEject)
            flags |= 0x20;
        writer.writeUInt8(flags >> 0);                  // Flags
        
        if (isColorPresent) {
            writer.writeUInt8(node.color.r >> 0);       // Color R
            writer.writeUInt8(node.color.g >> 0);       // Color G
            writer.writeUInt8(node.color.b >> 0);       // Color B
        }
        if (isSkinPresent)
            writer.writeStringZeroUtf8(skinName);       // Skin Name in UTF8
        if (isNamePresent)
            writer.writeStringZeroUtf8(cellName);       // Cell Name in UTF8
    }
    writer.writeUInt32(0);                              // Cell Update record terminator
    
    for (var i = 0; i < this.nonVisibleNodes.length; i++) {
        var node = this.nonVisibleNodes[i];
        if (!node) continue;
        deadCells.push(node);
    }
    writer.writeUInt16(deadCells.length >> 0);          // RemoveRecordCount
    for (var i = 0; i < deadCells.length; i++) {
        var node = deadCells[i];
        writer.writeUInt32(node.nodeId >> 0);           // Cell ID
    }
    return writer.ToBuffer();
}
