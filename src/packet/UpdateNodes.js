// Import
var ByteBuffer = require("bytebuffer");


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
    switch (protocol) {
        case 4: return this.build4();
        case 5: return this.build5();
        case 6:
        case 7: return this.build6();
    }
    return null;
}

// protocol 4
UpdateNodes.prototype.build4 = function () {
    var buffer = new ByteBuffer();
    buffer.LE(true);
    
    var deadCells = [];
    for (var i = 0; i < this.destroyQueue.length; i++) {
        var node = this.destroyQueue[i];
        if (!node) continue;
        deadCells.push(node);
    }
    
    buffer.writeUInt8(0x10);
    buffer.writeUInt16(deadCells.length);            // EatRecordCount
    for (var i = 0; i < deadCells.length; i++) {
        var node = deadCells[i];
        var hunterId = 0;
        if (node.getKiller()) {
            hunterId = node.getKiller().nodeId;
        }
        buffer.writeUInt32(hunterId);               // Hunter ID
        buffer.writeUInt32(node.nodeId);            // Prey ID
    }
    
    for (var i = 0; i < this.nodes.length; i++) {
        var node = this.nodes[i];
        if (typeof node == "undefined" || !node || node.nodeId == 0)
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
        buffer.writeUInt32(node.nodeId);              // Cell ID
        buffer.writeInt16(cellX >> 0);                // Coordinate X
        buffer.writeInt16(cellY >> 0);                // Coordinate Y
        buffer.writeUInt16(cellSize >>> 0);           // Cell Size (not to be confused with mass, because mass = size*size/100)
        buffer.writeUInt8(node.color.r >> 0);         // Color R
        buffer.writeUInt8(node.color.g >> 0);         // Color G
        buffer.writeUInt8(node.color.b >> 0);         // Color B
        
        var flags = 0;
        if (isVirus)
            flags |= 0x01;
        if (isAgitated)
            flags |= 0x10;
        if (isEject)
            flags |= 0x20;
        buffer.writeUInt8(flags >> 0);                  // Flags
        
        for (var j = 0; j < cellName.length && cellName.charCodeAt(j)!=0; j++) {
            buffer.writeUInt16(cellName.charCodeAt(j) >> 0);       // Cell Name in Unicode
        }
        buffer.writeUInt16(0);                          // Zero-terminator
    }
    buffer.writeUInt32(0);                              // Cell Update record terminator
    
    for (var i = 0; i < this.nonVisibleNodes.length; i++) {
        var node = this.nonVisibleNodes[i];
        if (!node) continue;
        deadCells.push(node);
    }
    
    buffer.writeUInt32(deadCells.length);            // RemoveRecordCount
    for (var i = 0; i < deadCells.length; i++) {
        var node = deadCells[i];
        buffer.writeUInt32(node.nodeId);            // Cell ID
    }
    return buffer.buffer.slice(0, buffer.offset);
}

