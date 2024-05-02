// Arquivo packet.js
// Criado em 28/04/2024 as 09:38 por Acrisio
// Definição da classe Packet

const { randomInt } = require('node:crypto');
const Crypt = require('../crypt/crypt');
const Compress = require('../compress/pangya_compress.js');

class Packet {

	buff = Buffer.alloc(0); // type
	size = 0;
	offset = 0;
	type = -1;
	is_raw = true;

	constructor(_type = -1, _size = 0x2000) {

		this.buff = Buffer.alloc(_size);
		this.size = _size;
		this.type = _type;

		if (this.type != -1) {

		    this.Encode2(this.type);

		    this.is_raw = false;
		}
	}

	static unMakedRawPacket(_type, _buff) {

	    const pckt = new Packet();

	    _buff = Buffer.concat([Buffer.alloc(2), _buff]);

	    _buff.writeUInt16LE(_type);

	    pckt.reAlloc(_buff.length, true);

        _buff.copy(pckt.buff, pckt.offset, 0, _buff.length);

        pckt.offset = 0;

        pckt.type = pckt.Decode2();

        return pckt;
	}

	reAlloc(_size, _reduce = false) {

		if (_size <= this.size) {

			if (_reduce) {

			    this.buff = this.buff.slice(0, _size);
			    this.size = _size;
			}

			return 1;
		}
		
		this.buff = Buffer.concat([this.buff, Buffer.alloc(_size - this.size)]);

		this.size = _size;

		return 0;
	}

	Encode1(data) {

		if (this.size <= (this.offset + 1))
			this.reAlloc(this.size * 2);

		if (data < 0)
			this.buff.writeInt8(data, this.offset);
		else
			this.buff.writeUInt8(data, this.offset);

		this.offset++;
	}

	Encode2(data) {

		if (this.size <= (this.offset + 2))
			this.reAlloc(this.size * 2);

		if (data < 0)
			this.buff.writeInt16LE(data, this.offset);
		else
			this.buff.writeUInt16LE(data, this.offset);

		this.offset += 2;
	}

	Encode4(data) {

		if (this.size <= (this.offset + 4))
			this.reAlloc(this.size * 2);

		if (data < 0)
			this.buff.writeInt32LE(data, this.offset);
		else
			this.buff.writeUInt32LE(data, this.offset);

		this.offset += 4;
	}

	Encode8(data) {

		if (this.size <= (this.offset + 8))
			this.reAlloc(this.size * 2);

		if (data < 0)
			this.buff.writeBigInt64LE(BigInt(data), this.offset);
		else
			this.buff.writeBigUInt64LE(BigInt(data), this.offset);

		this.offset += 8;
	}

	EncodeFloat(data) {

		if (this.size <= (this.offset + 4))
			this.reAlloc(this.size * 2);

		this.buff.writeFloatLE(data, this.offset);

		this.offset += 4;
	}

	EncodeDouble(data) {

		if (this.size <= (this.offset + 8))
			this.reAlloc(this.size * 2);

		this.buff.writeDoubleLE(data, this.offset);

		this.offset += 8;
	}

	EncodeStr(_str, _encoding = 'binary') {

		this.Encode2(_str.length);

		if (this.size <= (this.offset + _str.length))
			this.reAlloc(this.size * 2 + (_str.size >= this.size ? _str.size : 0));

		if (_str.length > 0) {
			this.buff.write(_str, this.offset, _str.length, _encoding);

			this.offset += _str.length;
		}
	}

	EncodeBuffer(_buff, _size = _buff.length) {

		if (_size <= 0)
			return;

		if (!(_buff instanceof Buffer))
			return;

		if (this.size <= (this.offset + _size))
			this.reAlloc(this.size * 2 + (_size >= this.size ? _size : 0));

		this.buff.fill(_buff, this.offset, this.offset + _size);

		this.offset += _size;
	}

	fillZeroByte(_size, _fill_value = 0) {

		if (_size <= 0)
			return;

		for (let i = 0; i < (_size >> 2); i++)
			this.Encode4(_fill_value);

		for (let i = 0; i < (_size % 4); i++)
			this.Encode1(_fill_value);
	}

