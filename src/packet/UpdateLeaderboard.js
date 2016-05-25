var DynamicBuffer = require('./DynamicBuffer');

function UpdateLeaderboard(leaderboard, packetLB, protocolVersion, sendingUser) {
    this.leaderboard = leaderboard;
    this.packetLB = packetLB;
    this.protocolVersion = protocolVersion;
    this.sendingUser = sendingUser;
}

module.exports = UpdateLeaderboard;

UpdateLeaderboard.prototype.build = function() {
    var buffer = new DynamicBuffer(true);
    
    switch (this.packetLB) {
        case 48:
            // Custom text list
            buffer.setUint8(48);                                                // Packet ID
            buffer.setUint32(this.leaderboard.length);                          // String amount
            
            for (var i = 0; i < this.leaderboard.length; i++) {
                if (this.protocolVersion != 5) {
                    buffer.setStringUTF8(                                       // UTF-8 string
                        this.leaderboard[i] ? this.leaderboard[i] : "");
                    buffer.setUint8(0);                                         // UTF-8 null terminator
                } else {
                    buffer.setStringUnicode(                                    // Unicode string
                        this.leaderboard[i] ? this.leaderboard[i] : "");
                    buffer.setUint16(0);                                        // Unicode null terminator
                }
            }
            break;
        case 49:
            // FFA leaderboard list
            buffer.setUint8(49);                                                // Packet ID
            buffer.setUint32(this.leaderboard.length);                          // Player amount
            for (var i = 0; i < this.leaderboard.length; i++) {
                var player = this.leaderboard[i];
                var name = player.getName();
                name = name ? name : "";
                if (this.protocolVersion != 5) {
                    var isMe = player.pID == this.sendingUser ? 1 : 0;
                    buffer.setUint32(isMe);                                     // If to display red color text
                    buffer.setStringUTF8(name);                                 // UTF-8 string
                    buffer.setUint8(0);                                         // UTF-8 null terminator
                } else {
                    if (player.cells[0])
                        buffer.setUint32(player.cells[0].nodeId);               // First cell node ID
                    else buffer.setUint32(0);                                   // In case of error
                    buffer.setStringUnicode(name);                              // Unicode string
                    buffer.setUint16(0);                                        // Unicode null terminator
                }
            }
            break;
        case 50:
            // Pie chart
            buffer.setUint8(50);                                                // Packet ID
            buffer.setUint32(this.leaderboard.length);                          // Color amount
            for (var i = 0; i < this.leaderboard.length; i++) {
                buffer.setFloat32(this.leaderboard[i]);                         // A color's size
            }
            break;
    }

    return buffer.build();
};
