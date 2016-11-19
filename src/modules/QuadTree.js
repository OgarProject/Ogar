function QuadTree(parent, range, maxNodes, maxLevel) {
    this.parent = parent;
    this.level = parent ? parent.level + 1 : 1;

    this.range = range;

    this.nodes = [];
    this.branches = [];

    this.maxNodes = maxNodes;
    this.maxLevel = maxLevel;
}

module.exports = QuadTree;

QuadTree.prototype.add = function(item, split) {
    if (!item) return false;
    if (split == null || split == undefined) split = true;

    if (item instanceof Array) {
        // handle arrays
        for (var i = 0; i < item.length; i++) this.add(item[i], split);
    } else {
        if (!this.range.intersects(item.getRange())) return false;
        if (item.__quad) return false;

        if (this.branches.length > 0) {
            if (this.branches[0].add(item)) return true;
            if (this.branches[1].add(item)) return true;
            if (this.branches[2].add(item)) return true;
            if (this.branches[3].add(item)) return true;

            console.log("[Error] Could not add node into quadtree! Node position: " + item.position);
            return false;
        } else {
            this.nodes.push(item);
            item.__quad = this;
            if (split) this.split();
            return true;
        }
    }
};

QuadTree.prototype.remove = function(item, merge) {
    if (!item) return;
    if (merge == null || merge == undefined) merge = true;

    if (item instanceof Array) {
        // handle arrays
        for (var i = 0; i < item.length; i++) this.remove(item[i], merge);
    } else {
        if (!item.__quad) return;

        var index = item.__quad.nodes.indexOf(item);
        if (index != -1) item.__quad.nodes.splice(index, 1);

        if (merge) item.__quad.merge();
        item.__quad = null;
    }
};

QuadTree.prototype.update = function(item) {
    this.remove(item, false);
    this.add(item, false);
};

QuadTree.prototype.split = function() {
    if (this.branches.length > 0) return;
    if (this.nodes.length < this.maxNodes || this.level >= this.maxLevel - 1) return;

    var split = this.range.split();

    var _1 = new QuadTree(this, split[1], this.maxNodes, this.maxLevel),
        _2 = new QuadTree(this, split[2], this.maxNodes, this.maxLevel),
        _3 = new QuadTree(this, split[3], this.maxNodes, this.maxLevel),
        _4 = new QuadTree(this, split[4], this.maxNodes, this.maxLevel);

    for (var i = 0; i < this.nodes.length; i++) {
        var node = this.nodes[i];
        if (split[1].intersects(node.getRange())) { _1.nodes.push(node); node.__quad = _1; continue; }
        if (split[2].intersects(node.getRange())) { _2.nodes.push(node); node.__quad = _2; continue; }
        if (split[3].intersects(node.getRange())) { _3.nodes.push(node); node.__quad = _3; continue; }
        if (split[4].intersects(node.getRange())) { _4.nodes.push(node); node.__quad = _4; continue; }
    }
    this.clear();
    this.branches = [_1, _2, _3, _4];
};

QuadTree.prototype.merge = function() {
    if (this.branches.length == 0) return;
    var items = this.getNodes();
    if (items.length >= this.maxNodes) return;

    this.clear();
    this.add(items, false);
};

QuadTree.prototype.getNodes = function() {
    if (this.branches.length > 0) {
        var a = [];
        a = a.concat(this.branches[0].getNodes());
        a = a.concat(this.branches[1].getNodes());
        a = a.concat(this.branches[2].getNodes());
        a = a.concat(this.branches[3].getNodes());
        return a;
    } else return this.nodes.slice(0);
};

QuadTree.prototype.getBranches = function() {
    if (this.branches.length > 0) {
        var a = 1;
        a += this.branches[1].getBranches();
        a += this.branches[1].getBranches();
        a += this.branches[1].getBranches();
        a += this.branches[1].getBranches();
        return a;
    } else return 1;
};

QuadTree.prototype.clear = function() {
    this.nodes = [];
    if (this.branches.length > 0) {
        for (var i = 0; i < this.branches.length; i++) this.branches[i].clear();
    }
    this.branches = [];
};

QuadTree.prototype.query = function(range, predicate) {
    var items = [];
    var givenPredicate = predicate instanceof Function;
    if (this.branches.length > 0) {
        items = items.concat(this.branches[0].query(range, predicate));
        items = items.concat(this.branches[1].query(range, predicate));
        items = items.concat(this.branches[2].query(range, predicate));
        items = items.concat(this.branches[3].query(range, predicate));
    } else {
        for (var i = 0; i < this.nodes.length; i++) {
            var node = this.nodes[i];
            if (!node) continue;

            if (range.intersects(node.getRange())) {
                if (givenPredicate) {
                    if (predicate(node)) items.push(node);
                } else items.push(node);
            }
        }
    }

    return items;
};
