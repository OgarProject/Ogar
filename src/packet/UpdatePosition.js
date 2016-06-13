function UpdatePosition(playerTracker, x, y, scale) {
    this.playerTracker = playerTracker,
    this.x = x;
    this.y = y;
    this.scale = scale;
}

module.exports = UpdatePosition;

UpdatePosition.prototype.build = function(protocol) {
    var buffer = new Buffer(13);
    var offset = 0;
    buffer.writeUInt8(0x11, offset);
    offset += 1;
    buffer.writeFloatLE(this.x + this.playerTracker.scrambleX, offset);
    offset += 4;
    buffer.writeFloatLE(this.y + this.playerTracker.scrambleY, offset);
    offset += 4;
    buffer.writeFloatLE(this.scale, offset);
    offset += 4;
    return buffer;
};
