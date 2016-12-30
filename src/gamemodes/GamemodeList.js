function GamemodeList(gameServer) {
    this.gameServer = gameServer;
    this.list = {
        '99': require('./Debug'),
        '0': require('./FFA'),
        '1': require('./Teams'),
        '2': require('./Experimental'),
        '3': require('./Rainbow'),
    };
}

module.exports = GamemodeList;

GamemodeList.prototype.retrieveGamemode = function(id) {
    var gamemode = this.list[id];
    if (!gamemode) throw new Error("Gamemode: given ID " + id + " could not be found");

    return new gamemode();
};
