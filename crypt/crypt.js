// Arquivo crypt.js
// Criado em 11/12/2021 as 16:02 por Acrisio
// Definição da classe Crypt

const {
    PUBLIC_KEY_TABLE,
    PRIVATE_KEY_TABLE
} = require('./keys');

function GetPrivateKeyTable() {
    return PRIVATE_KEY_TABLE;
}

function GetPublicKeyTable() {
    return PUBLIC_KEY_TABLE;
}

function _8bitShift(_bits, _shift) {
	_shift *= 8;
	return ((_bits & (0xFF << _shift)) >> _shift) & 0xFF;
}

function SimpleStreamEncrypt(_buff, _public_key) {

	if (_buff.length > 0) {

		let plain = Buffer.alloc(_buff.length);
		
		plain.set(_buff, 0);

		for (let i = 0; i < (_buff.length >= 4 ? 4 : _buff.length); i++)
			_buff.writeUInt8((plain.readUInt8(i) ^ _8bitShift(_public_key, i)) & 0xFF, i);

		for (let i = 4; i < _buff.length; i++)
			_buff.writeUInt8((_buff.readUInt8(i) ^ plain.readUInt8(i - 4)) & 0xFF, i);
	}
}

function SimpleStreamDecrypt(_buff, _public_key) {

	if (_buff.length > 0) {

		for (let i = 0; i < (_buff.length >= 4 ? 4 : _buff.length); i++)
			_buff.writeUInt8((_buff.readUInt8(i) ^ _8bitShift(_public_key, i)) & 0xFF, i);

		for (let i = 4; i < _buff.length; i++)
			_buff.writeUInt8((_buff.readUInt8(i) ^ _buff.readUInt8(i - 4)) & 0xFF, i);
	}
}

class Crypt {

    privateKey = 0;
    publicKey = 0;

    constructor(_parseKey, _low_key) {

        this.privateKey = GetPrivateKeyTable()[_parseKey << 8 | _low_key];
        this.publicKey = GetPublicKeyTable()[_parseKey << 8 | _low_key];
    }

    encrypt(_buffer) {

        if (!_buffer || _buffer.length <= 0)
            return; // exception

        _buffer.writeUInt8(this.privateKey & 0xFF, 0);

        SimpleStreamEncrypt(_buffer, this.publicKey);

        return this.publicKey;
    }

    decrypt(_buffer) {

        if (!_buffer || _buffer.length <= 0)
            return; // exception

        SimpleStreamDecrypt(_buffer, this.publicKey);

        return this.privateKey;
    }
}

module.exports = Crypt;
