function AddNode(playerTracker, item) {
    this.playerTracker = playerTracker;
    this.item = item;
}

module.exports = AddNode;

AddNode.prototype.build = function (protocol) {
    var buffer = new Buffer(5);
    buffer.writeUInt8(0x20, 0, true);                      // Packet ID
    buffer.writeUInt32LE((this.item.nodeId ^ this.playerTracker.scrambleId) >>> 0, 1, true);
    return buffer;
};
