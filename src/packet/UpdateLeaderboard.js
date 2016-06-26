// Import
var BinaryWriter = require("./BinaryWriter");


function UpdateLeaderboard(playerTracker, leaderboard, leaderboardType) {
    this.playerTracker = playerTracker;
    this.leaderboard = leaderboard;
    this.leaderboardType = leaderboardType;
}

module.exports = UpdateLeaderboard;

UpdateLeaderboard.prototype.build = function (protocol) {
    switch (this.leaderboardType) {
        case 48: return this.build48(protocol); // UserText
        case 49: return this.build49(protocol); // FFA
        case 50: return this.build50(protocol); // Team
        default: return null;
    }
}

// UserText
UpdateLeaderboard.prototype.build48 = function (protocol) {
    var writer = new BinaryWriter();
    writer.writeUInt8(0x31);                                // Packet ID
    writer.writeUInt32(this.leaderboard.length >>> 0);       // Number of elements
    for (var i = 0; i < this.leaderboard.length; i++) {
        var item = this.leaderboard[i];
        if (item == null) return null;  // bad leaderboardm just don't send it
        
        var name = item;
        name = name ? name : "";
        var id = 0;
        
        writer.writeUInt32(id >> 0);                        // isMe flag/cell ID
        if (protocol <= 5)
            writer.writeStringZeroUnicode(name);
        else
            writer.writeStringZeroUtf8(name);
    }
    return writer.toBuffer();
};

// (FFA) Leaderboard Update
UpdateLeaderboard.prototype.build49 = function (protocol) {
    var player = this.playerTracker;
    if (player.spectate && player.spectateTarget != null) {
        player = player.spectateTarget;
    }
    var writer = new BinaryWriter();
    writer.writeUInt8(0x31);                                // Packet ID
    writer.writeUInt32(this.leaderboard.length >>> 0);       // Number of elements
    for (var i = 0; i < this.leaderboard.length; i++) {
        var item = this.leaderboard[i];
        if (item == null) return null;  // bad leaderboardm just don't send it

        var name = item.getName();
        name = name != null ? name : "";
        var id = item == player ? 1 : 0;
        if (id && protocol < 6 && item.cells.length > 0) {
            // protocol 5- uses player cellId instead of isMe flag
            id = item.cells[0].nodeId ^ this.playerTracker.scrambleId;
        }

        writer.writeUInt32(id >>> 0);                        // isMe flag/cell ID
        if (protocol <= 5)
            writer.writeStringZeroUnicode(name);
        else
            writer.writeStringZeroUtf8(name);
    }
    return writer.toBuffer();
};

// (Team) Leaderboard Update
UpdateLeaderboard.prototype.build50 = function (protocol) {
    var writer = new BinaryWriter();
    writer.writeUInt8(0x32);                                // Packet ID
    writer.writeUInt32(this.leaderboard.length >>> 0);       // Number of elements
    for (var i = 0; i < this.leaderboard.length; i++) {
        var item = this.leaderboard[i];
        if (item == null) return null;  // bad leaderboardm just don't send it
        
        var value = item;
        if (isNaN(value)) value = 0;
        value = value < 0 ? 0 : value;
        value = value > 1 ? 1 : value;
        
        writer.writeFloat(value);                // isMe flag (previously cell ID)
    }
    return writer.toBuffer();
};