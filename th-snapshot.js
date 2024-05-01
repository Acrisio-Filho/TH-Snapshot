// Arquivo th-snapshot.js
// Criado em 28/04/2024 por Acrisio
// TH Snapshot

const net = require('net');
const Packet = require('./packet/packet');
const SequencePacket = require('./util/sequence_packet');
const PacketCallback = require('./util/packet_callback');
const PacketAnalyzer = require('./util/packet_analyzer');

const kLoginServerIp = '203.107.140.34';
//const kLoginServerIp = '127.0.0.1';
const kLoginServerPort = 10201;
const kClientVersion = '829.01';
const kClientPacketVersion = 0x254AD2C7;

const kServerType = {
    LOGIN_SERVER: 0,
    GAME_SEVER: 1
}

class THSnapshot {

    game_servers = [];
    msn_servers = [];
    channels = [];

    login_packets = new SequencePacket();
    game_packets = new SequencePacket();

    login_packet_callbacks = new PacketAnalyzer();
    game_packet_callbacks = new PacketAnalyzer();

    player = {
        oid: 0,
        uid: 0,
        cap: 0,
        level: 0,
        pcbang_flag: 0,
        flag: 0n,
        id: 'irineu123',
        password: '123456',
        nickname: '',
        macros: [],
        key: '',
        key2: '',
        maked_room: false
    };

    host = {
        s: net.Socket(),
        data: Buffer.alloc(0),
        seq: 0,
        parseKey: -1,
    };

    finished = 0;
    reply_error = 'None';
    callback = null;

