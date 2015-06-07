module.exports = {
    Mode: require('./Mode'),
    FFA: require('./FFA'),
    Teams: require('./Teams'),
    Tournament: require('./Tournament'),
    HungerGames: require('./HungerGames'),
};

var get = function(id) {
    var mode;
    switch (id) {
        case 1: // Teams
            mode = new module.exports.Teams();
            break;
        case 11: // Hunger Games
            mode = new module.exports.HungerGames();
            break;
        default: // FFA is default
            mode = new module.exports.FFA();
            break;
    }
    return mode;
}

module.exports.get = get;
