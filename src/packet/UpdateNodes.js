// Import
var BinaryWriter = require("./BinaryWriter");


function UpdateNodes(playerTracker, addNodes, updNodes, eatNodes, delNodes) {
    this.playerTracker = playerTracker; 
    this.addNodes = addNodes;
    this.updNodes = updNodes;
    this.eatNodes = eatNodes;
    this.delNodes = delNodes;
}

module.exports = UpdateNodes;

UpdateNodes.prototype.build = function (protocol) {
    if (!protocol) return null;
    
    var writer = new BinaryWriter();
    writer.writeUInt8(0x10);                                // Packet ID
    this.writeEatItems(writer);

    if (protocol < 5) this.writeUpdateItems4(writer);
    else if (protocol == 5) this.writeUpdateItems5(writer);
    else this.writeUpdateItems6(writer);

    this.writeRemoveItems(writer, protocol);
    return writer.toBuffer();
};

// protocol 4
UpdateNodes.prototype.writeUpdateItems4 = function (writer) {
    var scrambleX = this.playerTracker.scrambleX;
    var scrambleY = this.playerTracker.scrambleY;
    var scrambleId = this.playerTracker.scrambleId;

    for (var i = 0; i < this.updNodes.length; i++) {
        var node = this.updNodes[i];
        if (node.nodeId == 0)
            continue;
        var cellX = node.position.x + scrambleX;
        var cellY = node.position.y + scrambleY;
        
        // Write update record
        writer.writeUInt32((node.nodeId ^ scrambleId) >>> 0);         // Cell ID
        writer.writeInt16(cellX >> 0);                // Coordinate X
        writer.writeInt16(cellY >> 0);                // Coordinate Y
        writer.writeUInt16(node.getSize() >>> 0);     // Cell Size (not to be confused with mass, because mass = size*size/100)
        var color = node.getColor();
        writer.writeUInt8(color.r >>> 0);         // Color R
        writer.writeUInt8(color.g >>> 0);         // Color G
        writer.writeUInt8(color.b >>> 0);         // Color B
        
        var flags = 0;
        if (node.spiked)
            flags |= 0x01;      // isVirus
        if (false)
            flags |= 0x10;      // isAgitated
        if (node.cellType == 3)
            flags |= 0x20;      // isEjected
        writer.writeUInt8(flags >>> 0);                  // Flags
        
        writer.writeUInt16(0);                          // Name
    }
    for (var i = 0; i < this.addNodes.length; i++) {
        var node = this.addNodes[i];
        if (node.nodeId == 0)
            continue;
        var cellX = node.position.x + scrambleX;
        var cellY = node.position.y + scrambleY;
        var cellName = node.getName();
        
        // Write update record
        writer.writeUInt32((node.nodeId ^ scrambleId) >>> 0);         // Cell ID
        writer.writeInt16(cellX >> 0);                // Coordinate X
        writer.writeInt16(cellY >> 0);                // Coordinate Y
        writer.writeUInt16(node.getSize() >>> 0);     // Cell Size (not to be confused with mass, because mass = size*size/100)
        var color = node.getColor();
        writer.writeUInt8(color.r >>> 0);         // Color R
        writer.writeUInt8(color.g >>> 0);         // Color G
        writer.writeUInt8(color.b >>> 0);         // Color B
        
        var flags = 0;
        if (node.spiked)
            flags |= 0x01;      // isVirus
        if (false)
            flags |= 0x10;      // isAgitated
        if (node.cellType == 3)
            flags |= 0x20;      // isEjected
        writer.writeUInt8(flags >>> 0);                  // Flags
        
        writer.writeStringZeroUnicode(cellName);        // Name
    }
    writer.writeUInt32(0);                              // Cell Update record terminator
};

