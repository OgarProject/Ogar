function UpdatePosition(x, y, size) {
    this.x = x;
    this.y = y;
    this.size = size;
}

module.exports = UpdatePosition;

UpdatePosition.prototype.build = function() {
    var buf = new ArrayBuffer(13);
    var view = new DataView(buf);

    view.setUint8(0, 17, true);
    view.setFloat32(1, this.x, true);
    view.setFloat32(5, this.y, true);
    view.setFloat32(9, this.size, true);

    return buf;
};
