function ClearNodes() { }

module.exports = ClearNodes;

ClearNodes.prototype.build = function (protocol) {
    var buffer = new Buffer(1);
    buffer.writeUInt8(protocol>=6 ? 0x12 : 0x14, 0);
    return buffer;
};