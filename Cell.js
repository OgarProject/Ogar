function Cell(nodeId, name, position, size) {
    this.nodeId = nodeId;
    this.name = name;
    this.color = {r: 0, g: 255, b: 0};
    this.position = position;
    this.size = size;
}

module.exports = Cell;
