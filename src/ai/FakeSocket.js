// A fake socket for bot players

function FakeSocket(gameServer) {
    this.server = gameServer;
    this.isCloseRequest = false;
}

module.exports = FakeSocket;

// Override

FakeSocket.prototype.sendPacket = function (packet) {
    // Fakes sending a packet
    return;
};

FakeSocket.prototype.close = function (error) {
    this.isCloseRequest = true;
};
