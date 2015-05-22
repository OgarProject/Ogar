function UpdateLeaderboard(leaderboard) {
    this.leaderboard = leaderboard;
}

module.exports = UpdateLeaderboard;

UpdateLeaderboard.prototype.build = function() {
    // First, calculate the size
    var lb = this.leaderboard;
    var bufferSize = 5;
    var validElements = 0;
    for (var i = 0; i < lb.length; i++) {
    	//Filler code: Prevents food cells from showing up on leaderboard
        if (typeof lb[i] == "undefined") {
            continue;
        }

        var item = lb[i];
        bufferSize += 4; // Element ID
        bufferSize += item.getName() ? item.getName().length * 2 : 0; // Name
        bufferSize += 2; // Name terminator

        validElements++;
    }

    var buf = new ArrayBuffer(bufferSize);
    var view = new DataView(buf);

    view.setUint8(0, 49, true); // Packet ID
    view.setUint32(1, validElements, true); // Number of elements

    var offset = 5;
    for (var i = 0; i < lb.length; i++) {
    	//Filler code
        if (typeof lb[i] == "undefined") {
            continue;
        }

        var item = lb[i];
        view.setUint32(offset, item.nodeId, true);
        offset += 4;

        var name = item.getName();
        if (name) {
            for (var j = 0; j < name.length; j++) {
                view.setUint16(offset, name.charCodeAt(j), true);
                offset += 2;
            }
        }

        view.setUint16(offset, 0, true);
        offset += 2;
    }

    return buf;
}
