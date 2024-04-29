// Arquivo index.js
// Criado em 28/04/2024 por Acrisio
// TH Snapshot

const net = require('net');
const Packet = require('./packet/packet');
const SequencePacket = require('./util/sequence_packet');

const kLoginServerIp = '203.107.140.34';
//const kLoginServerIp = '127.0.0.1';
const kLoginServerPort = 10201;
const kClientVersion = '829.01';
const kClientPacketVersion = 0x254AD2C7;

const game_servers = [];
const msn_servers = [];
const channels = [];

const player = {
    oid: 0,
    uid: 0,
    cap: 0,
    level: 0,
    pcbang_flag: 0,
    flag: 0n,
    id: '#Coloque seu id aqui',
    password: '#Coloque sua senha aqui',
    nickname: '',
    macros: [],
    key: '',
    key2: '',
    maked_room: false
}

const login_packets = new SequencePacket();
const game_packets = new SequencePacket();

class THSnapshot {

    constructor() {
    }

    start() {

        const host = {
            s: net.Socket(),
            data: Buffer.alloc(0),
            seq: 0,
            parseKey: -1,
        };

        host.s.connect(kLoginServerPort, kLoginServerIp, function() {
            console.log('connected with Login Server.');
        });

        host.s.on('error', function(err) {
            console.log('error in socket from Login Server. Error: ', err);
        });

        host.s.on('end', function() {
            console.log('end socket from Login Server');
        });

        host.s.on('close', function() {
            console.log('closed socket from Login Server');
        });

        host.s.on('data', function(data) {
            host.data = Buffer.concat([host.data, data]);

            while (host.data.length > 3) {

                let bf2 = host.data.readUInt16LE(1);

                if ((bf2 + 3) > host.data.length)
                    return;

                bf2 = host.data.slice(0, bf2 + 3);

                host.data = host.data.slice(bf2.length);

                const pckt = new Packet();

                pckt.unMakePacketComplete(bf2, host.parseKey);

                console.log(`Packet.type: ${pckt.type}`);

                login_packets.add_sequence({
                    type: pckt.type,
                    parseKey: host.parseKey,
                    data: pckt.buff.slice(pckt.offset, pckt.size)
                });

                switch (pckt.type) {
                case 0:
                    host.parseKey = pckt.Decode4();

                    console.log(`Type: ${pckt.type}, parseKey: ${host.parseKey}, serverUID: ${pckt.Decode4()}`);

                    const pckt2 = new Packet(1);

                    pckt2.EncodeStr(player.id);
                    pckt2.EncodeStr(player.password);
                    pckt2.Encode1(2);
                    pckt2.Encode8(0n);
                    pckt2.Encode8(0x7FFFFFFFFFFFFFFFn);
                    pckt2.Encode1(0);

                    let bf = pckt2.makePacket(host.parseKey, host.seq++);

                    host.s.write(bf);

                    login_packets.set_key('1');
                    break;
                 case 1:
                    let err = pckt.Decode1();
                    if (err == 0) {

                        player.id = pckt.DecodeStr();
                        player.uid = pckt.Decode4();
                        player.cap = pckt.Decode4();
                        player.level = pckt.Decode1();
                        player.pcbang_flag = pckt.Decode1();
                        player.flag = pckt.Decode8();
                        player.nickname = pckt.DecodeStr();

                        console.log(
                            player.id, player.uid, player.cap, player.level, player.pcbang_flag, player.flag, player.nickname
                        );

                    }else if (err == 0xE3) {
                       let code_err = pckt.Decode4();

                       console.log(`error login: ${err}, code: ${code_err}`);

                        if (code_err == 5100019) {

                            const pckt7 = new Packet(4);

                            host.s.write(pckt7.makePacket(host.parseKey, host.seq++));

                            login_packets.set_key('4');
                        }
                    }else
                       console.log(`error login: ${err}`);

                    break;
                 case 2:
                    let count = pckt.Decode1();
                    game_servers.splice(0, game_servers.length);
                    for (let i = 0; i < count; i++)
                        game_servers.push(pckt.DecodeBuffer(92));
                    console.log(game_servers);

                    setTimeout(() => {

                        const pckt4 = new Packet(3);

                        pckt4.Encode4(game_servers[0].readUInt32LE(40));

                        host.s.write(pckt4.makePacket(host.parseKey, host.seq++));

                        login_packets.set_key('3');

                    }, 3000);
                    break;
                 case 3:
                    let err2 = pckt.Decode4();
                    if (err2 == 0) {

                        player.key2 = pckt.DecodeStr();

                        console.log(player.key2);

                        host.s.end();

                        host.s = net.Socket();

                        console.log(`Try connect to Game Server[ID: ${
                            game_servers[0].readUInt32LE(40)
                        }, Name: ${
                            game_servers[0].toString('utf8', 0, 64)
                        }, IP: ${
                            game_servers[0].toString('utf8', 52, 70)
                        }, PORT: ${
                            game_servers[0].readUInt32LE(70)
                        }].`);

                        host.s.connect(game_servers[0].readUInt32LE(70), game_servers[0].toString('utf8', 52, 70), function() {
                            console.log(`Connected with Game Server[ID: ${
                                game_servers[0].readUInt32LE(40)
                            }, Name: ${
                                game_servers[0].toString('utf8', 0, 64)
                            }, IP: ${
                                game_servers[0].toString('utf8', 52, 70)
                            }, PORT: ${
                                game_servers[0].readUInt32LE(70)
                            }].`);

                            host.data = Buffer.alloc(0);
                            host.parseKey = -1;
                            host.seq = 0;
                        });

                        host.s.on('error', (err) => {
                            console.log('connection with error: ', err);
                        });

                        host.s.on('end', () => {
                            console.log('connection end');
                        });

                        host.s.on('close', () => {
                            console.log('connection close');
                        });

                        host.s.on('data', function(data) {
                            host.data = Buffer.concat([host.data, data]);

                            while (host.data.length > 3) {

                                let bf2 = host.data.readUInt16LE(1);

                                if ((bf2 + 3) > host.data.length)
                                    return;

                                bf2 = host.data.slice(0, bf2 + 3);

                                host.data = host.data.slice(bf2.length);

                                const pckt = new Packet();

                                pckt.unMakePacketComplete(bf2, host.parseKey);

                                console.log(`Packet.type: ${pckt.type}`);

                                game_packets.add_sequence({
                                    type: pckt.type,
                                    parseKey: host.parseKey,
                                    data: pckt.buff.slice(pckt.offset, pckt.size)
                                });

                                switch (pckt.type) {
                                    case 0x3F:
                                        let opt1 = pckt.Decode1();
                                        let opt2 = pckt.Decode1();
                                        host.parseKey = pckt.Decode1();
                                        let client_ip = pckt.DecodeStr();
                                        console.log(opt1, opt2, host.parseKey, client_ip);

                                        const pckt2 = new Packet(2);

                                        pckt2.EncodeStr(player.id);
                                        pckt2.Encode4(player.uid);
                                        pckt2.Encode4(player.cap);
                                        pckt2.Encode2(0x6696);
                                        pckt2.EncodeStr(player.key);
                                        pckt2.EncodeStr(kClientVersion);
                                        pckt2.Encode4(kClientPacketVersion);
                                        pckt2.Encode4(0);
                                        pckt2.EncodeStr(player.key2);

                                        host.s.write(pckt2.makePacket(host.parseKey, host.seq++));

                                        game_packets.set_key('2');
                                        break;
                                    case 0x44:
                                        let opt_i = pckt.Decode1();

                                        if (opt_i == 0) {

                                            let client_version = pckt.DecodeStr();
                                            let room_number = pckt.Decode2();

                                            pckt.Discart(89);

                                            player.oid = pckt.Decode4();
                                            
                                            console.log(`Login Game Server Ok, Client Version: ${
                                                client_version
                                            }, Room Number: ${
                                                room_number
                                            }, OID: ${player.oid}`);
                                        }
                                        break;
                                    case 0x49:
                                        let opt_r = pckt.Decode1();

                                        if (opt_r == 0) {

                                            setTimeout(() => {

                                                if (!player.maked_room) {

                                                    const pckt11 = new Packet(0xF);

                                                    pckt11.Encode1(0);
                                                    pckt11.Encode2(-1);
                                                    pckt11.fillZeroByte(16);

                                                    host.s.write(pckt11.makePacket(host.parseKey, host.seq++));

                                                    game_packets.set_key('15');

                                                }else {

                                                    const pckt20 = new Packet(14);

                                                    pckt20.Encode4(player.oid);

                                                    host.s.write(pckt20.makePacket(host.parseKey, host.seq++));

                                                    game_packets.set_key('14');
                                                }
                                            }, 3000);
                                        }else
                                            console.log(`failed in make room, error code: ${opt_r}`);
                                        break;
                                    case 0x4C:
                                        if (!player.maked_room) {

                                            player.maked_room = true;

                                            const pckt12 = new Packet(8);

                                            pckt12.Encode1(0);
                                            pckt12.Encode4(0);
                                            pckt12.Encode4(0x1B7740);
                                            pckt12.Encode1(1);
                                            pckt12.Encode1(0x13);
                                            pckt12.Encode1(0x12);
                                            pckt12.Encode1(0x14);
                                            pckt12.Encode1(4);
                                            pckt12.Encode1(1);
                                            pckt12.Encode4(7);
                                            pckt12.Encode4(0);
                                            pckt12.EncodeStr(Buffer.from([
                                                0x53,0x69,0x6e,0x67,0x6c,0x65,0x20,0x50,
                                                0x6c,0x61,0x79,0x65,0x72,0x20,0x50,0x72,
                                                0x61,0x63,0x74,0x69,0x63,0x65,0x20,0x4d,0x6f,0x64,0x65
                                            ]).toString('binary'));
                                            pckt12.EncodeStr(Buffer.from([
                                                0x4d,0x44,0x41,0x79,0x4d,0x54,0x63,0x77
                                            ]).toString('binary'));
                                            pckt12.Encode4(0);

                                            host.s.write(pckt12.makePacket(host.parseKey, host.seq++));

                                            game_packets.set_key('8-4');

                                        }else {

                                            if (kLoginServerIp != '127.0.0.1') {
                                                login_packets.save(`login_packets-${player.id}`);
                                                game_packets.save(`game_packets-${player.id}`);
                                            }

                                            host.s.end();
                                        }
                                        break;
                                    case 0x4D:
                                        channels.splice(0, channels.length);
                                        let count = pckt.Decode1();
                                        for (let i = 0; i < count; i++)
                                            channels.push(pckt.DecodeBuffer(77));
                                        console.log(channels);
                                        break;
                                    case 0x4E:
                                        let err2 = pckt.Decode1();
                                        if (err2 == 1) {

                                            setTimeout(() => {

                                                const pckt5 = new Packet(0x2F);

                                                pckt5.Encode4(player.uid);
                                                pckt5.Encode1(5);

                                                host.s.write(pckt5.makePacket(host.parseKey, host.seq++));

                                                game_packets.set_key('47-5');

                                            }, 3000);

                                        }else
                                            console.log(`failed in enter to channel`);
                                        break;
                                    case 0x77:
                                        // !@
                                        if (kLoginServerIp != '127.0.0.1') {
                                            login_packets.save(`login_packets-${player.id}`);
                                            game_packets.save(`game_packets-${player.id}`);
                                        }
                                        host.s.end();
                                        break;
                                    case 0x89:
                                        let err3 = pckt.Decode4();
                                        if (err3 == 1) {

                                            let opt_s = pckt.Decode1();
                                            let uid = pckt.Decode4();

                                            console.log('info ok ', opt_s, uid);

                                            if (opt_s == 5) {

                                                const pckt6 = new Packet(0x2F);

                                                pckt6.Encode4(player.uid);
                                                pckt6.Encode1(0);

                                                host.s.write(pckt6.makePacket(host.parseKey, host.seq++));

                                                game_packets.set_key('47-0');

                                            }else if (opt_s == 0) {

                                                const pckt8 = new Packet(0x157);

                                                pckt8.Encode4(player.uid);

                                                host.s.write(pckt8.makePacket(host.parseKey, host.seq++));

                                                game_packets.set_key('343');
                                            }

                                        }else
                                            console.log(`failed in get info user. err: ${err3}`);
                                        break;
                                    case 0x96:
                                        let cookie = pckt.Decode8();

                                        console.log(`Cookie: ${cookie}`);

                                        setTimeout(() => {

                                            const pckt4 = new Packet(4);

                                            pckt4.Encode1(channels[1].readUInt8(68));

                                            host.s.write(pckt4.makePacket(host.parseKey, host.seq++));

                                            game_packets.set_key('4');

                                        }, 5000);
                                        break;
                                    case 0x22C:
                                        let opt_acv = pckt.Decode4();
                                        console.log('achievement reply: ', opt_acv);

                                        const pckt10 = new Packet(8);

                                        pckt10.Encode1(0);
                                        pckt10.Encode4(0);
                                        pckt10.Encode4(0x1B7740);
                                        pckt10.Encode1(1);
                                        pckt10.Encode1(0x13);
                                        pckt10.Encode1(0x12);
                                        pckt10.Encode1(0x14);
                                        pckt10.Encode1(0);
                                        pckt10.Encode4(0);
                                        pckt10.EncodeStr(Buffer.from([
                                            0x53,0x69,0x6e,0x67,0x6c,0x65,0x20,0x50,0x6c,0x61,0x79,0x65,0x72,
                                            0x20,0x50,0x72,0x61,0x63,0x74,0x69,0x63,0x65,0x20,0x4d,0x6f,0x64,0x65
                                        ]).toString('binary'));
                                        pckt10.EncodeStr(Buffer.from([
                                            0x4d,0x44,0x41,0x79,0x4d,0x54,0x63,0x77
                                        ]).toString('binary'));
                                        pckt10.Encode4(0);

                                        host.s.write(pckt10.makePacket(host.parseKey, host.seq++));

                                        game_packets.set_key('8-0');
                                        break;
                                    default:
                                        pckt.printToConsole();
                                }
                            }
                        });
                    }else
                        console.log('err2: ', err2);
                    break;
                 case 6:
                    player.macros = [];
                    for (let i = 0; i < 9; i++)
                        player.macros.push(pckt.DecodeBuffer(64).toString('utf8'));
                    console.log(player.macros);
                    break;
                 case 9:
                    let count2 = pckt.Decode1();
                    msn_servers.splice(0, msn_servers.length);
                    for (let i = 0; i < count2; i++)
                        msn_servers.push(pckt.DecodeBuffer(92));
                    console.log(msn_servers);
                    break;
                 case 0x10:
                    player.key = pckt.DecodeStr();
                    console.log(player.key);
                    break;
                 default:
                    pckt.printToConsole();
                }
            }
        });
    }
}

const th = new THSnapshot();

th.start();
