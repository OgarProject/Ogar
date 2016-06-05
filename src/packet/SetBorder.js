// Import
var BinaryWriter = require("./BinaryWriter");


function SetBorder(left, right, top, bottom, gameType, serverName) {
    this.left = left;
    this.right = right;
    this.top = top;
    this.bottom = bottom;
    this.gameType = gameType;
    this.serverName = serverName;
}

module.exports = SetBorder;

SetBorder.prototype.build = function(protocol) {
    var writer = new BinaryWriter();
    writer.writeUInt8(0x40);                                // Packet ID
    writer.writeDouble(this.left);
    writer.writeDouble(this.top);
    writer.writeDouble(this.right);
    writer.writeDouble(this.bottom);
    if (this.gameType != null) {
        writer.writeUInt32(this.gameType >> 0);
        var name = this.serverName;
        if (name == null) name = "";
        writer.writeStringZeroUtf8(name);
    }
    return writer.ToBuffer();
};
