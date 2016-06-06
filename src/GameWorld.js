function GameWorld(gameServer) {
    // Fast and efficient XY tree lookup
    this.xyTree;
    this.gameServer = gameServer;
}

module.exports = GameWorld;

GameWorld.prototype.reset = function(border) {
    // Force cleanup of tree
    this.xyTree.length = 0;
    
    // Generate a new list
    for (var x = border.left; x < border.right; x++) {
        var toAdd = [];
        for (var y = border.top; y < border.bottom; y++) {
           toAdd.push([]); // Add an empty array 
        }
        this.xyTree.push(toAdd);
    }
    
    // List through all current nodes and add them to the list
    for (var i = 0; i < this.gameServer.nodes.length; i++) {
        var node = this.gameServer.nodes[i];
        if (!node) continue;
        
        var pos = node.pos();
        this.xyTree[pos.x][pos.y].push(pos);
    }
};

GameWorld.prototype.addNode = function(node) {
    var pos = node.pos();
    this.xyTree[pos.x][pos.y].push(node);
};

GameWorld.prototype.removeNode = function(node) {
    if (this.xyTree[node.lastPos.x][node.lastPos.y].remove(node) != true) {
        // Log it, it can be a problem
        console.log("[World] Unable to update a node!");
    }
};

// Similar function to removeNode but accesses through pos()
// if the node needs to be completely removed
GameWorld.prototype.deleteNode = function(node) {
    if (this.xyTree[node.pos().x][node.pos().y].remove(node) != true) {
        // Log it, it can be a problem
        console.log("[World] Unable to remove a node!");
    }
};

GameWorld.prototype.updateNode = function(node) {
    // Simple reference
    this.removeNode(node);
    this.addNode(node);
};
