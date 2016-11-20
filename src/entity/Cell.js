var Vector = require('../modules/Vector');
var Rectangle = require('../modules/Rectangle');

function Cell(nodeId, owner, position, mass, gameServer) {
    this.nodeId = nodeId;
    this.owner = owner; // playerTracker that owns this cell
    this.updateTime = new Date(); // Individual updates

    this.color = {
        r: 0,
        g: 0,
        b: 0
    };
    this.position;
    if (position) this.position = new Vector(position.x, position.y);
    this.mass = mass; // Starting mass of the cell
    this.__mass = null;
    this.cellType = -1; // 0 = Player Cell, 1 = Food, 2 = Virus, 3 = Ejected Mass
    this.spiked = 0; // If 1, then this cell has spikes around it

    this.killedBy; // Cell that ate this cell
    this.gameServer = gameServer;

    this.moveEngine = new Vector();
}

module.exports = Cell;

// Fields not defined by the constructor are considered private and need a getter/setter to access from a different class

Cell.prototype.getName = function() {
    if (this.owner) {
        return this.owner.name;
    } else {
        return "";
    }
};

Cell.prototype.setColor = function(color) {
    this.color.r = color.r;
    this.color.g = color.g;
    this.color.b = color.b;
};

Cell.prototype.getColor = function() {
    return this.color;
};

Cell.prototype.getSize = function() {
    if (this.mass == this.__smass) return this.__size;
    // Calculates radius based on cell mass
    return this.__size = Math.sqrt(100 * this.mass) >> 0;
};

Cell.prototype.getSquareSize = function() {
    if (this.mass == this.__Smass) return this.__sqSize;
    // R * R
    return this.__sqSize = (100 * this.mass >> 0);
};

Cell.prototype.addMass = function(n) {
    this.mass += n;
};

Cell.prototype.getKiller = function() {
    return this.killedBy;
};

Cell.prototype.setKiller = function(cell) {
    this.killedBy = cell;
};

Cell.prototype.getRange = function() {
    var sz = this.getSize();
    return new Rectangle(this.position.x, this.position.y, sz, sz);
};

Cell.prototype.moveEngineTick = function(config) {
    if (!this.gameServer) return;
    this.position.sub(this.moveEngine);

    this.moveEngine.scale(0.89);

    // Check for border passage
    this.borderCheck(true);
};

Cell.prototype.borderCheck = function(flipMoving) {
    if (flipMoving == undefined || flipMoving == null) flipMoving = false;

    // Border check - If flipMoving is true then bounce off
    var border = this.gameServer.borders();
    var checkRadius = this.getSize() / 2;

    if (this.position.x - checkRadius < border.left) {
        if (flipMoving) this.moveEngine.flipX();
        this.position.x = border.left + checkRadius;
    }

    if (this.position.x + checkRadius > border.right) {
        if (flipMoving) this.moveEngine.flipX();
        this.position.x = border.right - checkRadius;
    }

    if (this.position.y - checkRadius < border.top) {
        if (flipMoving) this.moveEngine.flipY();
        this.position.y = border.top + checkRadius;
    }

    if (this.position.y + checkRadius > border.bottom) {
        if (flipMoving) this.moveEngine.flipY();
        this.position.y = border.bottom - checkRadius;
    }
};

// Override these
Cell.prototype.sendUpdate = function() {
    // Whether or not to include this cell in the update packet
    return true;
};

Cell.prototype.onConsume = function(consumer, gameServer) {
    // Called when the cell is consumed
    consumer.addMass(this.mass);
};

Cell.prototype.onAdd = function(gameServer) {
    // Called when this cell is added to the world
};

Cell.prototype.onRemove = function() {
    // Called when this cell is removed
};

Cell.prototype.eat = function() {
    // Calld on tick for eating
};

Cell.prototype.move = function(gameServer) {
    // Called on each auto move engine tick
};