// protocol 5
UpdateNodes.prototype.build5 = function () {
    var buffer = new ByteBuffer();
    buffer.LE(true);
    
    var deadCells = [];
    for (var i = 0; i < this.destroyQueue.length; i++) {
        var node = this.destroyQueue[i];
        if (!node) continue;
        deadCells.push(node);
    }
    
    buffer.writeUInt8(0x10);
    buffer.writeUInt16(deadCells.length);            // EatRecordCount
    for (var i = 0; i < deadCells.length; i++) {
        var node = deadCells[i];
        var hunterId = 0;
        if (node.getKiller()) {
            hunterId = node.getKiller().nodeId;
        }
        buffer.writeUInt32(hunterId);               // Hunter ID
        buffer.writeUInt32(node.nodeId);            // Prey ID
    }
    
    for (var i = 0; i < this.nodes.length; i++) {
        var node = this.nodes[i];
        if (typeof node == "undefined" || !node || node.nodeId == 0)
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
        buffer.writeUInt32(node.nodeId);              // Cell ID
        buffer.writeInt32(cellX >> 0);                // Coordinate X
        buffer.writeInt32(cellY >> 0);                // Coordinate Y
        buffer.writeUInt16(cellSize >>> 0);           // Cell Size (not to be confused with mass, because mass = size*size/100)
        buffer.writeUInt8(node.color.r >> 0);         // Color R
        buffer.writeUInt8(node.color.g >> 0);         // Color G
        buffer.writeUInt8(node.color.b >> 0);         // Color B
        
        var flags = 0;
        if (isVirus)
            flags |= 0x01;
        if (isSkinPresent)
            flags |= 0x04;
        if (isAgitated)
            flags |= 0x10;
        if (isEject)
            flags |= 0x20;
        buffer.writeUInt8(flags >> 0);                  // Flags
        
        if (isSkinPresent) {
            buffer.writeUTF8String(skinName);       // Skin Name in UTF8
            buffer.writeUInt8(0);                   // Zero-terminator
        }
        
        for (var j = 0; j < cellName.length && cellName.charCodeAt(j) != 0; j++) {
            buffer.writeUInt16(cellName.charCodeAt(j) >> 0);       // Cell Name in Unicode
        }
        buffer.writeUInt16(0);                          // Zero-terminator
    }
    buffer.writeUInt32(0);                              // Cell Update record terminator
    
    for (var i = 0; i < this.nonVisibleNodes.length; i++) {
        var node = this.nonVisibleNodes[i];
        if (!node) continue;
        deadCells.push(node);
    }
    
    buffer.writeUInt32(deadCells.length);            // RemoveRecordCount
    for (var i = 0; i < deadCells.length; i++) {
        var node = deadCells[i];
        buffer.writeUInt32(node.nodeId);            // Cell ID
    }
    return buffer.buffer.slice(0, buffer.offset);
}

// protocol 6
UpdateNodes.prototype.build6 = function () {
    var buffer = new ByteBuffer();
    buffer.LE(true);
    
    var deadCells = [];
    for (var i = 0; i < this.destroyQueue.length; i++) {
        var node = this.destroyQueue[i];
        if (!node) continue;
        deadCells.push(node);
    }
    
    buffer.writeUInt8(0x10);
    buffer.writeUInt16(deadCells.length);            // EatRecordCount
    for (var i = 0; i < deadCells.length; i++) {
        var node = deadCells[i];
        var hunterId = 0;
        if (node.getKiller()) {
            hunterId = node.getKiller().nodeId;
        }
        buffer.writeUInt32(hunterId);               // Hunter ID
        buffer.writeUInt32(node.nodeId);            // Prey ID
    }
    
    for (var i = 0; i < this.nodes.length; i++) {
        var node = this.nodes[i];
        if (typeof node == "undefined" || !node || node.nodeId == 0)
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
        buffer.writeUInt32(node.nodeId);            // Cell ID
        buffer.writeInt32(cellX >> 0);                // Coordinate X
        buffer.writeInt32(cellY >> 0);                // Coordinate Y
        buffer.writeUInt16(cellSize >>> 0);           // Cell Size (not to be confused with mass, because mass = size*size/100)
        
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
        buffer.writeUInt8(flags >> 0);                // Flags
        
        if (isColorPresent) {
            buffer.writeUInt8(node.color.r >> 0);     // Color R
            buffer.writeUInt8(node.color.g >> 0);     // Color G
            buffer.writeUInt8(node.color.b >> 0);     // Color B
        }
        if (isSkinPresent) {
            buffer.writeUTF8String(skinName);       // Skin Name in UTF8
            buffer.writeUInt8(0);                   // Zero-terminator
        }
        if (isNamePresent) {
            buffer.writeUTF8String(cellName);       // Cell Name in UTF8
            buffer.writeUInt8(0);                   // Zero-terminator
        }
    }
    buffer.writeUInt32(0);                          // Cell Update record terminator
    
    for (var i = 0; i < this.nonVisibleNodes.length; i++) {
        var node = this.nonVisibleNodes[i];
        if (!node) continue;
        deadCells.push(node);
    }
    
    buffer.writeUInt16(deadCells.length);            // RemoveRecordCount
    for (var i = 0; i < deadCells.length; i++) {
        var node = deadCells[i];
        buffer.writeUInt32(node.nodeId);            // Cell ID
    }
    return buffer.buffer.slice(0, buffer.offset);
}
