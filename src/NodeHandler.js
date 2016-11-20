var Entity = require('./entity');
var Vector = require('./modules/Vector');

function getTime(a) {
    return a[0] * 1000 + a[1] / 1000000;
}

function NodeHandler(gameServer, collisionHandler) {
    this.gameServer = gameServer;
    this.collisionHandler = collisionHandler;

    this.movingNodes = [];
}

module.exports = NodeHandler;

NodeHandler.prototype.update = function() {
    // Start recording time needed to update nodes
    var tStart = process.hrtime();
    var tCs = tStart,
        tCCS = 0,
        tCES = 0,
        tCUS = {
            move: 0,
            eat: 0,
            recombine: 0,
            decay: 0
        };

    // Spawning food & viruses
    var foodSpawn = Math.min(this.gameServer.config.foodMaxAmount - this.gameServer.nodesFood.length,
        this.gameServer.config.foodSpawnAmount);
    this.addFood(foodSpawn);

    var virusSpawn = this.gameServer.config.virusMinAmount - this.gameServer.nodesVirus.length;
    this.addViruses(virusSpawn);

    // Preset mass decay
    var massDecay = 1 - (this.gameServer.config.playerMassDecayRate * this.gameServer.gameMode.decayMod / 25);

    // First update client's cells
    var len = this.gameServer.clients.length;
    for (var i = 0; i < len; i++) {
        var client = this.gameServer.clients[i];
        if (!client) continue;
        if (client.fullyDisconnected) continue;

        client = client.playerTracker;

        // Merge override check
        if (client.cells.length <= 1)
            client.mergeOverride = false;

        // Precalculate decay multiplier
        var thisDecay;
        if (this.gameServer.config.serverTeamingAllowed == 0) {
            // Anti-teaming is on
            var teamMult = (client.massDecayMult - 1) / 3333 + 1; // Calculate anti-teaming multiplier for decay
            thisDecay = 1 - (1 - massDecay * (1 / teamMult)); // Apply anti-teaming multiplier
        } else {
            // Anti-teaming is off
            thisDecay = massDecay;
        }

        var tCEs = process.hrtime();

        // Update the cells
        var lenc = client.cells.length;
        for (var j = 0; j < lenc; j++) {
            var cell = client.cells[j];
            if (!cell) continue;
            if (cell.eaten) continue;

            var t1s = process.hrtime();

            // Move engine
            cell.move();
            this.gameServer.gameMode.onCellMove(cell, this.gameServer);

            var t1e = process.hrtime(t1s),
                t2s = process.hrtime();

            // Collision restoring
            if (cell.collisionRestoreTicks > 0) cell.collisionRestoreTicks--;

            // Eating
            cell.eat();

            var t2e = process.hrtime(t2s),
                t3s = process.hrtime();

            // Recombining
            if (client.cells.length > 1) cell.recombineTicks += 0.04;
            else cell.recombineTicks = 0;
            cell.calcMergeTime(this.gameServer.config.playerRecombineTime);

            var t3e = process.hrtime(t3s),
                t4s = process.hrtime();

            // Mass decay
            if (cell.mass >= this.gameServer.config.playerMinMassDecay)
                cell.mass *= thisDecay;

            var t4e = process.hrtime(t4s);
            tCUS.move += getTime(t1e);
            tCUS.eat += getTime(t2e);
            tCUS.recombine += getTime(t3e);
            tCUS.decay += getTime(t4e);
        }
        var tCEe = process.hrtime(tCEs);
        tCES += getTime(tCEe);

        var tCCs = process.hrtime();

        // Collision with own cells
        lenc = client.cells.length;
        for (var j = 0; j < lenc; j++) {
            var cell = client.cells[j];
            if (!cell) continue;
            if (cell.eaten) continue;

            // Collide if required
            if (this.gameServer.config.playerRecombineTime > 0 && cell.collisionRestoreTicks == 0) {
                for (var k = j; k < lenc; k++) {
                    if (!client.cells[k]) continue;
                    if (client.cells[k].eaten) continue;
                    if ((client.cells[k].shouldRecombine && cell.shouldRecombine) ||
                        client.mergeOverride || client.cells[k].collisionRestoreTicks > 0) continue;

                    this.collisionHandler.pushApart(cell, client.cells[k]);
                }
            }

            // Check for border passage, bounce physics on
            cell.borderCheck(true);
            this.gameServer.quadTree.update(cell);
        }
        var tCCe = process.hrtime(tCCs);
        tCCS += getTime(tCCe);
    }
    var tCe = process.hrtime(tCs),
        tC3s = process.hrtime();

    // Move the cells that need to move
    len = this.movingNodes.length;
    for (var i = 0; i < len; i++) {
        var node = this.movingNodes[i];
        if (!node) continue;

        node.moveEngineTick();
        if (node.cellType != 0) node.move();

        // Remove from moving nodes if moving slowly
        if (node.moveEngine.distanceSq() < 2) {
            this.movingNodes.remove(node);
            if (node.cellType == 3) node.isMoving = false;
        }
    }

    var tEnd = process.hrtime(tStart),
        tC3e = process.hrtime(tC3s);

    this.gameServer.updateLog['cl-et-update'] = tCES;
    this.gameServer.updateLog['cl-et-update-info'] = tCUS;
    this.gameServer.updateLog['cl-cl-update'] = tCCS;
    this.gameServer.updateLog['cl-mv-update'] = getTime(tC3e);
    this.gameServer.updateLog['cl-at-moving'] = this.movingNodes.length;
    this.gameServer.updateLog['cl-e1-update'] = getTime(tEnd);
};