	EncodeStrWithFixedSize(_str, _size, _encoding = 'binary') {

		if (_size <= 0)
			return;

		if (this.size <= (this.offset + _size))
			this.reAlloc(this.size * 2 + (_size >= this.size ? _size : 0));

		if (_str.length <= 0)
			this.fillZeroByte(_size);
		else if (_str.length > _size)
			this.EncodeBuffer(Buffer.from(_str.substr(0, _size), _encoding), _size);
		else {

			let rest = _size - _str.length;

			this.EncodeBuffer(Buffer.from(_str, _encoding), _str.length);

			if (rest > 0)
				this.fillZeroByte(rest);
		}
	}

	makePacketComplete(_parseKey) {

		let PACKET_HEADER_SIZE = 3;

		let low_key = randomInt(0, 256);
		let index = 0;

		// size of buffer
		let size_raw = this.offset + PACKET_HEADER_SIZE;

		if (_parseKey == -1)
		    size_raw++;

		let ret_buff = Buffer.alloc(size_raw);

		this.buff.copy(ret_buff, PACKET_HEADER_SIZE + (_parseKey == -1 ? 1 : 0), 0, this.offset);

		ret_buff.writeUInt8(low_key, index++);
		ret_buff.writeUInt16LE(size_raw - PACKET_HEADER_SIZE, index);	index += 2;

		if (_parseKey != -1) {

			ret_buff = Buffer.concat([
			    Buffer.alloc(PACKET_HEADER_SIZE + 1),
			    Compress.compress(ret_buff.slice(PACKET_HEADER_SIZE, size_raw))
			]);

			size_raw = ret_buff.length;
			index = 0;

			ret_buff.writeUInt8(low_key, index++);
			ret_buff.writeUInt16LE(size_raw - PACKET_HEADER_SIZE, index);	index += 2;

            const crypt = new Crypt(_parseKey, low_key);

			this.public_key = crypt.encrypt(ret_buff.slice(PACKET_HEADER_SIZE, size_raw));
		}

		return ret_buff;
	}

	makePacket(_parseKey, _seq = 0) {

		let PACKET_HEADER_SIZE = 4;

		let low_key = randomInt(0, 256);
		let index = 0;

		// size of buffer
		let size_raw = this.offset + PACKET_HEADER_SIZE;

		if (_parseKey != -1)
		    size_raw++;

		let ret_buff = Buffer.alloc(size_raw);

		this.buff.copy(ret_buff, PACKET_HEADER_SIZE + (_parseKey != -1 ? 1 : 0), 0, size_raw);

		ret_buff.writeUInt8(low_key, index++);
		ret_buff.writeUInt16LE(size_raw - PACKET_HEADER_SIZE, index);	index += 2;
		ret_buff.writeUInt8(_seq & 0xFF, index++);

		if (_parseKey != -1) {

            const crypt = new Crypt(_parseKey, low_key);

			this.public_key = crypt.encrypt(ret_buff.slice(PACKET_HEADER_SIZE, size_raw));
		}

		return ret_buff;
	}

	Decode1(_signed = false) {

		if ((this.offset + 1) > this.size)
			throw "Fail to read 1 byte from packet, not enough more data in packet.";

		var data = _signed ? this.buff.readInt8(this.offset) : this.buff.readUInt8(this.offset);

		this.offset++;

		return data;
	}

	Decode2(_signed = false) {

		if ((this.offset + 2) > this.size)
			throw "Fail to read 2 byte from packet, not enough more data in packet.";

		var data = _signed ? this.buff.readInt16LE(this.offset) : this.buff.readUInt16LE(this.offset);

		this.offset += 2;

		return data;
	}

	Decode4(_signed = false) {

		if ((this.offset + 4) > this.size)
			throw "Fail to read 4 byte from packet, not enough more data in packet.";

		var data = _signed ? this.buff.readInt32LE(this.offset) : this.buff.readUInt32LE(this.offset);

		this.offset += 4;

		return data;
	}

