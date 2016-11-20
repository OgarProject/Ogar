var tempBuf = new Buffer(8);

function DynamicBuffer(littleEndian) {
    this.littleEndian = littleEndian ? true : false;
    this.bytes = [];
}

module.exports = DynamicBuffer;

// Setters

DynamicBuffer.prototype.setStringUTF8 = function(value) {
    var buf = new Buffer(value, 'utf-8');
    for (var i = 0; i < buf.length; i++) this.bytes.push(buf[i]);
};

DynamicBuffer.prototype.setStringUnicode = function(value) {
    var buf = new Buffer(value, 'ucs2');
    for (var i = 0; i < buf.length; i++) this.bytes.push(buf[i]);
};

DynamicBuffer.prototype.setBoolean = function(value) {
    tempBuf.writeUInt8(value ? 1 : 0, 0, true);
    this.moveTemp(1);
};

DynamicBuffer.prototype.setUint8 = function(value) {
    tempBuf.writeUInt8(value, 0, true);
    this.moveTemp(1);
};

DynamicBuffer.prototype.setInt8 = function(value) {
    tempBuf.writeInt8(value, 0, true);
    this.moveTemp(1);
};

DynamicBuffer.prototype.setUint16 = function(value) {
    tempBuf.writeUInt16LE(value, 0, true);
    this.moveTemp(2);
};

DynamicBuffer.prototype.setInt16 = function(value) {
    tempBuf.writeInt16LE(value, 0, true);
    this.moveTemp(2);
};

DynamicBuffer.prototype.setUint32 = function(value) {
    tempBuf.writeUInt32LE(value, 0, true);
    this.moveTemp(4);
};

DynamicBuffer.prototype.setInt32 = function(value) {
    tempBuf.writeInt32LE(value, 0, true);
    this.moveTemp(4);
};

DynamicBuffer.prototype.setFloat32 = function(value) {
    tempBuf.writeFloatLE(value, 0, true);
    this.moveTemp(4);
};

DynamicBuffer.prototype.setFloat64 = function(value) {
    tempBuf.writeDoubleLE(value, 0, true);
    this.moveTemp(8);
};

// Lib

DynamicBuffer.prototype.moveTemp = function(amount) {
    // Moves from temp to calculated bytes and flushes temp
    if (this.littleEndian) {
        for (var i = 0; i < amount; i++) {
            this.bytes.push(tempBuf[i]);
        }
    } else {
        for (var i = amount - 1; i >= 0; i--) {
            this.bytes.push(tempBuf[i]);
        }
    }
};

DynamicBuffer.prototype.build = function() {
    // Builds fixed buffer from dynamic byte array
    return new Buffer(this.bytes);
};