NodeHandler.prototype.addFood = function(n) {
    if (n <= 0) return;
    for (var i = 0; i < n; i++) {
        var food = new Entity.Food(
            this.gameServer.getNextNodeId(),
            null,
            this.getRandomPosition(), // getRandomSpawn at start will lock the server in a loop
            this.gameServer.config.foodMass,
            this.gameServer
        );
        food.insertedList = this.gameServer.nodesFood;
        food.setColor(this.gameServer.getRandomColor());

        this.gameServer.addNode(food);
        this.gameServer.nodesFood.push(food);
    }
};

NodeHandler.prototype.addViruses = function(n) {
    if (n <= 0) return;
    for (var i = 0; i < n; i++) {
        var virus = new Entity.Virus(
            this.gameServer.getNextNodeId(),
            null,
            this.getRandomSpawn(),
            this.gameServer.config.virusStartMass,
            this.gameServer
        );

        this.gameServer.addNode(virus);
    }
};

NodeHandler.prototype.getRandomPosition = function() {
    var xSum = this.gameServer.config.borderRight - this.gameServer.config.borderLeft;
    var ySum = this.gameServer.config.borderBottom - this.gameServer.config.borderTop;
    return new Vector(
        Math.floor(Math.random() * xSum + this.gameServer.config.borderLeft),
        Math.floor(Math.random() * ySum + this.gameServer.config.borderTop)
    );
};

NodeHandler.prototype.getRandomSpawn = function() {
    // Find a random pellet
    var pellet;
    if (this.gameServer.nodesFood.length > 0) {
        while (true) {
            var randomIndex = Math.floor(Math.random() * this.gameServer.nodesFood.length);
            var node = this.gameServer.nodesFood[randomIndex];
            if (!node) continue;
            if (node.eaten) continue;

            pellet = node;
            break;
        }
    } else {
        // No food nodes - generate random position
        return this.getRandomPosition();
    }

    // Generate random angle and distance
    var randomAngle = Math.random() * 6.28;
    var randomDist = Math.random() * 100;

    // Apply angle and distance to a clone of pellet's pos
    return new Vector(
        pellet.position.x + Math.sin(randomAngle) * randomDist,
        pellet.position.y + Math.cos(randomAngle) * randomDist
    );
};

