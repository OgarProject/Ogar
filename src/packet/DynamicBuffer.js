function DynamicBuffer(littleEndian) {
    this.littleEndian = littleEndian == null ? false : littleEndian;
    this.bytes = [];
    
    // Temp buffers to calculate bytes because I'm too lazy to do it
    this.tempArrayBuffer = new ArrayBuffer(8);
    this.tempDataView = new DataView(this.tempArrayBuffer);
}

module.exports = DynamicBuffer;

// Setters

DynamicBuffer.prototype.setStringUTF8 = function(value) {
    var utf8 = this.convertUTF8(value);
    for (var i = 0; i < utf8.length; i++) {
        this.tempDataView.setUint8(0, utf8[i], false);
        this.moveTemp(1);
    }
};

DynamicBuffer.prototype.setStringUnicode = function(value) {
    for (var i = 0; i < value.length; i++) {
        this.tempDataView.setUint8(0, value.charCodeAt(i), false);
        this.moveTemp(2);
    }
};

DynamicBuffer.prototype.setBoolean = function(value) {
    this.tempDataView.setUint8(0, value ? 1 : 0, false);
    this.moveTemp(1);
};

DynamicBuffer.prototype.setUint8 = function(value) {
    this.tempDataView.setUint8(0, value, false);
    this.moveTemp(1);
};

DynamicBuffer.prototype.setInt8 = function(value) {
    this.tempDataView.setInt8(0, value, false);
    this.moveTemp(1);
};

DynamicBuffer.prototype.setUint16 = function(value) {
    this.tempDataView.setUint16(0, value, false);
    this.moveTemp(2);
};

DynamicBuffer.prototype.setInt16 = function(value) {
    this.tempDataView.setInt16(0, value, false);
    this.moveTemp(2);
};

DynamicBuffer.prototype.setUint32 = function(value) {
    this.tempDataView.setUint32(0, value, false);
    this.moveTemp(4);
};

DynamicBuffer.prototype.setInt32 = function(value) {
    this.tempDataView.setInt32(0, value, false);
    this.moveTemp(4);
};

DynamicBuffer.prototype.setUint64 = function(value) {
    this.tempDataView.setUint64(0, value, false);
    this.moveTemp(8);
};

DynamicBuffer.prototype.setInt64 = function(value) {
    this.tempDataView.setInt64(0, value, false);
    this.moveTemp(8);
};

DynamicBuffer.prototype.setFloat32 = function(value) {
    this.tempDataView.setFloat32(0, value, false);
    this.moveTemp(4);
};

DynamicBuffer.prototype.setFloat64 = function(value) {
    this.tempDataView.setFloat64(0, value, false);
    this.moveTemp(8);
};

// Lib

DynamicBuffer.prototype.moveTemp = function(amount) {
    // Moves from temp to calculated bytes and flushes temp
    if (this.littleEndian) {
        for (var i = amount - 1; i >= 0; i--) {
            this.bytes.push(this.tempDataView.getUint8(i));
        }
    } else {
        for (var i = 0; i < amount; i++) {
            this.bytes.push(this.tempDataView.getUint8(i));
        }
    }
    this.flush();
};

DynamicBuffer.prototype.flush = function() {
    // Readies temp buffer for use
    this.tempArrayBuffer = new ArrayBuffer(8);
    this.tempDataView = new DataView(this.tempArrayBuffer);
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

// Not my work
DynamicBuffer.prototype.convertUTF8 = function(str) {
    var utf8 = [];
    for (var i=0; i < str.length; i++) {
        var charcode = str.charCodeAt(i);
        if (charcode < 0x80) utf8.push(charcode);
        else if (charcode < 0x800) {
            utf8.push(0xc0 | (charcode >> 6), 
                      0x80 | (charcode & 0x3f));
        }
        else if (charcode < 0xd800 || charcode >= 0xe000) {
            utf8.push(0xe0 | (charcode >> 12), 
                      0x80 | ((charcode>>6) & 0x3f), 
                      0x80 | (charcode & 0x3f));
        }
        // surrogate pair
        else {
            i++;
            // UTF-16 encodes 0x10000-0x10FFFF by
            // subtracting 0x10000 and splitting the
            // 20 bits of 0x0-0xFFFFF into two halves
            charcode = 0x10000 + (((charcode & 0x3ff)<<10)
                      | (str.charCodeAt(i) & 0x3ff));
            utf8.push(0xf0 | (charcode >>18), 
                      0x80 | ((charcode>>12) & 0x3f), 
                      0x80 | ((charcode>>6) & 0x3f), 
                      0x80 | (charcode & 0x3f));
        }
    }
    return utf8;
};
