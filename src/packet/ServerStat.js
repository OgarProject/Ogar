// Import
var BinaryWriter = require("./BinaryWriter");

function ServerStat(playerTracker) {
    this.playerTracker = playerTracker;
};

module.exports = ServerStat;

ServerStat.prototype.build = function (protocol) {
    var gameServer = this.playerTracker.gameServer;
    // Get server statistics
    var totalPlayers = 0;
    var alivePlayers = 0;
    var spectPlayers = 0;
    for (var i = 0; i < gameServer.clients.length; i++) {
        var socket = gameServer.clients[i];
        if (socket == null || !socket.isConnected)
            continue;
        totalPlayers++;
        if (socket.playerTracker.cells.length > 0)
            alivePlayers++;
        else
            spectPlayers++;
    }
    var obj = {
        'name': gameServer.config.serverName,
        'mode': gameServer.gameMode.name,
        'uptime': process.uptime() >>> 0,
        'update': gameServer.updateTimeAvg.toFixed(3),
        'playersTotal': totalPlayers,
        'playersAlive': alivePlayers,
        'playersSpect': spectPlayers,
        'playersLimit': gameServer.config.serverMaxConnections
    };
    var json = JSON.stringify(obj);
    // Serialize
    var writer = new BinaryWriter();
    writer.writeUInt8(254);             // Message Id
    writer.writeStringZeroUtf8(json);   // JSON
    return writer.toBuffer();
};
