// A fake socket for bot players

function FakeSocket() {
	//this.server = gameServer;
}

module.exports = FakeSocket;

// Override

FakeSocket.prototype.sendPacket = function(packet) {
	// Fakes sending a packet
	return;
}

FakeSocket.prototype.close = function(packet) {
	// Fakes closing the connection
	return;
}
