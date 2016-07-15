function UpdatePosition(playerTracker, x, y, scale) {
    this.playerTracker = playerTracker,
    this.x = x;
    this.y = y;
    this.scale = scale;
}

module.exports = UpdatePosition;

UpdatePosition.prototype.build = function (protocol) {
    var buffer = new Buffer(13);
    var offset = 0;
    buffer.writeUInt8(0x11, offset, true);
    offset += 1;
    buffer.writeFloatLE(this.x + this.playerTracker.scrambleX, offset, true);
    offset += 4;
    buffer.writeFloatLE(this.y + this.playerTracker.scrambleY, offset, true);
    offset += 4;
    buffer.writeFloatLE(this.scale, offset, true);
    offset += 4;
    return buffer;
};
