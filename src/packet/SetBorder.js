// Import
var ByteBuffer = require("bytebuffer");


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
    var buffer = new ByteBuffer();
    buffer.LE(true);
    buffer.writeUInt8(0x40);
    buffer.writeDouble(this.left);
    buffer.writeDouble(this.top);
    buffer.writeDouble(this.right);
    buffer.writeDouble(this.bottom);
    if (typeof this.gameType != "undefined" && this.gameType != null) {
        buffer.writeUInt32(this.gameType >> 0);
        var name = this.serverName;
        if (typeof name == "undefined" || name == null) {
            name = "";
        }
        buffer.writeUTF8String(name);
        buffer.writeByte(0);
    }
    return buffer.buffer.slice(0, buffer.offset);
};