// protocol 5
UpdateNodes.prototype.writeUpdateItems5 = function (writer) {
    var scrambleX = this.playerTracker.scrambleX;
    var scrambleY = this.playerTracker.scrambleY;
    var scrambleId = this.playerTracker.scrambleId;
    
    for (var i = 0; i < this.updNodes.length; i++) {
        var node = this.updNodes[i];
        if (node.nodeId == 0)
            continue;
        var cellX = node.position.x + scrambleX;
        var cellY = node.position.y + scrambleY;
        
        // Write update record
        writer.writeUInt32((node.nodeId ^ scrambleId) >>> 0);         // Cell ID
        writer.writeInt32(cellX >> 0);                // Coordinate X
        writer.writeInt32(cellY >> 0);                // Coordinate Y
        writer.writeUInt16(node.getSize() >>> 0);     // Cell Size (not to be confused with mass, because mass = size*size/100)
        var color = node.getColor();
        writer.writeUInt8(color.r >>> 0);         // Color R
        writer.writeUInt8(color.g >>> 0);         // Color G
        writer.writeUInt8(color.b >>> 0);         // Color B
        
        var flags = 0;
        if (node.spiked)
            flags |= 0x01;      // isVirus
        if (false)
            flags |= 0x10;      // isAgitated
        if (node.cellType == 3)
            flags |= 0x20;      // isEjected
        writer.writeUInt8(flags >>> 0);                  // Flags
        
        writer.writeUInt16(0);                          // Cell Name
    }
    for (var i = 0; i < this.addNodes.length; i++) {
        var node = this.addNodes[i];
        if (node.nodeId == 0)
            continue;
        
        var cellX = node.position.x + scrambleX;
        var cellY = node.position.y + scrambleY;
        var skinName = node.getSkin();
        var cellName = node.getName();
        
        // Write update record
        writer.writeUInt32((node.nodeId ^ scrambleId) >>> 0);         // Cell ID
        writer.writeInt32(cellX >> 0);                // Coordinate X
        writer.writeInt32(cellY >> 0);                // Coordinate Y
        writer.writeUInt16(node.getSize() >>> 0);     // Cell Size (not to be confused with mass, because mass = size*size/100)
        var color = node.getColor();
        writer.writeUInt8(color.r >>> 0);         // Color R
        writer.writeUInt8(color.g >>> 0);         // Color G
        writer.writeUInt8(color.b >>> 0);         // Color B
        
        var flags = 0;
        if (node.spiked)
            flags |= 0x01;      // isVirus
        if (!node.spiked && skinName != null && skinName.length > 0)
            flags |= 0x04;      // isSkinPresent
        if (false)
            flags |= 0x10;      // isAgitated
        if (node.cellType == 3)
            flags |= 0x20;      // isEjected
        writer.writeUInt8(flags >>> 0);                  // Flags
        
        if (flags & 0x04)
            writer.writeStringZeroUtf8(skinName);       // Skin Name in UTF8
        
        writer.writeStringZeroUnicode(cellName);        // Cell Name
    }
    writer.writeUInt32(0 >> 0);                         // Cell Update record terminator
};