	Decode8(_signed = false) {

		if ((this.offset + 8) > this.size)
			throw "Fail to read 8 byte from packet, not enough more data in packet.";

		var data = _signed ? this.buff.readBigInt64LE(this.offset) : this.buff.readBigUInt64LE(this.offset);

		this.offset += 8;

		return data;
	}

	DecodeFloat() {

		if ((this.offset + 4) > this.size)
			throw "Fail to read float from packet, not enough more data in packet.";

		var data = this.buff.readFloatLE(this.offset);

		this.offset += 4;

		return data;
	}

	DecodeDouble(data) {

		if ((this.offset + 8) > this.size)
			throw "Fail to read double from packet, not enough more data in packet.";

		var data = this.buff.readDoubleLE(this.offset);

		this.offset += 8;

		return data;
	}

	DecodeStr(_encoding = 'binary') {

		try {

			let len = this.Decode2(true);

			if (len <= 0)
				return ''; // Empty String

			if ((this.offset + len) > this.size)
				throw "Fail to read string from packet, not enough more data in packet.";

			var data = this.buff.toString(_encoding, this.offset, this.offset + len);

			this.offset += len;

			return data;

		} catch (e) {
			throw 'Fail to read string from packet, not enough more data in packet.';
		}
	}

	DecodeBuffer(_size) {

		if (_size <= 0)
			return;

		if ((this.offset + _size) > this.size)
			throw 'Fail to read buffer from packet, not enough more data in packet.';

		var data = Buffer.alloc(_size);

		this.buff.copy(data, 0, this.offset, this.offset + _size);

		this.offset += _size;

		return data;
	}

	Discart(_size) {

		if (_size <= 0)
			return;

		if ((this.offset + _size) > this.size)
			throw 'Fail to discart from packet, not enough more data in packet.';

		this.offset += _size;
	}

	DecodeAllDataAsBuffer() {

		if (this.offset >= this.size)
			throw 'Fail to read all data as buffer from packet, not enough more data in packet.';

		let size = this.size - this.offset;

		var data = Buffer.alloc(size);

		this.buff.copy(data, 0, this.offset, this.offset + size);

		this.offset += size;

		return data;
	}

	reset(_type = undefined) {

		this.offset = 0;

		if (this.is_raw)
		    this.offset = 7;
		else if (_type) {

		    this.type = _type;
		    this.Encode2(_type);
		}
	}

	unMakePacket(_buff, _parseKey) {

	    if (_buff.length <= 0)
	        return true;

	    this.reAlloc(_buff.length, true);

	    _buff.copy(this.buff, this.offset, 0, _buff.length);

	    this.offset = 0;

	    let low_key = this.Decode1();
	    let length = this.Decode2();
	    let sequence = this.Decode1();

		if (_parseKey == -1) {

		    this.Decode1();
			
			return true;
		}

        let crypt = new Crypt(_parseKey, low_key);

		this.private_key = crypt.decrypt(this.buff.slice(this.offset, this.size));

		let check_key = this.Decode1();

		// invalid packet key value
		if (check_key != this.private_key)
			return false;

		this.type = this.Decode2();

		return true;
	}

	unMakePacketComplete(_buff, _parseKey) {

	    if (_buff.length <= 0)
	        return true;

	    this.reAlloc(_buff.length, true);

	    _buff.copy(this.buff, this.offset, 0, _buff.length);

	    this.offset = 0;

	    let low_key = this.Decode1();
	    let length = this.Decode2();

		if (_parseKey == -1) {

			this.Decode1();

			this.type = this.Decode2();
			
			return true;
		}

        let crypt = new Crypt(_parseKey, low_key);

		this.private_key = crypt.decrypt(this.buff.slice(this.offset, this.size));

		let check_key = this.Decode1();

		// invalid packet key value
		if (check_key != this.private_key)
			return false;

        let compressed = Compress.decompress(this.buff.slice(this.offset, this.size));

        this.reAlloc(this.offset + compressed.length, true);

        compressed.copy(this.buff, this.offset, 0, compressed.length);

        this.type = this.Decode2();

		return true;
	}

	printToConsole() {
	    console.log(this.buff.slice(0, (this.is_raw ? this.size : this.offset)));
	}
}

module.exports = Packet;
