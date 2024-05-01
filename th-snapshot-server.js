// Arquivo th-snapshot-server.js
// Criado em 28/04/2024 as 17:05 por Acrisio
// Definição do server que vai enviar o snapshot para o cliente

const { randomInt } = require('node:crypto');
const net = require('net');
const Packet = require('./packet/packet');
const SequencePacket = require('./util/sequence_packet');
const PacketCallback = require('./util/packet_callback');
const PacketAnalyzer = require('./util/packet_analyzer');

const kServerType = {
    LOGIN_SERVER: 0,
    GAME_SEVER: 1
}

class THSnapshotServer {

    login_server = null;
    game_server = null;

    login_packets = new SequencePacket();
    game_packets = new SequencePacket();

    login_packet_callbacks = new PacketAnalyzer();
    game_packet_callbacks = new PacketAnalyzer();

    login_client_packet_callbacks = new PacketAnalyzer();
    game_client_packet_callbacks = new PacketAnalyzer();

    login_packet_conflict_callbacks = new PacketAnalyzer();
    game_packet_conflict_callbacks = new PacketAnalyzer();

    constructor() {

        // Login Packet callbacks
        this.login_packet_callbacks.push([
            new PacketCallback(
                1,
                false,
                function(_pckt, _socket) {

                    _socket.player_id = _pckt.DecodeStr();

                    // close
                    if (!this.login_packets.load(`login_packets-${_socket.player_id}`)) {

                        _socket.destroy();

                        return true;
                    }

                    return false;
                }
                .bind(this)
            )
        ]);

        // Game Packet Callbacks
        this.game_packet_callbacks.push([
            new PacketCallback(
                2,
                false,
                function(_pckt, _socket) {

                    _socket.player_id = _pckt.DecodeStr();

                    // close
                    if (!this.game_packets.load(`game_packets-${_socket.player_id}`)) {

                        _socket.destroy();

                        return true;
                    }

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x184,
                true,
                function(_pckt, _socket) {

                    const p = new Packet(0x26A);

                    p.Encode4(0);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            )
        ]);

        // Login client packet callbacks
        this.login_client_packet_callbacks.push([
            new PacketCallback(
                2,
                true,
                function(_pckt, _socket) {

                    const p = new Packet(2);

                    let bf = Buffer.alloc(92);

                    bf.write('Nico', 0, 64, 'utf8');
                    bf.write('127.0.0.1', 52, 70, 'utf8');
                    bf.writeUInt32LE(777, 40);
                    bf.writeUInt32LE(1000, 44);
                    bf.writeUInt32LE(20201, 70);

                    p.Encode1(1);
                    p.EncodeBuffer(bf);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            )
        ]);

        // game client packet callbacks

        // login packet conflict callbacks

        // game packet conflict callbacks
        this.game_packet_conflict_callbacks.push([
            new PacketCallback(
                8,
                false,
                function(_pckt, _objKey) {

                    _pckt.Discart(13);

                    let modo = _pckt.Decode1();

                    console.log(`Request make room, modo: ${modo}`);

                    _objKey.key = `${_pckt.type}-${modo}`;

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x2F,
                false,
                function(_pckt, _objKey) {

                    let uid = _pckt.Decode4();
                    let opt = _pckt.Decode1();

                    console.log(`Request info do player: ${uid}, opt: ${opt}`);

                    _objKey.key = `${_pckt.type}-${opt}`;

                    return false;
                }
                .bind(this)
            )
        ]);
    }

    is_listening() {
        return this.login_server !== null && this.game_server !== null;
    }

    stop(_callback) {

        if (!_callback || !(_callback instanceof Function))
            return false;

        var closed = 0;

        if (this.login_server !== null)
            this.login_server.close(() => {

                // reply
                if (closed == 2)
                    _callback(true, 'None');

                closed = 1;
            });
        else
            closed = 1;

        if (this.game_server !== null)
            this.game_server.close(() => {

                // reply
                if (closed == 1)
                    _callback(true, 'None');

                closed = 2;
            });
        else if (closed == 1)
            _callback(true, 'None');
        else
            closed = 2;

        return true;
    }

    start(_callback) {

        if (!_callback || !(_callback instanceof Function))
            return false;

        if (this.is_listening()) {

            _callback(true, 'None');

            return true;
        }

        var initialized = 0;

        if (this.login_server === null) {

            this.login_server = net.createServer(this.onConnectedSocketLoginServer.bind(this));

            this.login_server.on('error', (err) => {
                console.log('login server error: ', err);

                // reply
                if (initialized == 0)
                    _callback(false, 'fail to listen login server');
            });

            this.login_server.on('close', () => {
                console.log('login server closed');
                this.login_server = null;
            });

            this.login_server.listen(10201, () => {
                console.log('login_server listen in port: 10201');
                initialized = 1;
            });

        }else
            initialized = 1;

        if (this.game_server === null) {

            this.game_server = net.createServer(this.onConnectedSocketGameServer.bind(this));

            this.game_server.on('error', (err) => {
                console.log('game_server error: ', err);

                // reply
                if (initialized == 1)
                    _callback(false, 'fail to listen game server');
            });

            this.game_server.on('close', () => {
                console.log('game_server closed');
                this.game_server = null;
            });

            this.game_server.listen(20201, () => {
                console.log('game_server listen in port: 10201');
                initialized = 2;

                // reply
                _callback(true, 'None');
            });

        }else
            initialized = 2;

        return true;
    }

    checkHavePacket(_socket, _server_type) {

        const kPacketHeaderLength = 4;

        let length = 0;
        let bContinue = true;

        while (bContinue && _socket.data_bf.length > kPacketHeaderLength) {

            length = _socket.data_bf.readUInt16LE(1);

            if ((length + kPacketHeaderLength) > _socket.data_bf.length)
                return;

            const pckt = new Packet();

            pckt.unMakePacket(
                _socket.data_bf.slice(0, length + kPacketHeaderLength),
                _socket.parseKey
            );

            _socket.data_bf = _socket.data_bf.slice(pckt.size);

            if (_server_type == kServerType.LOGIN_SERVER)
                bContinue = this.translateLoginPacket(_socket, pckt);
            else if (_server_type == kServerType.GAME_SEVER)
                bContinue = this.translateGamePacket(_socket, pckt);
        }
    }

    conflictSequencePacket(_seqs, _ctx_conflict) {

        if (_seqs.length <= 0)
            return [];
        else if (_seqs.length == 1 || !_ctx_conflict || !_ctx_conflict.pckt
                || !_ctx_conflict.packet_conflict_callbacks
                || !_ctx_conflict.packet_conflict_callbacks.has(_ctx_conflict.pckt.type))
            _seqs = _seqs.map(el => el[1]).shift();
        else {

            const objKey = {
                key: `${_ctx_conflict.pckt.type}`
            };

            _ctx_conflict.packet_conflict_callbacks.execute(
                _ctx_conflict.pckt,
                objKey
            );

            _seqs = _seqs.filter(el => el[0].includes(objKey.key)).map(el => el[1]);

            if (_seqs.length == 0)
                return [];

            _seqs = _seqs.shift();
        }

        return _seqs;
    }

    translateLoginPacket(_socket, _pckt) {

        console.log(`[L] Packet.type: ${_pckt.type}`);

        _pckt.printToConsole();

        const status_translate = this.login_packet_callbacks.execute(_pckt, _socket);

        if (status_translate.skip || status_translate.exit)
            return !status_translate.exit;

        // reset _pckt
        _pckt.reset();
        _pckt.Decode2(); // type

        if (this.login_packets.has_sequence(`${_pckt.type}`)) {

            let sequences = this.login_packets.get_sequence(
                `${_pckt.type}`,
                this.conflictSequencePacket.bind(this),
                {
                    pckt: _pckt,
                    packet_conflict_callbacks: this.login_packet_conflict_callbacks
                }
            );

            for (const obj of sequences) {

                const p = Packet.unMakedRawPacket(obj.type, Buffer.from(obj.data));

                const status_analyzer = this.login_client_packet_callbacks.execute(p, _socket);

                if (status_analyzer.skip)
                    continue;

                if (status_analyzer.exit)
                    return false;

                // change offset to send packet
                p.offset = p.size;

                _socket.write(p.makePacketComplete(_socket.parseKey));
            }
        }

        return true;
    }

    translateGamePacket(_socket, _pckt) {

        console.log(`[G] Packet.type: ${_pckt.type}`);

        _pckt.printToConsole();

        const status_translate = this.game_packet_callbacks.execute(_pckt, _socket);

        if (status_translate.skip || status_translate.exit)
            return !status_translate.exit;

        // reset _pckt
        _pckt.reset();
        _pckt.Decode2(); // type

        if (this.game_packets.has_sequence(`${_pckt.type}`)) {

            let sequences = this.game_packets.get_sequence(
                `${_pckt.type}`,
                this.conflictSequencePacket.bind(this),
                {
                    pckt: _pckt,
                    packet_conflict_callbacks: this.game_packet_conflict_callbacks
                }
            );

            for (const obj of sequences) {

                const p = Packet.unMakedRawPacket(obj.type, Buffer.from(obj.data));

                const status_analyzer = this.game_client_packet_callbacks.execute(p, _socket);

                if (status_analyzer.skip)
                    continue;

                if (status_analyzer.exit)
                    return false;

                // change offset to send packet
                p.offset = p.size;

                _socket.write(p.makePacketComplete(_socket.parseKey));
            }
        }

        return true;
    }

    onConnectedSocketLoginServer(_socket) {

        console.log('[L] Socket connected');

        _socket.player_id = 'Unknown';
        _socket.parseKey = randomInt(0, 16);
        _socket.data_bf = Buffer.alloc(0);

        _socket.on('error', (_err) => {
            console.log('[L] socket error: ', _err);
        });

        _socket.on('end', () => {
            console.log('[L] socket end');
        });

        _socket.on('close', () => {
            console.log('[L] socket closed');
        });

        _socket.on('data', (_data) => {

            _socket.data_bf = Buffer.concat([_socket.data_bf, _data]);

            this.checkHavePacket(_socket, kServerType.LOGIN_SERVER);
        });

        // First Packet
        const p = new Packet(0);

        p.Encode4(_socket.parseKey);
        p.Encode4(777);

        _socket.write(p.makePacketComplete(-1));
    }

    onConnectedSocketGameServer(_socket) {

        console.log('[G] Socket connected');

        _socket.player_id = 'Unknown';
        _socket.parseKey = randomInt(0, 16);
        _socket.data_bf = Buffer.alloc(0);

        _socket.on('error', (_err) => {
            console.log('[G] socket error: ', _err);
        });

        _socket.on('end', () => {
            console.log('[G] socket end');
        });

        _socket.on('close', () => {
            console.log('[G] socket closed');
        });

        _socket.on('data', (_data) => {

            _socket.data_bf = Buffer.concat([_socket.data_bf, _data]);

            this.checkHavePacket(_socket, kServerType.GAME_SEVER);
        });

        // First Packet
        const p = new Packet(0x3F);

        p.Encode1(1);
        p.Encode1(1);
        p.Encode1(_socket.parseKey & 0xFF);
        p.EncodeStr('127.0.0.1');

        _socket.write(p.makePacketComplete(-1));
    }
}

module.exports = THSnapshotServer;
