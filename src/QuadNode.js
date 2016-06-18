'use strict';
/*
 * Fast and easy Quad-Tree implementation written by Barbosik.
 * Useful for quick object search in the area specified with bounds.
 *
 * Copyright (c) 2016 Barbosik https://github.com/Barbosik
 * License: Apache License, Version 2.0
 *
 */

function QuadNode(bound, maxChildren, maxLevel, level, parent) {
    if (!level) level = 0;
    if (!parent) parent = null;
    var width = bound.maxx - bound.minx;
    var height = bound.maxy - bound.miny;
    
    this.level = level;
    this.parent = parent;
    this.bound = {
        minx: bound.minx, 
        miny: bound.miny,
        maxx: bound.maxx,
        maxy: bound.maxy,
        width: width,
        height: height,
        cx: bound.minx + width / 2,
        cy: bound.miny + height / 2
    };
    this.maxChildren = maxChildren;
    this.maxLevel = maxLevel;
    this.childNodes = [];
    this.items = [];
}

module.exports = QuadNode;

QuadNode.prototype.insert = function (item) {
    if (item._quadNode != null) {
        throw new TypeError("QuadNode.insert: cannot insert item which already belong to another QuadNode!");
    }
    if (this.childNodes.length != 0) {
        var quad = this.getQuad(item.bound);
        if (quad != -1) {
            this.childNodes[quad].insert(item);
            return;
        }
    }
    this.items.push(item);
    item._quadNode = this;  // attached field, used for quick search quad node by item
    
    // check if rebalance needed
    if (this.childNodes.length != 0 || this.level >= this.maxLevel || this.items.length < this.maxChildren)
        return;
    // split and rebalance current node
    if (this.childNodes.length == 0) {
        // split
        var w = this.bound.width / 2;
        var h = this.bound.height / 2;
        var x0 = this.bound.minx + w;
        var y0 = this.bound.miny;
        var x1 = this.bound.minx;
        var y1 = this.bound.miny;
        var x2 = this.bound.minx;
        var y2 = this.bound.miny + h;
        var x3 = this.bound.minx + w;
        var y3 = this.bound.miny + h;
        var b0 = { minx: x0, miny: y0, maxx: x0 + w, maxy: y0 + h };
        var b1 = { minx: x1, miny: y1, maxx: x1 + w, maxy: y1 + h };
        var b2 = { minx: x2, miny: y2, maxx: x2 + w, maxy: y2 + h };
        var b3 = { minx: x3, miny: y3, maxx: x3 + w, maxy: y3 + h };
        this.childNodes.push(new QuadNode(b0, this.maxChildren, this.maxLevel, this.level + 1, this));
        this.childNodes.push(new QuadNode(b1, this.maxChildren, this.maxLevel, this.level + 1, this));
        this.childNodes.push(new QuadNode(b2, this.maxChildren, this.maxLevel, this.level + 1, this));
        this.childNodes.push(new QuadNode(b3, this.maxChildren, this.maxLevel, this.level + 1, this));
    }
    // rebalance
    for (var i = 0; i < this.items.length; ) {
        var qitem = this.items[i];
        var quad = this.getQuad(qitem.bound);
        if (quad != -1) {
            this.items.splice(i, 1);
            qitem._quadNode = null;
            this.childNodes[quad].insert(qitem);
        }
        else i++;
    }
};

QuadNode.prototype.remove = function (item) {
    if (item._quadNode != this) {
        item._quadNode.remove(item);
        return;
    }
    var index = this.items.indexOf(item);
    if (index < 0) {
        throw new TypeError("QuadNode.remove: item not found!");
    }
    this.items.splice(index, 1);
    item._quadNode = null;
    // TODO: collapse node if empty
};

QuadNode.prototype.update = function (item) {
    this.remove(item);
    this.insert(item);
};

QuadNode.prototype.clear = function () {
    for (var i = 0; i < this.items.length; i++)
        this.items[i]._quadNode = null;
    this.items = [];
    for (var i = 0; i < this.childNodes.length; i++)
        this.childNodes[i].clear();
    this.childNodes = [];
};

QuadNode.prototype.contains = function (item) {
    if (item._quadNode == null)
        return false;
    if (item._quadNode != this) {
        return item._quadNode.contains(item);
    }
    return this.items.indexOf(item) >= 0;
};

QuadNode.prototype.find = function (bound, callback) {
    if (this.childNodes.length != 0) {
        var quad = this.getQuad(bound);
        if (quad != -1) {
            this.childNodes[quad].find(bound, callback);
        } else {
            for (var i = 0; i < this.childNodes.length; i++) {
                var node = this.childNodes[i];
                if (checkBoundIntersection(node.bound, bound))
                    node.find(bound, callback);
            }
        }
    }
    for (var i = 0; i < this.items.length; i++) {
        var item = this.items[i];
        if (checkBoundIntersection(item.bound, bound))
            callback(item);
    }
};

QuadNode.prototype.any = function (bound, predicate) {
    if (this.childNodes.length != 0) {
        var quad = this.getQuad(bound);
        if (quad != -1) {
            if (this.childNodes[quad].any(bound, predicate))
                return true;
        } else {
            for (var i = 0; i < this.childNodes.length; i++) {
                var node = this.childNodes[i];
                if (checkBoundIntersection(node.bound, bound))
                    if (node.any(bound, predicate))
                        return true;
            }
        }
    }
    for (var i = 0; i < this.items.length; i++) {
        var item = this.items[i];
        if (checkBoundIntersection(item.bound, bound)) {
            if (predicate == null || predicate(item))
                return true;
        }
    }
    return false;
};

// Returns quadrant for the bound.
// Returns -1 if bound cannot completely fit within a child node
QuadNode.prototype.getQuad = function (bound) {
    var isTop = bound.miny < this.bound.cy && bound.maxy < this.bound.cy;
    var isLeft = bound.minx < this.bound.cx && bound.maxx < this.bound.cx;
    if (isLeft) {
        if (isTop) return 1;
        else if (bound.miny > this.bound.cy) return 2; // isBottom
    }
    else if (bound.minx > this.bound.cx) // isRight
    {
        if (isTop) return 0;
        else if (bound.miny > this.bound.cy) return 3; // isBottom
    }
    return -1;  // cannot fit (too large size)
};

function checkBoundIntersection(bound1, bound2) {
    var notIntersect = 
        bound2.minx >= bound1.maxx ||
        bound2.maxx <= bound1.minx ||
        bound2.miny >= bound1.maxy ||
        bound2.maxy <= bound1.miny;
    return !notIntersect;
};
