function UpdateNodes(destroyQueue, nodes) {
    this.destroyQueue = destroyQueue;
    this.nodes = nodes;
}

module.exports = UpdateNodes;

UpdateNodes.prototype.build = function() {
    
    // Calculate nodes sub packet size before making the data view
    var nodesLength = 0;
    for (var i = 0; i < this.nodes.length; i++) {
        var node = this.nodes[i];
        
        if (typeof node == "undefined") {
            continue;
        }
        
        nodesLength = nodesLength + 16 + (node.getName().length * 2);
    }
    
    var buf = new ArrayBuffer(3 + (this.destroyQueue.length * 22) + nodesLength + 4 + 2 + 4 + (this.nodes.length * 4));
    var view = new DataView(buf);

    view.setUint8(0, 16, true); // Packet ID
    view.setUint16(1, this.destroyQueue.length, true); // Nodes to be destroyed

    var offset = 3;
    for (var i = 0; i < this.destroyQueue.length; i++) {
        var node = this.destroyQueue[i];

        if (typeof node == "undefined") {
            continue;
        }

        view.setUint32(offset, node.getKiller().nodeId, true); // Killer ID
        view.setUint32(offset + 4, node.nodeId, true); // Node ID
        
        offset += 8;
    }

    for (var i = 0; i < this.nodes.length; i++) {
        var node = this.nodes[i];

        if (typeof node == "undefined") {
            continue;
        }
        
        var v = node.getType() == 2 ? 1: 0; // Virus flag
        
        view.setUint32(offset, node.nodeId, true); // Node ID
        view.setUint16(offset + 4, node.position.x, true); // X position
        view.setUint16(offset + 6, node.position.y, true); // Y position
        view.setUint16(offset + 8, node.getSize(), true); // Mass formula: Radius (size) = (mass * mass) / 100
        view.setUint8(offset + 10, node.color.r, true); // Color (R)
        view.setUint8(offset + 11, node.color.g, true); // Color (G)
        view.setUint8(offset + 12, node.color.b, true); // Color (B)
        view.setUint8(offset + 13, v, true); // Flags
        offset += 14;
        
        var name = node.getName();
        if (name) {
            for (var j = 0; j < name.length; j++) {
                var c = name.charCodeAt(j);
                if (c){
                    view.setUint16(offset, c, true);
                }
                offset += 2;
            }
        }

        view.setUint16(offset, 0, true); // End of string
        offset += 2;
    }

    view.setUint32(offset, 0, true); // Terminate node data
    view.setUint32(offset + 4, this.nodes.length, true); // # of active nodes
    view.setUint16(offset + 8, 0, true); // ???

    offset += 10;
    
    for (var i = 0; i < this.nodes.length; i++) {
        var node = this.nodes[i];

        if (typeof node == "undefined") {
            continue;
        }

        view.setUint32(offset, node.nodeId, true);
        offset += 4;
    }

    return buf;
}