    constructor(_id, _password) {

        this.player.id = _id;
        this.player.password = _password;

        // Login Packet callbacks
        this.login_packet_callbacks.push([
            new PacketCallback(
                0,
                false,
                function(_pckt, _host) {

                    _host.parseKey = _pckt.Decode4();

                    console.log(`[C][L] Type: ${_pckt.type}, parseKey: ${_host.parseKey}, serverUID: ${_pckt.Decode4()}`);

                    const p = new Packet(1);

                    p.EncodeStr(this.player.id);
                    p.EncodeStr(this.player.password);
                    p.Encode1(2);
                    p.Encode8(0n);
                    p.Encode8(0x7FFFFFFFFFFFFFFFn);
                    p.Encode1(0);

                    _host.s.write(p.makePacket(_host.parseKey, _host.seq++));

                    this.login_packets.set_key('1');

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                1,
                false,
                function(_pckt, _host) {

                    let err = _pckt.Decode1();

                    if (err == 0) {

                        this.player.id = _pckt.DecodeStr();
                        this.player.uid = _pckt.Decode4();
                        this.player.cap = _pckt.Decode4();
                        this.player.level = _pckt.Decode1();
                        this.player.pcbang_flag = _pckt.Decode1();
                        this.player.flag = _pckt.Decode8();
                        this.player.nickname = _pckt.DecodeStr();

                        console.log('[C][L] ',
                            this.player.id, this.player.uid, this.player.cap, this.player.level,
                            this.player.pcbang_flag, this.player.flag, this.player.nickname
                        );

                    }else if (err == 0xE3) {

                       let code_err = _pckt.Decode4();

                       console.log(`[C][L] error login: ${err}, code: ${code_err}`);

                        if (code_err == 5100019) {

                            const p = new Packet(4);

                            _host.s.write(p.makePacket(_host.parseKey, _host.seq++));

                            this.login_packets.set_key('4');
                        }

                    }else
                       console.log(`[C][L] error login: ${err}`);

                }
                .bind(this)
            ),
            new PacketCallback(
                2,
                false,
                function(_pckt, _host) {

                    let count = _pckt.Decode1();

                    this.game_servers.splice(0, this.game_servers.length);

                    for (let i = 0; i < count; i++)
                        this.game_servers.push(_pckt.DecodeBuffer(92));

                    console.log('[C][L] ', this.game_servers);

                    setTimeout(() => {

                        const p = new Packet(3);

                        p.Encode4(this.game_servers[0].readUInt32LE(40));

                        _host.s.write(p.makePacket(_host.parseKey, _host.seq++));

                        this.login_packets.set_key('3');

                    }, 3000);
                }
                .bind(this)
            ),
            new PacketCallback(
                3,
                false,
                function(_pckt, _host) {

                    let err = _pckt.Decode4();

                    if (err == 0) {

                        this.player.key2 = _pckt.DecodeStr();

                        console.log('[C][L] ', this.player.key2);

                        // only login server
                        this.finished = 1;

                        _host.s.end();

                        _host.s = net.Socket();

                        console.log(`[C][L] try connect to game server[id: ${
                            this.game_servers[0].readUInt32LE(40)
                        }, name: ${
                            this.game_servers[0].toString('utf8', 0, 64)
                        }, ip: ${
                            this.game_servers[0].toString('utf8', 52, 70)
                        }, port: ${
                            this.game_servers[0].readUInt32LE(70)
                        }].`);

                        _host.s.connect(this.game_servers[0].readUInt32LE(70), this.game_servers[0].toString('utf8', 52, 70), () => {

                            console.log(`[C][G] connected with game server[id: ${
                                this.game_servers[0].readUInt32LE(40)
                            }, name: ${
                                this.game_servers[0].toString('utf8', 0, 64)
                            }, ip: ${
                                this.game_servers[0].toString('utf8', 52, 70)
                            }, port: ${
                                this.game_servers[0].readUInt32LE(70)
                            }].`);

                            _host.data = Buffer.alloc(0);
                            _host.parseKey = -1;
                            _host.seq = 0;
                        });

                        _host.s.on('error', (_err) => {
                            console.log('[C][G] connection with error: ', _err);

                            // reply
                            this.reply_error = `fail to connect login server, error: ${_err}`;
                        });

                        _host.s.on('end', () => {
                            console.log('[C][G] connection end');
                        });

                        _host.s.on('close', () => {
                            console.log('[C][G] connection close');

                            // reply
                            this.callback((this.finished == 2 || this.reply_error == 'None' ? true : false), this.reply_error);
                        });

                        _host.s.on('data', (_data) => {

                            _host.data = Buffer.concat([_host.data, _data]);

                            this.checkHavePacket(_host, kServerType.GAME_SEVER);
                        });

                    }else
                        console.log('[C][L] err: ', err);
 
                }
                .bind(this)
            ),
            new PacketCallback(
                6,
                false,
                function(_pckt, _host) {
                    
                    this.player.macros = [];

                    for (let i = 0; i < 9; i++)
                        this.player.macros.push(_pckt.DecodeBuffer(64).toString('utf8'));

                    console.log('[C][L] ', this.player.macros);

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                9,
                false,
                function(_pckt, _host) {

                    let count = _pckt.Decode1();

                    this.msn_servers.splice(0, this.msn_servers.length);

                    for (let i = 0; i < count; i++)
                        this.msn_servers.push(_pckt.DecodeBuffer(92));

                    console.log('[C][L] ', this.msn_servers);

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x10,
                false,
                function(_pckt, _host) {

                    this.player.key = _pckt.DecodeStr();

                    console.log('[C][L] ', this.player.key);

                    return false;
                }
                .bind(this)
            )
        ]);

        // Game Packet Callbacks
        this.game_packet_callbacks.push([
            new PacketCallback(
                0x3F,
                false,
                function(_pckt, _host) {

                    let opt1 = _pckt.Decode1();
                    let opt2 = _pckt.Decode1();
                    _host.parseKey = _pckt.Decode1();
                    let client_ip = _pckt.DecodeStr();

                    console.log('[C][G] ', opt1, opt2, _host.parseKey, client_ip);

                    const p = new Packet(2);

                    p.EncodeStr(this.player.id);
                    p.Encode4(this.player.uid);
                    p.Encode4(this.player.cap);
                    p.Encode2(0x6696);
                    p.EncodeStr(this.player.key);
                    p.EncodeStr(kClientVersion);
                    p.Encode4(kClientPacketVersion);
                    p.Encode4(0);
                    p.EncodeStr(this.player.key2);

                    _host.s.write(p.makePacket(_host.parseKey, _host.seq++));

                    this.game_packets.set_key('2');

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x44,
                false,
                function(_pckt, _host) {

                    let opt = _pckt.Decode1();

                    if (opt == 0) {

                        let client_version = _pckt.DecodeStr();
                        let room_number = _pckt.Decode2();

                        _pckt.Discart(89);

                        this.player.oid = _pckt.Decode4();

                        console.log(`[C][G] Login Game Server Ok, Client Version: ${
                            client_version
                        }, Room Number: ${
                            room_number
                        }, OID: ${this.player.oid}`);
                    }

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x49,
                false,
                function(_pckt, _host) {

                    let opt = _pckt.Decode1();

                    if (opt == 0) {

                        setTimeout(() => {

                            if (!this.player.maked_room) {

                                const p = new Packet(0xF);

                                p.Encode1(0);
                                p.Encode2(-1);
                                p.fillZeroByte(16);

                                _host.s.write(p.makePacket(_host.parseKey, _host.seq++));

                                this.game_packets.set_key('15');

                            }else {

                                const p = new Packet(14);

                                p.Encode4(this.player.oid);

                                _host.s.write(p.makePacket(_host.parseKey, _host.seq++));

                                this.game_packets.set_key('14');
                            }

                        }, 3000);

                    }else
                        console.log(`[C][G] failed in make room, error code: ${opt}`);

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x4C,
                false,
                function(_pckt, _host) {
                    
                    if (!this.player.maked_room) {

                        this.player.maked_room = true;

                        const p = new Packet(8);

                        p.Encode1(0);
                        p.Encode4(0);
                        p.Encode4(0x1B7740);
                        p.Encode1(1);
                        p.Encode1(0x13);
                        p.Encode1(0x12);
                        p.Encode1(0x14);
                        p.Encode1(4);
                        p.Encode1(1);
                        p.Encode4(7);
                        p.Encode4(0);
                        p.EncodeStr(Buffer.from([
                            0x53,0x69,0x6e,0x67,0x6c,0x65,0x20,0x50,
                            0x6c,0x61,0x79,0x65,0x72,0x20,0x50,0x72,
                            0x61,0x63,0x74,0x69,0x63,0x65,0x20,0x4d,0x6f,0x64,0x65
                        ]).toString('binary'));
                        p.EncodeStr(Buffer.from([
                            0x4d,0x44,0x41,0x79,0x4d,0x54,0x63,0x77
                        ]).toString('binary'));
                        p.Encode4(0);

                        _host.s.write(p.makePacket(_host.parseKey, _host.seq++));

                        this.game_packets.set_key('8-4');
                    }

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x4D,
                false,
                function(_pckt, _host) {

                    this.channels.splice(0, this.channels.length);

                    let count = _pckt.Decode1();

                    for (let i = 0; i < count; i++)
                        this.channels.push(_pckt.DecodeBuffer(77));

                    console.log('[C][G] ', this.channels);

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x4E,
                false,
                function(_pckt, _host) {

                    let err = _pckt.Decode1();

                    if (err == 1) {

                        setTimeout(() => {

                            const p = new Packet(0x2F);

                            p.Encode4(this.player.uid);
                            p.Encode1(5);

                            _host.s.write(p.makePacket(_host.parseKey, _host.seq++));

                            this.game_packets.set_key('47-5');

                        }, 3000);

                    }else
                        console.log(`[C][G] failed in enter to channel`);

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x77,
                false,
                function(_pckt, _host) {

                    if (kLoginServerIp != '127.0.0.1') {
                        this.login_packets.save(`login_packets-${this.player.id}`);
                        this.game_packets.save(`game_packets-${this.player.id}`);
                    }

                    this.finished = 2;

                    _host.s.end();

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x89,
                false,
                function(_pckt, _host) {

                    let err = _pckt.Decode4();

                    if (err == 1) {

                        let opt = _pckt.Decode1();
                        let uid = _pckt.Decode4();

                        console.log('[C][G] info ok ', opt, uid);

                        if (opt == 5) {

                            const p = new Packet(0x2F);

                            p.Encode4(this.player.uid);
                            p.Encode1(0);

                            _host.s.write(p.makePacket(_host.parseKey, _host.seq++));

                            this.game_packets.set_key('47-0');

                        }else if (opt == 0) {

                            const p = new Packet(0x157);

                            p.Encode4(this.player.uid);

                            _host.s.write(p.makePacket(_host.parseKey, _host.seq++));

                            this.game_packets.set_key('343');
                        }

                    }else
                        console.log(`[C][G] failed in get info user. err: ${err}`);

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x96,
                false,
                function(_pckt, _host) {

                    let cookie = _pckt.Decode8();

                    console.log(`[C][G] Cookie: ${cookie}`);

                    setTimeout(() => {

                        const p = new Packet(4);

                        p.Encode1(this.channels[1].readUInt8(68));

                        _host.s.write(p.makePacket(_host.parseKey, _host.seq++));

                        this.game_packets.set_key('4');

                    }, 5000);

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x22C,
                false,
                function(_pckt, _host) {

                    let opt = _pckt.Decode4();

                    console.log('[C][G] achievement reply: ', opt);

                    const p = new Packet(8);

                    p.Encode1(0);
                    p.Encode4(0);
                    p.Encode4(0x1B7740);
                    p.Encode1(1);
                    p.Encode1(0x13);
                    p.Encode1(0x12);
                    p.Encode1(0x14);
                    p.Encode1(0);
                    p.Encode4(0);
                    p.EncodeStr(Buffer.from([
                        0x53,0x69,0x6e,0x67,0x6c,0x65,0x20,0x50,0x6c,0x61,0x79,0x65,0x72,
                        0x20,0x50,0x72,0x61,0x63,0x74,0x69,0x63,0x65,0x20,0x4d,0x6f,0x64,0x65
                    ]).toString('binary'));
                    p.EncodeStr(Buffer.from([
                        0x4d,0x44,0x41,0x79,0x4d,0x54,0x63,0x77
                    ]).toString('binary'));
                    p.Encode4(0);

                    _host.s.write(p.makePacket(_host.parseKey, _host.seq++));

                    this.game_packets.set_key('8-0');

                    return false;
                }
                .bind(this)
            )
        ]);
    }

    start(_callback) {

        if (!_callback || !(_callback instanceof Function))
            return false;

        this.callback = _callback;

        this.host.s.connect(kLoginServerPort, kLoginServerIp, () => {
            console.log('[C][L] connected with Login Server.');
        });

        // set login timeout to 5 seconds
        this.host.s.setTimeout(5000);

        this.host.s.on('error', (_err) => {
            console.log('[C][L] error in socket from Login Server. Error: ', _err);

            // reply
            this.reply_error = `fail to connect login server, Error: ${_err}`;
        });

        this.host.s.on('end', () => {
            console.log('[C][L] end socket from Login Server');
        });

        this.host.s.on('close', () => {
            console.log('[C][L] closed socket from Login Server');

            // reply
            if (this.finished == 0)
                this.callback(false, this.reply_error);
        });

        this.host.s.on('timeout', () => {
            console.log('[C][L] timeout socket from Login Server');

            this.reply_error = 'timeout in try to connect login server';

            this.host.s.destroy();
        });

        this.host.s.on('data', (_data) => {

            this.host.data = Buffer.concat([this.host.data, _data]);

            this.checkHavePacket(this.host, kServerType.LOGIN_SERVER);
        });

        return true;
    }

    checkHavePacket(_host, _server_type) {

        const kPacketHeaderLength = 3;

        let length = 0;
        let bContinue = true;

        while (bContinue && _host.data.length > kPacketHeaderLength) {

            length = _host.data.readUInt16LE(1);

            if ((length + kPacketHeaderLength) > _host.data.length)
                return;

            const pckt = new Packet();

            pckt.unMakePacketComplete(
                _host.data.slice(0, length + kPacketHeaderLength),
                _host.parseKey
            );

            _host.data = _host.data.slice(length + kPacketHeaderLength);

            if (_server_type == kServerType.LOGIN_SERVER)
                bContinue = this.translateLoginPacket(_host, pckt);
            else if (_server_type == kServerType.GAME_SEVER)
                bContinue = this.translateGamePacket(_host, pckt);
        }
    }

    translateLoginPacket(_host, _pckt) {

        console.log(`[C][L] Packet.type: ${_pckt.type}`);

        _pckt.printToConsole();

        this.login_packets.add_sequence({
            type: _pckt.type,
            parseKey: _host.parseKey,
            data: _pckt.buff.slice(_pckt.offset, _pckt.size)
        });

        const status_translate = this.login_packet_callbacks.execute(_pckt, _host);

        if (status_translate.skip || status_translate.exit)
            return !status_translate.exit;

        return true;
    }

    translateGamePacket(_host, _pckt) {

        console.log(`[C][G] Packet.type: ${_pckt.type}`);

        _pckt.printToConsole();

        this.game_packets.add_sequence({
            type: _pckt.type,
            parseKey: _host.parseKey,
            data: _pckt.buff.slice(_pckt.offset, _pckt.size)
        });

        const status_translate = this.game_packet_callbacks.execute(_pckt, _host);

        if (status_translate.skip || status_translate.exit)
            return !status_translate.exit;

        return true;
    }
}

module.exports = THSnapshot;
