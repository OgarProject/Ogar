function ClearNodes(protocolVersion) {
    this.protocolVersion = protocolVersion;
}

module.exports = ClearNodes;

ClearNodes.prototype.build = function() {
    var buf = new ArrayBuffer(1);
    var view = new DataView(buf);

    view.setUint8(0, this.protocolVersion == 5 ? 20 : 18);

    return buf;
};
