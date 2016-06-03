function UpdateLeaderboard(leaderboard, packetLB) {
    this.leaderboard = leaderboard;
    this.packetLB = packetLB;
}

module.exports = UpdateLeaderboard;

UpdateLeaderboard.prototype.build = function (protocol) {
    var lb = this.leaderboard;
    switch (this.packetLB) {
        case 48:// Custom Text List?
            {
                var offset = 0;
                var buffer = new Buffer(0x10000);
                
                
                buffer.writeUInt8(48, offset);
                offset++;
                
                var countOffset = offset;
                offset += 4;
                
                
                var count = 0;
                
                for (var i = 0; i < lb.length; i++) {
                    if (typeof lb[i] == "undefined")
                        continue;
                    var item = lb[i];
                    
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
            }
            break;

        case 49:// FFA
            {
                var offset = 0;
                var buffer = new Buffer(0x10000);
                
                buffer.writeUInt8(49, offset);                        // Packet ID
                offset += 1;
                
                
                var countOffset = offset;
                offset += 4;
                
                var count = 0;
                for (var i = 0; i < lb.length; i++) {
                    if (typeof lb[i] == "undefined")
                        continue;
                    var item = lb[i];
                    
                    var isMe = false;                                   // 1 for red color (current player), 0 for white color (other players)
                    var name = item.getName();
                    name = name ? name : "";
                    
                    // Write record
                    buffer.writeUInt32LE(isMe ? 1:0, offset);           // isMe flag (previously cell ID)
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
            }
            break;

        case 50:// (Team) Leaderboard Update
            {
                var offset = 0;
                var buffer = new Buffer(0x10000);
                
                buffer.writeUInt8(50, offset);                          // Packet ID
                offset++;
                
                var countOffset = offset;
                offset += 4;
                
                var count = 0;
                for (var i = 0; i < lb.length; i++) {
                    
                    var value = lb[i];
                    
                    // little validation
                    value = value < 0 ? 0 : value;
                    value = value > 1 ? 1 : value;
                    
                    buffer.writeFloatLE(0, offset);                       // string zero terminator
                    offset += 4;
                }
                buffer.writeUInt32LE(count, countOffset);               // Number of elements
                return buffer.slice(0, offset);
            }
            break;

        default:
            break;
    }
};