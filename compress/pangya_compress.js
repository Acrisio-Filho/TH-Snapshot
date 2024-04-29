// Arquivo pangya_compress.js
// Criado em 28/04/2024 as 05:25 por Acrisio
// Definição da classe Compress

const lzo1x = require('./compress');

class Compress {

    static compress(_data, _no_compress = false) {

        if (!(_data instanceof Buffer) && !(_data instanceof Uint8Array))
            throw 'invalid data';

        if (_data instanceof Uint8Array)
            _data = Buffer.from(_data);

        var ret = Buffer.alloc(4);

        const length = _data.length;

        if (!_no_compress) {

            ret.writeUInt8(0, 0);

            ret = Buffer.concat([
                ret,
                lzo1x.Compress_Data(_data)
            ]);

        }else {

            ret.writeUInt8(1, 0);

            ret = Buffer.concat([ret, _data]);
        }

        ret.writeUInt8(length % 0xFF, 3);
        ret.writeUInt8(((length - ret.readUInt8(3)) / 0xFF) % 0xFF, 2);
        ret.writeUInt8(((((length - ret.readUInt8(3)) / 0xFF) - ret.readUInt8(2)) / 0xFF) % 0xFF, 1);

        return ret;
    }

    static decompress(_data) {

        if (!(_data instanceof Buffer) && !(_data instanceof Uint8Array))
            throw 'invalid data';

        if (_data.length < 4)
            throw `invalid length(${_data.length})`;

        if (_data instanceof Uint8Array)
            _data = Buffer.from(_data);

        let no_compress = _data.readUInt8(0);
        let length = _data.readUInt8(3) + _data.readUInt8(2) * 0xFF + _data.readUInt8(1) * 0xFE01;

        if (no_compress > 0) {

            if (length > (_data.length - 4))
                throw `invalid original size: ${length}`;

            return _data.slice(4, length + 4);
        }

        var ret = lzo1x.Decompress_Data(_data.slice(4), length);

        if (ret.length != length)
            throw `decompress length not match. ${length} != ${ret.length}`;

        return ret;
    }
}

module.exports = Compress;
