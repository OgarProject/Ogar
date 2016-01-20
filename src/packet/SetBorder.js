function SetBorder(left, right, top, bottom) {
    this.left = left;
    this.right = right;
    this.top = top;
    this.bottom = bottom;
}

module.exports = SetBorder;

SetBorder.prototype.build = function() {
    var buf = new ArrayBuffer(33);
    var view = new DataView(buf);

    view.setUint8(0, 64, true);
    view.setFloat64(1, this.left, true);
    view.setFloat64(9, this.top, true);
    view.setFloat64(17, this.right, true);
    view.setFloat64(25, this.bottom, true);

    return buf;
};
