// Import
var BinaryWriter = require("./BinaryWriter");


function SetBorder(playerTracker, border, gameType, serverName) {
    this.playerTracker = playerTracker;
    this.border = border;
    this.gameType = gameType;
    this.serverName = serverName;
}

module.exports = SetBorder;

SetBorder.prototype.build = function(protocol) {
    var writer = new BinaryWriter();
    writer.writeUInt8(0x40);                                // Packet ID
    writer.writeDouble(this.border.minx + this.playerTracker.scrambleX);
    writer.writeDouble(this.border.miny + this.playerTracker.scrambleY);
    writer.writeDouble(this.border.maxx + this.playerTracker.scrambleX);
    writer.writeDouble(this.border.maxy + this.playerTracker.scrambleY);
    if (this.gameType != null) {
        writer.writeUInt32(this.gameType >> 0);
        var name = this.serverName;
        if (name == null) name = "";
        writer.writeStringZeroUtf8(name);
    }
    return writer.toBuffer();
};
