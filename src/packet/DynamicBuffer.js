var tempArrayBuffer = new ArrayBuffer(8);
var tempDataView = new DataView(tempArrayBuffer);

function DynamicBuffer(littleEndian) {
    this.littleEndian = littleEndian == null ? false : littleEndian;
    this.bytes = [];
}

module.exports = DynamicBuffer;

// Setters

DynamicBuffer.prototype.setStringUTF8 = function(value) {
    var utf8 = unescape(encodeURIComponent(value));
    for (var i = 0; i < utf8.length; i++) {
        tempDataView.setUint8(0, utf8.charCodeAt(i), false);
        this.moveTemp(1);
    }
};

DynamicBuffer.prototype.setStringUnicode = function(value) {
    for (var i = 0; i < value.length; i++) {
        tempDataView.setUint16(0, value.charCodeAt(i), false);
        this.moveTemp(2);
    }
};

DynamicBuffer.prototype.setBoolean = function(value) {
    tempDataView.setUint8(0, value ? 1 : 0, false);
    this.moveTemp(1);
};

DynamicBuffer.prototype.setUint8 = function(value) {
    tempDataView.setUint8(0, value, false);
    this.moveTemp(1);
};

DynamicBuffer.prototype.setInt8 = function(value) {
    tempDataView.setInt8(0, value, false);
    this.moveTemp(1);
};

DynamicBuffer.prototype.setUint16 = function(value) {
    tempDataView.setUint16(0, value, false);
    this.moveTemp(2);
};

DynamicBuffer.prototype.setInt16 = function(value) {
    tempDataView.setInt16(0, value, false);
    this.moveTemp(2);
};

DynamicBuffer.prototype.setUint32 = function(value) {
    tempDataView.setUint32(0, value, false);
    this.moveTemp(4);
};

DynamicBuffer.prototype.setInt32 = function(value) {
    tempDataView.setInt32(0, value, false);
    this.moveTemp(4);
};

DynamicBuffer.prototype.setUint64 = function(value) {
    tempDataView.setUint64(0, value, false);
    this.moveTemp(8);
};

DynamicBuffer.prototype.setInt64 = function(value) {
    tempDataView.setInt64(0, value, false);
    this.moveTemp(8);
};

DynamicBuffer.prototype.setFloat32 = function(value) {
    tempDataView.setFloat32(0, value, false);
    this.moveTemp(4);
};

DynamicBuffer.prototype.setFloat64 = function(value) {
    tempDataView.setFloat64(0, value, false);
    this.moveTemp(8);
};

// Lib

DynamicBuffer.prototype.moveTemp = function(amount) {
    // Moves from temp to calculated bytes and flushes temp
    if (this.littleEndian) {
        for (var i = amount - 1; i >= 0; i--) {
            this.bytes.push(tempDataView.getUint8(i));
        }
    } else {
        for (var i = 0; i < amount; i++) {
            this.bytes.push(tempDataView.getUint8(i));
        }
    }
};

DynamicBuffer.prototype.build = function() {
    // Builds fixed array buffer from dynamic byte array
    var buf = new ArrayBuffer(this.bytes.length);
    var view = new DataView(buf);
    for (var i = 0; i < this.bytes.length; i++) {
        view.setUint8(i, this.bytes[i], false);
    }
    return buf;
};
