module.exports = {
    Mode: require('./Mode'),
    FFA: require('./FFA'),
    Teams: require('./Teams'),
    Custom: require('./Custom'),
};

var get = function(id) {
    var mode;
    switch (id) {
        case 1: // Teams
            mode = new module.exports.Teams();
            break;
        default: // FFA is default
            mode = new module.exports.FFA();
            break;
    }
    return mode;
}

module.exports.get = get;
