module.exports = {
    Mode: require('./Mode'),
    FFA: require('./FFA'),
    Teams: require('./Teams'),
    Custom: require('./Custom'),
};

var list = [new module.exports.FFA(),new module.exports.Teams()];

module.exports.list = list;