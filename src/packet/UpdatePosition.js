function UpdatePosition(x, y, size) {
    this.x = x;
    this.y = y;
    this.size = size;
}

module.exports = UpdatePosition;

UpdatePosition.prototype.build = function(protocol) {
    var buffer = new Buffer(13);
    var offset = 0;
    buffer.writeUInt8(0x11, offset);
    offset += 1;
    buffer.writeFloatLE(this.x, offset);
    offset += 4;
    buffer.writeFloatLE(this.y, offset);
    offset += 4;
    buffer.writeFloatLE(this.size, offset);
    offset += 4;
    return buffer;
};
