function AddNodes(queue) {
    this.queue = queue;
}

module.exports = AddNodes;

AddNodes.prototype.build = function() {
    var buf = new ArrayBuffer(1 + (this.queue.length * 4));
    var view = new DataView(buf);

    view.setUint8(0, 32, true);
    
    for (var i = 0; i < this.queue.length; i++) {
        var item = this.queue[i];
        if (typeof item == "undefined") {
            continue;
        }

        view.setUint32((4 * i) + 1, item.nodeId, true);
    }

    return buf;
}
