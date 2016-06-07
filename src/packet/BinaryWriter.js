/*
* Simple BinaryWriter is a minimal tool to write binary stream with unpredictable size.
* Useful for binary serialization.
*
* Copyright (c) 2016 Barbosik https://github.com/Barbosik
* License: Apache License, Version 2.0
*/
function BinaryWriter() {
    this._offset = 0;
    this._buffer = null;
}

module.exports = BinaryWriter;

BinaryWriter.prototype.writeUInt8 = function (value) {
    this.allocCheck(1);
    this._buffer.writeUInt8(value, this._offset);
    this._offset += 1;
};

BinaryWriter.prototype.writeInt8 = function (value) {
    this.allocCheck(1);
    this._buffer.writeInt8(value, this._offset);
    this._offset += 1;
};

BinaryWriter.prototype.writeUInt16 = function (value) {
    this.allocCheck(2);
    this._buffer.writeUInt16LE(value, this._offset);
    this._offset += 2;
};

BinaryWriter.prototype.writeInt16 = function (value) {
    this.allocCheck(2);
    this._buffer.writeInt16LE(value, this._offset);
    this._offset += 2;
};

BinaryWriter.prototype.writeUInt32 = function (value) {
    this.allocCheck(4);
    this._buffer.writeUInt32LE(value, this._offset);
    this._offset += 4;
};

BinaryWriter.prototype.writeInt32 = function (value) {
    this.allocCheck(4);
    this._buffer.writeInt32LE(value, this._offset);
    this._offset += 4;
};

BinaryWriter.prototype.writeFloat = function (value) {
    this.allocCheck(4);
    this._buffer.writeFloatLE(value, this._offset);
    this._offset += 4;
};

BinaryWriter.prototype.writeDouble = function (value) {
    this.allocCheck(8);
    this._buffer.writeDoubleLE(value, this._offset);
    this._offset += 8;
};

BinaryWriter.prototype.writeDouble = function (value) {
    this.allocCheck(8);
    this._buffer.writeDoubleLE(value, this._offset);
    this._offset += 8;
};

BinaryWriter.prototype.writeBytes = function (data) {
    var length = data.length;
    this.allocCheck(length);
    data.copy(this._buffer, this._offset, 0, length);
    this._offset += length;
};

BinaryWriter.prototype.writeStringUtf8 = function (value) {
    var length = Buffer.byteLength(value, 'utf8')
    this.allocCheck(length);
    this._buffer.write(value, this._offset, 'utf8');
    this._offset += length;
};

BinaryWriter.prototype.writeStringUnicode = function (value) {
    var length = Buffer.byteLength(value, 'ucs2')
    this.allocCheck(length);
    this._buffer.write(value, this._offset, 'ucs2');
    this._offset += length;
};

BinaryWriter.prototype.writeStringZeroUtf8 = function (value) {
    this.writeStringUtf8(value);
    this.writeUInt8(0);
};

BinaryWriter.prototype.writeStringZeroUnicode = function (value) {
    this.writeStringUnicode(value);
    this.writeUInt16(0);
};


BinaryWriter.prototype.allocCheck = function (size) {
    if (this._buffer == null) {
        var allocSize = size + Buffer.poolSize - (size % Buffer.poolSize);
        this._buffer = this.allocBuffer(allocSize);
    }
    var needed = this._offset + size;
    if (needed <= this._buffer.length)
        return;
    var addSize = needed - this._buffer.length;
    if (addSize < Buffer.poolSize) {
        addSize = Buffer.poolSize;
    } else {
        addSize += Buffer.poolSize - (addSize % Buffer.poolSize);
    }
    var buffer2 = this.allocBuffer(addSize);
    this._buffer = Buffer.concat([this._buffer, buffer2], this._buffer.length + buffer2.length);
}

BinaryWriter.prototype.allocBuffer = function (size) {
    if (Buffer.allocUnsafe == null) // node.js < v6?
        return new Buffer(size);
    return Buffer.allocUnsafe(size);
}

BinaryWriter.prototype.ToBuffer = function () {
    if (this._buffer == null) return new Buffer(0);
    return this._buffer.slice(0, this._offset);
};
