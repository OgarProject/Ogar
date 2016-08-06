'use strict';
/*
 * Simple BinaryWriter is a minimal tool to write binary stream with unpredictable size.
 * Useful for binary serialization.
 *
 * Copyright (c) 2016 Barbosik
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * 
 * 
 */

function BinaryWriter(size) {
    if (!size || size <= 0) {
        size = Buffer.poolSize / 2;
    }
    this._buffer = new Buffer(size);
    this._length = 0;
}

module.exports = BinaryWriter;

BinaryWriter.prototype.writeUInt8 = function (value) {
    checkAlloc(this, 1);
    this._buffer[this._length++] = value;
};

BinaryWriter.prototype.writeInt8 = function (value) {
    checkAlloc(this, 1);
    this._buffer[this._length++] = value;
};

BinaryWriter.prototype.writeUInt16 = function (value) {
    checkAlloc(this, 2);
    this._buffer[this._length++] = value;
    this._buffer[this._length++] = value >> 8;
};

BinaryWriter.prototype.writeInt16 = function (value) {
    checkAlloc(this, 2);
    this._buffer[this._length++] = value;
    this._buffer[this._length++] = value >> 8;
};

BinaryWriter.prototype.writeUInt32 = function (value) {
    checkAlloc(this, 4);
    this._buffer[this._length++] = value;
    this._buffer[this._length++] = value >> 8;
    this._buffer[this._length++] = value >> 16;
    this._buffer[this._length++] = value >> 24;
};

BinaryWriter.prototype.writeInt32 = function (value) {
    checkAlloc(this, 4);
    this._buffer[this._length++] = value;
    this._buffer[this._length++] = value >> 8;
    this._buffer[this._length++] = value >> 16;
    this._buffer[this._length++] = value >> 24;
};

BinaryWriter.prototype.writeFloat = function (value) {
    checkAlloc(this, 4);
    this._buffer.writeFloatLE(value, this._length, true);
    this._length += 4;
};

BinaryWriter.prototype.writeDouble = function (value) {
    checkAlloc(this, 8);
    this._buffer.writeDoubleLE(value, this._length, true);
    this._length += 8;
};

BinaryWriter.prototype.writeBytes = function (data) {
    checkAlloc(this, data.length);
    data.copy(this._buffer, this._length, 0, data.length);
    this._length += data.length;
};

BinaryWriter.prototype.writeStringUtf8 = function (value) {
    var length = Buffer.byteLength(value, 'utf8')
    checkAlloc(this, length);
    this._buffer.write(value, this._length, 'utf8');
    this._length += length;
};

BinaryWriter.prototype.writeStringUnicode = function (value) {
    var length = Buffer.byteLength(value, 'ucs2')
    checkAlloc(this, length);
    this._buffer.write(value, this._length, 'ucs2');
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

BinaryWriter.prototype.getLength = function () {
    return this._length;
};

BinaryWriter.prototype.reset = function () {
    this._length = 0;
};

BinaryWriter.prototype.toBuffer = function () {
    return Buffer.concat([this._buffer.slice(0, this._length)]);
};

function checkAlloc(writer, size) {
    var needed = writer._length + size;
    if (writer._buffer.length >= needed)
        return;
    var chunk = Math.max(Buffer.poolSize / 2, 1024);
    var chunkCount = (needed / chunk) >>> 0;
    if ((needed % chunk) > 0) {
        chunkCount += 1;
    }
    var buffer = new Buffer(chunkCount * chunk);
    writer._buffer.copy(buffer, 0, 0, writer._length);
    writer._buffer = buffer;
};
