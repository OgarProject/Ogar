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
        
        nodesLength = nodesLength + 22 + (node.name.length * 2);
    }
    
    // DEBUG
    //console.log("Destroy: "+this.destroyQueue.length+" Alive: "+ this.nodes.length);
    
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
        
        var v = 0; // Virus flag
        if (node.nodeType == 2) {
        	v = 1;
        } 

        view.setUint32(offset, node.nodeId, true); // Node ID
        view.setFloat32(offset + 4, node.position.x, true); // X position
        view.setFloat32(offset + 8, node.position.y, true); // Y position
        view.setFloat32(offset + 12, node.size, true); // Size
        view.setUint8(offset + 16, node.color.r, true); // Color (R)
        view.setUint8(offset + 17, node.color.g, true); // Color (G)
        view.setUint8(offset + 18, node.color.b, true); // Color (B)
        view.setUint8(offset + 19, v, true); // Flags
        offset += 20;
        
        view.setUint16(offset, 0, true); // Name
        offset += 2;
    }

    for (var i = 0; i < this.nodes.length; i++) {
        var node = this.nodes[i];

        if (typeof node == "undefined") {
            continue;
        }
        
        var v = 0; // Virus flag
        if (node.nodeType == 2) {
        	v = 1;
        } 

        view.setUint32(offset, node.nodeId, true); // Node ID
        view.setFloat32(offset + 4, node.position.x, true); // X position
        view.setFloat32(offset + 8, node.position.y, true); // Y position
        view.setFloat32(offset + 12, node.size, true); // Size
        view.setUint8(offset + 16, node.color.r, true); // Color (R)
        view.setUint8(offset + 17, node.color.g, true); // Color (G)
        view.setUint8(offset + 18, node.color.b, true); // Color (B)
        view.setUint8(offset + 19, v, true); // Flags
        offset += 20;
        
        if (node.name) {
            for (var j = 0; j < node.name.length; j++) {
                var c = node.name.charCodeAt(j);
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
    view.setUint16(offset + 4, 0, true); // ?
    view.setUint32(offset + 6, this.nodes.length, true); // # of active nodes

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
