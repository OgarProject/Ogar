/*
* Simple BinaryWriter is a minimal tool to write binary stream with unpredictable size.
* Useful for binary serialization.
*
* Copyright (c) 2016 Barbosik https://github.com/Barbosik
* License: Apache License, Version 2.0
*/
function BinaryWriter() {
    this._writers = [];
    this._length = 0;
}

module.exports = BinaryWriter;

BinaryWriter.prototype.writeUInt8 = function (value) {
    var offset = this._length;
    this._writers.push(function (buffer) {
        buffer.writeUInt8(value, offset);
    });
    this._length += 1;
};

BinaryWriter.prototype.writeInt8 = function (value) {
    var offset = this._length;
    this._writers.push(function (buffer) {
        buffer.writeInt8(value, offset);
    });
    this._length += 1;
};

BinaryWriter.prototype.writeUInt16 = function (value) {
    var offset = this._length;
    this._writers.push(function (buffer) {
        buffer.writeUInt16LE(value, offset);
    });
    this._length += 2;
};

BinaryWriter.prototype.writeInt16 = function (value) {
    var offset = this._length;
    this._writers.push(function (buffer) {
        buffer.writeInt16LE(value, offset);
    });
    this._length += 2;
};

BinaryWriter.prototype.writeUInt32 = function (value) {
    var offset = this._length;
    this._writers.push(function (buffer) {
        buffer.writeUInt32LE(value, offset);
    });
    this._length += 4;
};

BinaryWriter.prototype.writeInt32 = function (value) {
    var offset = this._length;
    this._writers.push(function (buffer) {
        buffer.writeInt32LE(value, offset);
    });
    this._length += 4;
};

BinaryWriter.prototype.writeFloat = function (value) {
    var offset = this._length;
    this._writers.push(function (buffer) {
        buffer.writeFloatLE(value, offset);
    });
    this._length += 4;
};

BinaryWriter.prototype.writeDouble = function (value) {
    var offset = this._length;
    this._writers.push(function (buffer) {
        buffer.writeDoubleLE(value, offset);
    });
    this._length += 8;
};

BinaryWriter.prototype.writeBytes = function (data) {
    var length = data.length;
    var offset = this._length;
    this._writers.push(function (buffer) {
        data.copy(buffer, offset, 0, length);
    });
    this._length += length;
};

BinaryWriter.prototype.writeStringUtf8 = function (value) {
    var length = Buffer.byteLength(value, 'utf8')
    var offset = this._length;
    this._writers.push(function (buffer) {
        buffer.write(value, offset, 'utf8');
    });
    this._length += length;
};

BinaryWriter.prototype.writeStringUnicode = function (value) {
    var length = Buffer.byteLength(value, 'ucs2')
    var offset = this._length;
    this._writers.push(function (buffer) {
        buffer.write(value, offset, 'ucs2');
    });
    this._length += length;
};

BinaryWriter.prototype.writeStringZeroUtf8 = function (value) {
    this.writeStringUtf8(value);
    this.writeUInt8(0);
};

BinaryWriter.prototype.writeStringZeroUnicode = function (value) {
    this.writeStringUnicode(value);
    this.writeUInt16(0);
};

BinaryWriter.prototype.ToBuffer = function () {
    var buffer = new Buffer(this._length);
    for (var i = 0; i < this._writers.length; i++) {
        this._writers[i](buffer);
    }
    return buffer;
};
