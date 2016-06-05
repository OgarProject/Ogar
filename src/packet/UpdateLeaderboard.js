// Import
var BinaryWriter = require("./BinaryWriter");


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

// Custom Text List
UpdateLeaderboard.prototype.build48 = function (protocol) {
    var writer = new BinaryWriter();
    writer.writeUInt8(0x31);                                // Packet ID
    writer.writeUInt32(this.leaderboard.length >> 0);       // Number of elements
    for (var i = 0; i < this.leaderboard.length; i++) {
        var item = this.leaderboard[i];
        if (item == null) return null;  // bad leaderboardm just don't send it
        
        var name = item;
        name = name ? name : "";
        var id = 0;
        
        writer.writeUInt32(id >> 0);                        // isMe flag (previously cell ID)
        if (protocol <= 5)
            writer.writeStringZeroUnicode(name);
        else
            writer.writeStringZeroUtf8(name);
    }
    return writer.ToBuffer();
};

// (FFA) Leaderboard Update
UpdateLeaderboard.prototype.build49 = function (protocol) {
    var writer = new BinaryWriter();
    writer.writeUInt8(0x31);                                // Packet ID
    writer.writeUInt32(this.leaderboard.length >> 0);       // Number of elements
    for (var i = 0; i < this.leaderboard.length; i++) {
        var item = this.leaderboard[i];
        if (item == null) return null;  // bad leaderboardm just don't send it

        var isMe = false;  // true for red color (current player), false for white color (other players)
        var name = item.getName();
        name = name != null ? name : "";
        var id = isMe ? 1:0;

        writer.writeUInt32(id >> 0);                        // isMe flag (previously cell ID)
        if (protocol <= 5)
            writer.writeStringZeroUnicode(name);
        else
            writer.writeStringZeroUtf8(name);
    }
    return writer.ToBuffer();
};

// (Team) Leaderboard Update
UpdateLeaderboard.prototype.build50 = function (protocol) {
    var writer = new BinaryWriter();
    writer.writeUInt8(0x32);                                // Packet ID
    writer.writeUInt32(this.leaderboard.length >> 0);       // Number of elements
    for (var i = 0; i < this.leaderboard.length; i++) {
        var item = this.leaderboard[i];
        if (item == null) return null;  // bad leaderboardm just don't send it
        
        var value = item;
        if (isNaN(value)) value = 0;
        value = value < 0 ? 0 : value;
        value = value > 1 ? 1 : value;
        
        writer.writeFloat(value);                // isMe flag (previously cell ID)
    }
    return writer.ToBuffer();
};