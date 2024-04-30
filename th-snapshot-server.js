// Arquivo th-snapshot-server.js
// Criado em 28/04/2024 as 17:05 por Acrisio
// Definição do server que vai enviar o snapshot para o cliente

const { randomInt } = require('node:crypto');
const net = require('net');
const Packet = require('./packet/packet');
const SequencePacket = require('./util/sequence_packet');

class THSnapshotServer {

    login_server = null;
    game_server = null;

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

            this.login_server = net.createServer(function(socket) {

                const login_packets = new SequencePacket();

                console.log('[L] Socket connected');

                socket.player_id = 'Unknown';
                socket.parseKey = randomInt(0, 16);
                socket.data_bf = Buffer.alloc(0);

                socket.on('error', (err) => {
                    console.log('[L] socket error: ', err);
                });

                socket.on('end', () => {
                    console.log('[L] socket end');
                });

                socket.on('close', () => {
                    console.log('[L] socket closed');
                });

                socket.on('data', function(data) {

                    socket.data_bf = Buffer.concat([socket.data_bf, data]);

                    while (socket.data_bf.length > 4) {

                        let bf2 = socket.data_bf.readUInt16LE(1);

                        if ((bf2 + 4) > socket.data_bf.length)
                            return;

                        bf2 = socket.data_bf.slice(0, bf2 + 4);

                        socket.data_bf = socket.data_bf.slice(bf2.length);

                        const pckt = new Packet();

                        pckt.unMakePacket(bf2, socket.parseKey);

                        console.log(`[L] Packet.type: ${pckt.type}`);

                        switch (pckt.type) {
                            case 1:
                                socket.player_id = pckt.DecodeStr();
                                // close
                                if (!login_packets.load(`login_packets-${socket.player_id}`)) {

                                    socket.destroy();

                                    return;
                                }
                                break;
                        }

                        pckt.printToConsole();

                        if (login_packets.has_sequence(`${pckt.type}`)) {

                            let sequences = login_packets.get_sequence(`${pckt.type}`);

                            if (sequences.length == 1)
                                sequences = sequences.shift();
                            else
                                sequences = [];

                            for (const obj of sequences) {

                                if (obj.type == 2) {

                                    const pckt4 = new Packet(2);

                                    let bf = Buffer.alloc(92);

                                    bf.write('Nico', 0, 64, 'utf8');
                                    bf.write('127.0.0.1', 52, 70, 'utf8');
                                    bf.writeUInt32LE(777, 40);
                                    bf.writeUInt32LE(1000, 44);
                                    bf.writeUInt32LE(20201, 70);

                                    pckt4.Encode1(1);
                                    pckt4.EncodeBuffer(bf);

                                    socket.write(pckt4.makePacketComplete(socket.parseKey));

                                }else {

                                    const pckt3 = new Packet(obj.type);

                                    pckt3.EncodeBuffer(Buffer.from(obj.data));

                                    socket.write(pckt3.makePacketComplete(socket.parseKey));
                                }
                            }
                        }
                    }
                });

                // First Packet
                const pckt2 = new Packet(0);

                pckt2.Encode4(socket.parseKey);
                pckt2.Encode4(777);

                socket.write(pckt2.makePacketComplete(-1));
            });

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

            this.game_server = net.createServer(function(socket) {

                const game_packets = new SequencePacket();

                console.log('[G] Socket connected');

                socket.player_id = 'Unknown';
                socket.parseKey = randomInt(0, 16);
                socket.data_bf = Buffer.alloc(0);

                socket.on('error', (err) => {
                    console.log('[G] socket error: ', err);
                });

                socket.on('end', () => {
                    console.log('[G] socket end');
                });

                socket.on('close', () => {
                    console.log('[G] socket closed');
                });

                socket.on('data', (data) => {

                    socket.data_bf = Buffer.concat([socket.data_bf, data]);

                    while (socket.data_bf.length > 4) {

                        let bf2 = socket.data_bf.readUInt16LE(1);

                        if ((bf2 + 4) > socket.data_bf.length)
                            return;

                        bf2 = socket.data_bf.slice(0, bf2 + 4);

                        socket.data_bf = socket.data_bf.slice(bf2.length);

                        const pckt = new Packet();

                        pckt.unMakePacket(bf2, socket.parseKey);

                        console.log(`[G] Packet.type: ${pckt.type}`);

                        switch (pckt.type) {
                            case 2:
                                socket.player_id = pckt.DecodeStr();
                                // close
                                if (!game_packets.load(`game_packets-${socket.player_id}`)) {

                                    socket.destroy();

                                    return;
                                }
                                break;
                        }

                        pckt.printToConsole();

                        if (game_packets.has_sequence(`${pckt.type}`)) {

                            let sequences = game_packets.get_sequence(`${pckt.type}`);

                            if (sequences.length == 1)
                                sequences = sequences.shift();
                            else if (pckt.type == 0x2F) {

                                let uid = pckt.Decode4();
                                let opt = pckt.Decode1();

                                console.log(`Request info do player: ${uid}, opt: ${opt}`);

                                if (game_packets.has_sequence(`${pckt.type}-${opt}`))
                                    sequences = game_packets.get_sequence(`${pckt.type}-${opt}`).shift();
                                else
                                    sequences = [];

                            }else if (pckt.type == 8) {

                                pckt.Discart(13);

                                let modo = pckt.Decode1();

                                console.log(`Request make room: modo: ${modo}`);

                                if (game_packets.has_sequence(`${pckt.type}-${modo}`))
                                    sequences = game_packets.get_sequence(`${pckt.type}-${modo}`).shift();
                                else
                                    sequences = [];

                            }else
                                sequences = [];

                            for (const obj of sequences) {

                                const pckt3 = new Packet(obj.type);

                                pckt3.EncodeBuffer(Buffer.from(obj.data));

                                socket.write(pckt3.makePacketComplete(socket.parseKey));
                            }
                        }
                    }
                });

                // First Packet
                const pckt2 = new Packet(0x3F);

                pckt2.Encode1(1);
                pckt2.Encode1(1);
                pckt2.Encode1(socket.parseKey & 0xFF);
                pckt2.EncodeStr('127.0.0.1');

                socket.write(pckt2.makePacketComplete(-1));
            });

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
}

module.exports = THSnapshotServer;
