function CollisionHandler(gameServer) {
    // Can make config values for these
    this.baseEatingDistanceDivisor = 3;
    this.baseEatingMassRequired = 1.3;
    this.gameServer = gameServer;
}

module.exports = CollisionHandler;

CollisionHandler.prototype.pushApart = function(cell, check) {
    if (cell.nodeId == check.nodeId) return; // Can't collide with self

    var cartesian = cell.position.clone().sub(check.position);

    var dist = cartesian.distance();
    var angle = cartesian.angle();
    var maxDist = cell.getSize() + check.getSize();

    if (dist < maxDist) {
        // Push cell apart
        var mult = Math.sqrt(check.mass / cell.mass) / 2;
        var outward = (maxDist - dist) * mult;

        // Resolve jittering
        outward = Math.min(outward, maxDist - dist);

        cell.position.add(
            Math.sin(angle) * outward,
            Math.cos(angle) * outward
        );
        return true;
    } else return false;
};

CollisionHandler.prototype.canEat = function(cell, check) {
    // Error check
    if (!cell || !check) return;

    // Can't eat self
    if (cell.nodeId == check.nodeId) return false;

    // Cannot eat/be eaten while in range of someone else
    if (check.inRange || cell.inRange) return false;

    var multiplier = this.baseEatingMassRequired;

    // Eating own cells is allowed only if they can merge
    if (cell.cellType == 0 && check.cellType == 0) {
        if (cell.owner.pID == check.owner.pID) {
            // Check recombine if merge override wasn't triggered
            if (!cell.owner.mergeOverride)
                if (!cell.shouldRecombine || !check.shouldRecombine) return false;

            // Can eat own cells with any mass
            multiplier = 1.0;
        } else {
            if (this.gameServer.gameMode.haveTeams &&
                cell.owner.team == check.owner.team) return false; // Same team cells can't eat each other
        }
    }

    // Too small to eat
    if (check.mass * multiplier > cell.mass) return false;

    // Lastly, check eating distance
    var dist = cell.position.sqDistanceTo(check.position);
    var minDist = cell.getSquareSize() - check.getSquareSize() / this.baseEatingDistanceDivisor;

    return dist < minDist;
};
