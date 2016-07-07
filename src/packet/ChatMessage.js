// Import
var BinaryWriter = require("./BinaryWriter");


function ChatMessage(sender, message) {
    this.sender = sender;
    this.message = message;
}

module.exports = ChatMessage;

ChatMessage.prototype.build = function (protocol) {
	// Variables
    var text = this.message,
	sender = this.sender,
	config = this.gameServer.config,
	color = { 'r': 0x9B, 'g': 0x9B, 'b': 0x9B },
	name = "[SERVER]";
    
	if (text == null) text = "";
	
    if (this.sender != null) {
        name = sender.getName();
        if (name == null || name.length == 0) {
            if (sender.cells.length > 0) name = "An unnamed cell";
            else name = "Spectator";
        }
		if (sender.socket.remoteAddress == config.serverAdminIP) {
			color = { 'r' : 0x4B, 'g': 0x4B, 'b': 0x4B };
			} else {
			if (sender.cells.length > 0 && sender.socket.remoteAddress != config.serverAdminIP)
				color = sender.cells[0].getColor();
		}
    }

    var writer = new BinaryWriter();
    writer.writeUInt8(0x63);            // message id (decimal 99)
    writer.writeUInt8(0x00);            // flags for client; for future use
    writer.writeUInt8(color.r >> 0);
    writer.writeUInt8(color.g >> 0);
    writer.writeUInt8(color.b >> 0);
    if (protocol <= 5) {
        writer.writeStringZeroUnicode(name);
        writer.writeStringZeroUnicode(text);
    } else {
        writer.writeStringZeroUtf8(name);
        writer.writeStringZeroUtf8(text);
    }
    return writer.toBuffer();
};
