// Project imports
var BotPlayer = require('./BotPlayer');
var FakeSocket = require('./FakeSocket');
var PacketHandler = require('../PacketHandler');

function BotLoader(gameServer) {
    this.gameServer = gameServer;
    this.loadNames();
    this.botsMulti = []; //list of bots that spwan their own python process
    this.botsSingle = []; //list of bots that don't spwan their own python process
    this.nextPort = 13000;
}

module.exports = BotLoader;

BotLoader.prototype.getName = function() {
    var name = "";

    // Picks a random name for the bot
    if (this.randomNames.length > 0) {
        var index = Math.floor(Math.random() * this.randomNames.length);
        name = this.randomNames[index];
        this.randomNames.splice(index, 1);
    } else {
        name = "bot" + ++this.nameIndex;
    }

    return name;
};

BotLoader.prototype.loadNames = function() {
    this.randomNames = [];

    // Load names
    try {
        var fs = require("fs"); // Import the util library

        // Read and parse the names - filter out whitespace-only names
        this.randomNames = fs.readFileSync("./botnames.txt", "utf8").split(/[\r\n]+/).filter(function(x) {
            return x != ''; // filter empty names
        });
    } catch (e) {
        // Nothing, use the default names
    }

    this.nameIndex = 0;
};

BotLoader.prototype.addBotMulti = function() {
    var s = new FakeSocket(this.gameServer);
    s.playerTracker = new BotPlayer(this.gameServer, s, true, this.nextPort);
    this.botsMulti.push(s.playerTracker)
    this.nextPort++
    s.packetHandler = new PacketHandler(this.gameServer, s);

    // Add to client list
    this.gameServer.clients.push(s);

    // Add to world
    s.packetHandler.setNickname(this.getName());
};

BotLoader.prototype.addBotSingle = function(port) {
    var s = new FakeSocket(this.gameServer);
    s.playerTracker = new BotPlayer(this.gameServer, s, false, port);
    this.botsSingle.push(s.playerTracker)
    this.nextPort++
    s.packetHandler = new PacketHandler(this.gameServer, s);

    // Add to client list
    this.gameServer.clients.push(s);

    // Add to world
    s.packetHandler.setNickname(this.getName());
};

BotLoader.prototype.killBots = function() {
    this.botsMulti.forEach(function(bot) {
        bot.kill();
    });
};