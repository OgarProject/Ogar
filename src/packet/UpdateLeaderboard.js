function UpdateLeaderboard(leaderboard, packetLB) {
    this.leaderboard = leaderboard;
    this.packetLB = packetLB;
}

module.exports = UpdateLeaderboard;

UpdateLeaderboard.prototype.build = function (protocol) {
    switch (this.packetLB) {
        case 48: return this.build48(protocol); // ?
        case 49: return this.build49(protocol); // FFA
        case 50: return this.build50(protocol); // Team
        default: return null;
    }
}

// Custom Text List? WTF?
UpdateLeaderboard.prototype.build48 = function (protocol) {
    var offset = 0;
    var buffer = new Buffer(0x10000);
    
    buffer.writeUInt8(48, offset);
    offset++;
    
    var countOffset = offset;
    offset += 4;
    
    var count = 0;
    for (var i = 0; i < this.leaderboard.length; i++) {
        var item = this.leaderboard[i];
        if (typeof item == "undefined" || item==null)
            continue;
        
        var name = item;
        name = name ? name : "";
        
        buffer.writeUInt32LE(0, offset);
        offset += 4;
        
        if (protocol <= 5) {
            offset += buffer.write(name, offset, 'ucs2');   // string => unicode
            buffer.writeUInt16LE(0, offset);
            offset += 2;
        }
        else {
            offset += buffer.write(name, offset);           // string => utf8
            buffer.writeUInt8(0, offset);                   // string zero terminator
            offset += 1;
        }
        count++;
    }
    buffer.writeUInt32LE(count, countOffset);               // Number of elements
    return buffer.slice(0, offset);
};

// (FFA) Leaderboard Update
UpdateLeaderboard.prototype.build49 = function (protocol) {
    var offset = 0;
    var buffer = new Buffer(0x10000);
    
    buffer.writeUInt8(49, offset);                        // Packet ID
    offset += 1;
    
    var countOffset = offset;
    offset += 4;
    
    var count = 0;
    for (var i = 0; i < this.leaderboard.length; i++) {
        var item = this.leaderboard[i];
        if (typeof item == "undefined" || item==null)
            continue;
        
        var isMe = false;                                   // 1 for red color (current player), 0 for white color (other players)
        var name = item.getName();
        name = name ? name : "";
        var id = isMe ? 1:0;
        
        // Write record
        buffer.writeUInt32LE(id>>0, offset);                // isMe flag (previously cell ID)
        offset += 4;
        
        if (protocol <= 5) {
            offset += buffer.write(name, offset, 'ucs2');   // string => unicode
            buffer.writeUInt16LE(0, offset);
            offset += 2;
        }
        else {
            offset += buffer.write(name, offset);           // string => utf8
            buffer.writeUInt8(0, offset);                   // string zero terminator
            offset += 1;
        }
        count++;
    }
    buffer.writeUInt32LE(count, countOffset);               // Number of elements
    return buffer.slice(0, offset);
};

// (Team) Leaderboard Update
UpdateLeaderboard.prototype.build50 = function (protocol) {
    var offset = 0;
    var buffer = new Buffer(0x10000);
    
    buffer.writeUInt8(50, offset);                          // Packet ID
    offset++;
    
    var countOffset = offset;
    offset += 4;
    
    var count = 0;
    for (var i = 0; i < this.leaderboard.length; i++) {
        var value = this.leaderboard[i];
        if (value==null) continue;
        
        // little validation
        value = value < 0 ? 0 : value;
        value = value > 1 ? 1 : value;
        
        buffer.writeFloatLE(value, offset);                       // string zero terminator
        offset += 4;
        
        count++;
    }
    buffer.writeUInt32LE(count, countOffset);               // Number of elements
    return buffer.slice(0, offset);
};