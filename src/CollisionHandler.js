function CollisionHandler(gameServer) {
    // Can make config values for these
    this.baseEatingDistanceMultiplier = 0.5;
    this.baseEatingMassRequired = 1.3;
    this.gameServer = gameServer;
}

module.exports = CollisionHandler;

CollisionHandler.prototype.pushApart = function(cell, check) {
    if (cell.nodeId == check.nodeId) return; // Can't collide with self

    // Square collision check
    if (!cell.getRange().intersects(check.getRange())) return false;

    var cartesian = cell.position.clone().sub(check.position);
    var cSz = cell.getSize(),
        chSz = check.getSize();
    var distance = cartesian.distance();
    var maxDist = cSz + chSz;
    var move = maxDist - distance;

    if (move > 0) {
        var move1 = move * ((maxDist / cSz) * 0.25),
            move2 = move * ((maxDist / chSz) * 0.25);

        cell.position.add(cartesian.addDistance(move1 - distance));
        check.position.add(cartesian.negate().addDistance(move2 - move1));
        return true;
    } else return false;
};

CollisionHandler.prototype.pushEjectedApart = function(cell, check) {
    if (cell.nodeId == check.nodeId) return; // Can't collide with self

    var cartesian = cell.position.clone().sub(check.position);
    var distance = cartesian.distance();
    var maxDist = cell.getSize() + check.getSize();
    var move = maxDist - distance + 1;

    if (move > 0) {
        cell.position.add(cartesian.addDistance(move * 0.5 - distance));
        check.position.add(cartesian.negate());
        if (!check.isMoving) {
            check.isMoving = true;
            this.gameServer.nodeHandler.movingNodes.push(check);
        }
    }
};

CollisionHandler.prototype.canEat = function(cell, check) {
    // Error check
    if (!cell || !check) return;

    // Can't eat self
    if (cell.nodeId == check.nodeId) return false;

    // Cannot eat/be eaten while in range of someone else
    if (check.eaten || check.inRange || cell.eaten || cell.inRange) return false;

    // First check eating distance
    var dist = cell.position.sqDistanceTo(check.position);
    var minDist = cell.getSquareSize() - check.getSquareSize() * this.baseEatingDistanceMultiplier;

    if (dist > minDist) return false;

    var multiplier = this.baseEatingMassRequired;

    // Eating own cells is allowed only if they can merge
    if (cell.cellType == 0 && check.cellType == 0) {
        if (cell.owner.pID == check.owner.pID) {
            // Check recombine if merge override wasn't triggered
            if (!cell.owner.mergeOverride)
                if (!cell.shouldRecombine || !check.shouldRecombine || cell.collisionRestoreTicks > 0) return false;

            // Can eat own cells with any mass
            multiplier = 1.0;
        } else {
            if (this.gameServer.gameMode.haveTeams &&
                cell.owner.team == check.owner.team) return false; // Same team cells can't eat each other
        }
    } else if (check.cellType == 1) multiplier = 0;

    // Last, check eating mass
    return check.mass * multiplier <= cell.mass;
};
