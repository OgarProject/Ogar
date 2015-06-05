var http = require('http');

function MasterServer(port) {
    this.port = port;
}

module.exports = MasterServer;

MasterServer.prototype.start = function() {
    this.httpServer = http.createServer(function(req, res) {
        console.log("[Master] Connect: %s:%d", req.connection.remoteAddress, req.connection.remotePort);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.writeHead(200);
        res.end('127.0.0.1:443');
    });

    this.httpServer.listen(this.port, function() {
        console.log("[Master] Listening on port %d", this.port);
    }.bind(this));
}
