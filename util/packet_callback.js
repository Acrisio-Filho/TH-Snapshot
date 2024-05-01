// Arquivo packet_callback.js
// Criado em 01/05/2024 as 04:27 por Acrisio
// Definição da classe PacketCallback

class PacketCallback {

    type = -1;
    skip = false;
    callback = null;

    constructor(_type, _skip, _callback) {
        this.type = _type;
        this.skip = _skip;
        this.callback = _callback;
    }
}

module.exports = PacketCallback;
