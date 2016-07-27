function AddNode(item, scrambleID) {
    this.item = item;
    this.scrambleID = scrambleID;
}

module.exports = AddNode;

AddNode.prototype.build = function() {
    // Only add player controlled cells with this packet or it will bug the camera
    var buf = new ArrayBuffer(5);
    var view = new DataView(buf);

    view.setUint8(0, 32, true);
    view.setUint32(1, this.item.nodeId ^ this.scrambleID, true);

    return buf;
};
