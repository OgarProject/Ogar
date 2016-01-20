function DrawLine(x, y) {
    this.x = x;
    this.y = y;
}

module.exports = DrawLine;

DrawLine.prototype.build = function() {
    var buf = new ArrayBuffer(5);
    var view = new DataView(buf);

    view.setUint8(0, 21, true);
    view.setUint16(1, this.x, true);
    view.setUint16(3, this.y, true);

    return buf;
};