NodeHandler.prototype.shootVirus = function(parent) {
    var parentPos = {
        x: parent.position.x,
        y: parent.position.y,
    };

    var newVirus = new Entity.Virus(
        this.gameServer.getNextNodeId(),
        null,
        parentPos,
        this.gameServer.config.virusStartMass,
        this.gameServer
    );

    newVirus.moveEngine = new Vector(
        Math.sin(parent.shootAngle) * 115,
        Math.cos(parent.shootAngle) * 115
    );

    // Add to moving node list
    this.movingNodes.push(newVirus);

    // Add to cell list
    this.gameServer.addNode(newVirus);
};

NodeHandler.prototype.splitCells = function(client) {
    var len = client.cells.length;
    var splitCells = 0; // How many cells have been split
    for (var i = 0; i < len; i++) {
        var cell = client.cells[i];

        var angle = cell.position.angleTo(client.mouse.x, client.mouse.y);
        if (angle == 0 || isNaN(angle)) angle = Math.PI / 2;

        if (this.createPlayerCell(client, cell, angle, cell.mass / 2) == true) splitCells++;
    }
};

NodeHandler.prototype.createPlayerCell = function(client, parent, angle, mass) {
    // Returns boolean whether a cell has been split or not. You can use this in the future.

    // Maximum controllable cells
    if (client.cells.length >= this.gameServer.config.playerMaxCells) return false;

    // Minimum mass to split
    if (parent.mass < this.gameServer.config.playerMinMassSplit) return false;

    // Create cell
    var newCell = new Entity.PlayerCell(
        this.gameServer.getNextNodeId(),
        client,
        parent.position.clone(),
        mass,
        this.gameServer
    );
    newCell.setColor(parent.getColor());

    // Set split boost's speed
    var splitSpeed = newCell.getSplittingSpeed();
    newCell.moveEngine = new Vector(
        Math.sin(angle) * splitSpeed,
        Math.cos(angle) * splitSpeed
    );

    // Cells won't collide immediately
    newCell.collisionRestoreTicks = 15;
    parent.collisionRestoreTicks = 15;

    // Add to moving node list
    this.movingNodes.push(newCell);

    parent.mass -= mass; // Remove mass from parent cell

    // Add to node list
    this.gameServer.addNode(newCell);
    return true;
};

NodeHandler.prototype.canEjectMass = function(client) {
    if (this.gameServer.time - client.lastEject >= this.gameServer.config.ejectMassCooldown) {
        client.lastEject = this.gameServer.time;
        return true;
    } else return false;
};

NodeHandler.prototype.ejectMass = function(client) {
    if (!this.canEjectMass(client)) return;

    for (var i = 0; i < client.cells.length; i++) {
        var cell = client.cells[i];
        if (!cell) continue;

        // Double-check just in case
        if (cell.mass < this.gameServer.config.playerMinMassEject ||
            cell.mass < this.gameServer.config.ejectMass) continue;

        var angle = cell.position.angleTo(client.mouse);

        // Get starting position
        var size = cell.getSize() + 16;
        var startPos = new Vector(
            cell.position.x - ((size) * Math.sin(angle)),
            cell.position.y - ((size) * Math.cos(angle))
        );

        // Remove mass from parent cell
        cell.mass -= this.gameServer.config.ejectMassLoss;

        // Randomize movement angle
        angle += (Math.random() * 0.6) - 0.3;

        // Create cell
        var ejected = new Entity.EjectedMass(
            this.gameServer.getNextNodeId(),
            client,
            startPos,
            this.gameServer.config.ejectMass,
            this.gameServer
        );
        ejected.moveEngine = new Vector(
            Math.sin(angle) * this.gameServer.config.ejectSpeed,
            Math.cos(angle) * this.gameServer.config.ejectSpeed
        );
        ejected.setColor(cell.getColor());

        // Add to moving node list
        this.movingNodes.push(ejected);

        this.gameServer.nodesEjected.push(ejected);
        this.gameServer.addNode(ejected);
    }
};