// protocol 6
UpdateNodes.prototype.writeUpdateItems6 = function (writer) {
    var scrambleX = this.playerTracker.scrambleX;
    var scrambleY = this.playerTracker.scrambleY;
    var scrambleId = this.playerTracker.scrambleId;
    for (var i = 0; i < this.updNodes.length; i++) {
        var node = this.updNodes[i];
        if (node.nodeId == 0)
            continue;
        
        var cellX = node.position.x + scrambleX;
        var cellY = node.position.y + scrambleY;
        
        // Write update record
        writer.writeUInt32((node.nodeId ^ scrambleId) >>> 0);         // Cell ID
        writer.writeInt32(cellX >> 0);                // Coordinate X
        writer.writeInt32(cellY >> 0);                // Coordinate Y
        writer.writeUInt16(node.getSize() >>> 0);     // Cell Size (not to be confused with mass, because mass = size*size/100)
        
        var flags = 0;
        if (node.spiked)
            flags |= 0x01;      // isVirus
        if (node.cellType != 1 && node.cellType != 3)
            flags |= 0x02;      // isColorPresent (do not update for food and ejected mass)
        if (false)
            flags |= 0x10;      // isAgitated
        if (node.cellType == 3)
            flags |= 0x20;      // isEjected
        writer.writeUInt8(flags >>> 0);                  // Flags
        
        if (flags & 0x02) {
            var color = node.getColor();
            writer.writeUInt8(color.r >>> 0);       // Color R
            writer.writeUInt8(color.g >>> 0);       // Color G
            writer.writeUInt8(color.b >>> 0);       // Color B
        }
    }
    for (var i = 0; i < this.addNodes.length; i++) {
        var node = this.addNodes[i];
        if (node.nodeId == 0)
            continue;
        
        var cellX = node.position.x + scrambleX;
        var cellY = node.position.y + scrambleY;
        var skinName = node.getSkin();
        var cellName = node.getName();
        
        // Write update record
        writer.writeUInt32((node.nodeId ^ scrambleId) >>> 0);         // Cell ID
        writer.writeInt32(cellX >> 0);                // Coordinate X
        writer.writeInt32(cellY >> 0);                // Coordinate Y
        writer.writeUInt16(node.getSize() >>> 0);     // Cell Size (not to be confused with mass, because mass = size*size/100)
        
        var flags = 0;
        if (node.spiked)
            flags |= 0x01;      // isVirus
        if (true)
            flags |= 0x02;      // isColorPresent (always for added)
        if (!(node.spiked & 1) && skinName != null && skinName.length > 1)
            flags |= 0x04;      // isSkinPresent
        if (!(node.spiked & 1) && cellName != null && cellName.length > 1)
            flags |= 0x08;      // isNamePresent
        if (false)
            flags |= 0x10;      // isAgitated
        if (node.cellType == 3)
            flags |= 0x20;      // isEjected
        writer.writeUInt8(flags >>> 0);                  // Flags
        
        if (flags & 0x02) {
            var color = node.getColor();
            writer.writeUInt8(color.r >>> 0);       // Color R
            writer.writeUInt8(color.g >>> 0);       // Color G
            writer.writeUInt8(color.b >>> 0);       // Color B
        }
        if (flags & 0x04)
            writer.writeStringZeroUtf8(skinName);       // Skin Name in UTF8
        if (flags & 0x08)
            writer.writeStringZeroUtf8(cellName);       // Cell Name in UTF8
    }
    writer.writeUInt32(0);                              // Cell Update record terminator
};

UpdateNodes.prototype.writeEatItems = function (writer) {
    var scrambleId = this.playerTracker.scrambleId;
    
    writer.writeUInt16(this.eatNodes.length >>> 0);            // EatRecordCount
    for (var i = 0; i < this.eatNodes.length; i++) {
        var node = this.eatNodes[i];
        var hunterId = 0;
        if (node.getKiller()) {
            hunterId = node.getKiller().nodeId;
        }
        writer.writeUInt32((hunterId ^ scrambleId) >>> 0);               // Hunter ID
        writer.writeUInt32((node.nodeId ^ scrambleId) >>> 0);            // Prey ID
    }
};

UpdateNodes.prototype.writeRemoveItems = function (writer, protocol) {
    var scrambleId = this.playerTracker.scrambleId;
    
    var length = this.eatNodes.length + this.delNodes.length;
    if (protocol < 6)
        writer.writeUInt32(length >>> 0);          // RemoveRecordCount
    else
        writer.writeUInt16(length >>> 0);          // RemoveRecordCount
    for (var i = 0; i < this.eatNodes.length; i++) {
        var node = this.eatNodes[i];
        writer.writeUInt32((node.nodeId ^ scrambleId) >>> 0);                // Cell ID
    }
    for (var i = 0; i < this.delNodes.length; i++) {
        var node = this.delNodes[i];
        writer.writeUInt32((node.nodeId ^ scrambleId) >>> 0);                // Cell ID
    }
};
