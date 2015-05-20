function Cell(nodeId, name, position, size) {
    this.nodeId = nodeId;
    this.name = name;
    this.color = {r: 0, g: 255, b: 0};
    this.position = position;
    this.size = size; //Size 32.0 = 10 in game size
    this.speed = 20; //Filler, will be changed later
}

module.exports = Cell;

Cell.prototype.calcMove = function(x2,y2) {
    //Thank you google
    var x1 = this.position.x;
    var y1 = this.position.y;
	
    var dx = Math.abs(x2 - x1);
    var dy = Math.abs(y2 - y1);
	
    var sx = (x1 < x2) ? 1 : -1;
    var sy = (y1 < y2) ? 1 : -1;
    var err = dx - dy;
    var dist = this.speed;
	
    while (!((x1 == x2) && (y1 == y2)) && (dist > 0)) {
        var e2 = err << 1;
        if (e2 > -dy){
            err -= dy;
            x1 += sx;
    	}
        if (e2 < dx) {
            err += dx;
            y1 += sy;
        }
    dist--;
    }
	
    this.position.x = x1;
    this.position.y = y1;
}
