var Vector = require('../modules/Vector');

function Cell(nodeId, owner, startPos, mass, gameServer) {
    this.nodeId = nodeId;
    this.owner = owner; // playerTracker that owns this cell
    this.ticksLeft = 0; // Individual updates
    this.color = {
        r: 0,
        g: 255,
        b: 0
    };
    this.lastPos = new Vector(0, 0); // Required for tracking last position at GameWorld
    this.position = new Vector(0, 0); // The actual position
    this.pos(startPos);
    this._mass = 0;
    this._size = 0;
    this._squareSize = 0;
    this.mass(mass);
    this.hasChanged = true; // Whether should send update
    
    this.cellType = -1; // 0 = Player Cell, 1 = Food, 2 = Virus, 3 = Ejected Mass
    this.spiked = 0; // If 1, then this cell has spikes around it

    this.killedBy; // Cell that ate this cell
    this.gameServer = gameServer;

    this.moveEngine = new Vector(0, 0);
    this.moveEngineDecay = 0.9;
    this.collisionRestoreTicks = 0; // Ticks left before cell starts checking for collision with client's cells
}

module.exports = Cell;

// Fields not defined by the constructor are considered private and need a getter/setter to access from a different class

Cell.prototype.getName = function() {
    if (this.owner)
        return this.owner.name;
    return "";
};

Cell.prototype.getColor = function() {
    if (this.owner)
        return this.owner.color;
    return this.color;
};

Cell.prototype.pos = function(setTo) {
    if (setTo) {
        this.lastPos = this.position;
        this.position = setTo.round();
        this.hasChanged = true;
        // Update GameWorld
        this.gameServer.world.updateNode(this);
    }
    return this.position;
};

Cell.prototype.mass = function(toAdd) {
    if (toAdd) {
        this._mass += toAdd;
        this._squareSize = this._mass * 100;
        this._size = Math.ceil(Math.sqrt(this._squareSize));
        this.hasChanged = true;
    }
    return this._mass;
};

Cell.prototype.size = function() {
    return this.size;
};

Cell.prototype.squareSize = function() {
    return this.squareSize;
};

Cell.prototype.isColliding = function(check) {
    return this.position.sqDistanceTo(check.position) < this._squareSize + check.squareSize();
};

Cell.prototype.moveEngineTick = function() {
    // Move
    this.pos(this.position.clone().add(this.moveEngine));
    
    // Decay move speed
    if (this.moveEngine.distance() > 0) this.hasChanged = true;
    var toDecay = this.moveEngine.scale(this.moveEngineDecay).scale(0.5);
    this.moveEngineDecay.sub(toDecay);
    
    // Border check
    this.borderCheck(true);
    
    // Cell-specific move actions
    this.move();
    
    this.position.round();
};

Cell.prototype.borderCheck = function(flipMoving) {
    if (flipMoving == undefined || flipMoving == null) flipMoving = false;
    
    // Border check - If flipMoving is true then bounce off
    var border = this.gameServer.config.border;
    var checkRadius = this.size() / 2;
    
    if (this.pos.x - checkRadius < border.left) {
        this.pos.x = border.left;
        if (flipMoving) this.moveEngine.flipX();
    }
    
    if (this.pos.y - checkRadius < border.top) {
        this.pos.y = border.top;
        if (flipMoving) this.moveEngine.flipY();
    }
    
    if (this.pos.x + checkRadius < border.right) {
        this.pos.x = border.right;
        if (flipMoving) this.moveEngine.flipX();
    }
    
    if (this.pos.y + checkRadius < border.bottom) {
        this.pos.y = border.bottom;
        if (flipMoving) this.moveEngine.flipY();
    }
};

Cell.prototype.shouldSendUpdate = function() {
    // Whether should send update on next node update packet
    var a = this.hasChanged ? true : false;
    this.hasChanged = false;
    return a;
};

// Override these
Cell.prototype.getEatingRange = function() {
    return this.size() / 3.14;
};
Cell.prototype.move = function() { };   // After moving, designed specially for player cells
Cell.prototype.eat = function() { };    // On tick for eating, designed specially for player cells and ejected mass
Cell.prototype.addMass = function(n) {
    this.mass(n);
};
Cell.prototype.onAdd = function() {
    // Add node to XY tree
    this.gameServer.world.addNode(this);
};
Cell.prototype.onRemove = function() {
    // Remove node from XY tree
    this.gameServer.world.deleteNode(this);
};
Cell.prototype.onConsume = function(consumer) {
    consumer.addMass(this._mass);
};
