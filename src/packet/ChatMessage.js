// Import
var BinaryWriter = require("./BinaryWriter");


function ChatMessage(sender, message) {
    this.sender = sender;
    this.message = message;
}

module.exports = ChatMessage;

ChatMessage.prototype.build = function (protocol) {
    var text = this.message;
    if (text == null) text = "";
    var name = "SERVER";
    var color = { 'r': 0x9B, 'g': 0x9B, 'b': 0x9B };
    if (this.sender != null) {
        name = this.sender.getName();
        if (name == null || name.length == 0) {
            if (this.sender.cells.length > 0)
                name = "An unnamed cell";
            else
                name = "Spectator";
        }
        if (this.sender.cells.length > 0) {
            color = this.sender.cells[0].getColor();
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
