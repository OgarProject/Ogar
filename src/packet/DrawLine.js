function DrawLine(x, y) {
    this.x = x;
    this.y = y;
}

module.exports = DrawLine;

DrawLine.prototype.build = function (protocol) {
    var buffer = new Buffer(5);
    buffer.writeUInt8(0x15, 0);
    buffer.writeInt16LE(this.x, 1, true);
    buffer.writeInt16LE(this.y, 3, true);
    return buffer;
};
