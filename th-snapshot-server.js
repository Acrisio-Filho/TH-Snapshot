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

function getCurrentDateAsSYSTEMTIME() {

    const st = Buffer.alloc(16);

    const dt = new Date();

    st.writeUInt16LE(dt.getFullYear(), 0);
    st.writeUInt16LE(dt.getMonth(), 2);
    st.writeUInt16LE(dt.getDay(), 4);
    st.writeUInt16LE(dt.getDate(), 6);
    st.writeUInt16LE(dt.getHours(), 8);
    st.writeUInt16LE(dt.getMinutes(), 10);
    st.writeUInt16LE(dt.getSeconds(), 12);
    st.writeUInt16LE(dt.getMilliseconds(), 14);

    return st;
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

                    // init player info
                    _socket.player_characters = [];
                    _socket.player_caddies = [];
                    _socket.player_mascots = [];
                    _socket.player_warehouse_items = [];

                    _socket.player_character = function(_id = undefined) {

                        if (_id === undefined)
                            return this.player_user_equip.readUInt32LE(4);

                        this.player_user_equip.writeUInt32LE(_id, 4);

                        this.player_ei_character  = _socket.findCharacter(_id);
                    }

                    _socket.player_caddie = function(_id = undefined) {

                        if (_id === undefined)
                            return this.player_user_equip.readUInt32LE(0);

                        this.player_user_equip.writeUInt32LE(_id, 0);

                        this.player_ei_caddie = _socket.findCaddie(_id);
                    }

                    _socket.player_clubset = function(_id = undefined) {

                        if (_id === undefined)
                            return this.player_user_equip.readUInt32LE(8);

                        this.player_user_equip.writeUInt32LE(_id, 8);

                        this.player_ei_clubset = this.findWarehouseItem(_id);

                        if (this.player_ei_clubset) {
                            
                            this.player_ei_csi = Buffer.alloc(28);

                            this.player_ei_csi.writeInt32LE(this.player_ei_clubset.readInt32LE(0));
                            this.player_ei_csi.writeUInt32LE(this.player_ei_clubset.readUInt32LE(4), 4);
                            this.player_ei_clubset.copy(this.player_ei_csi, 8, 12, 22);
                            this.player_ei_clubset.copy(this.player_ei_csi, 18, 170, 182);
                        }
                    }

                    _socket.player_ball = function(_typeid = undefined) {

                        if (_typeid === undefined)
                            return this.player_user_equip.readUInt32LE(12);

                        this.player_user_equip.writeUInt32LE(_typeid, 12);
                    }

                    _socket.player_mascot = function(_id = undefined) {

                        if (_id === undefined)
                            return this.player_user_equip.readUInt32LE(104);

                        this.player_user_equip.writeUInt32LE(104);

                        this.player_ei_mascot  = _socket.findMascot(_id);
                    }

                    _socket.player_itemslot = function(_bf = undefined) {

                        if (_bf === undefined)
                            return this.player_user_equip.slice(16, 56);

                        _bf.copy(this.player_user_equip, 16, 0, 40);
                    }

                    _socket.player_skins = function(_bf = undefined) {

                        if (_bf === undefined)
                            return this.player_user_equip.slice(80, 104);

                        _bf.copy(this.player_user_equip, 80, 0, 24);
                    }

                    _socket.player_poster = function(_bf = undefined) {

                        if (_bf === undefined)
                            return this.player_user_equip.slice(108, 116);

                        _bf.copy(this.player_user_equip, 108, 0, 8);
                    }

                    _socket.findCharacter = function(_id) {
                        return this.player_characters.filter(el => el.readInt32LE(4) == _id).shift();
                    }

                    _socket.findCaddie = function(_id) {
                        return this.player_caddies.filter(el => el.readInt32LE(0) == _id).shift();
                    }

                    _socket.findMascot = function(_id) {
                        return this.player_mascots.filter(el => el.readInt32LE(0) == _id).shift();
                    }

                    _socket.findWarehouseItem = function(_id) {
                        return this.player_warehouse_items.filter(el => el.readInt32LE(0) == _id).shift();
                    }

                    _socket.findWarehouseItemByTypeid = function(_typeid) {
                        return this.player_warehouse_items.filter(el => el.readInt32LE(4) == _typeid).shift();
                    }

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0xA,
                true,
                function(_pckt, _socket) {

                    _pckt.Discart(2);

                    let count = _pckt.Decode1();

                    if (count <= 0)
                        return false;

                    for (let i = 0; i < count; i++) {

                        let type = _pckt.Decode1();

                        switch (type) {
                            case 0: // name
                                _socket.room.name = _pckt.DecodeStr();
                                break;
                            case 3: // course
                                _socket.room.course = _pckt.Decode1();
                                break;
                            case 4: // qntd hole
                                _socket.room.qntd_hole = _pckt.Decode1();
                                break;
                            case 5: // modo
                                _socket.room.modo = _pckt.Decode1();
                                break;
                            case 8: // time 30s
                                _socket.room.time_30s = _pckt.Decode1() * 60000;
                                break;
                            case 0xB: // hole repeat
                                _socket.room.hole_repeat = _pckt.Decode1();
                                break;
                            case 0xC: // fixed hole
                                _socket.room.fixed_hole = _pckt.Decode4();
                                break;
                            case 0xE: // natural
                                _socket.room.natural = _pckt.Decode4();
                                break;
                        }
                    }

                    const p = new Packet(0x4A);

                    p.Encode2(-1);
                    p.Encode1(_socket.room.tipo);
                    p.Encode1(_socket.room.course);
                    p.Encode1(_socket.room.qntd_hole);
                    p.Encode1(_socket.room.modo);

                    if (_socket.room.modo == 4) {
                        p.Encode1(_socket.room.hole_repeat);
                        p.Encode4(_socket.room.fixed_hole);
                    }

                    p.Encode4(_socket.room.natural);
                    p.Encode1(_socket.room.max_player);
                    p.Encode1(30);
                    p.Encode1(0);
                    p.Encode4(0);
                    p.Encode4(_socket.room.time_30s);
                    p.Encode4(0);
                    p.Encode1(0);
                    p.EncodeStr(_socket.room.name);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0xC,
                true,
                function(_pckt, _socket) {

                    let opt = _pckt.Decode1();

                    switch (opt) {
                        case 1: // caddie
                            _socket.player_caddie(_pckt.Decode4(true));
                            break;
                        case 2: // ball
                            _socket.player_ball(_pckt.Decode4());
                            break;
                        case 3: // clubset
                            _socket.player_clubset(_pckt.Decode4(true));
                            break;
                        case 4: // character
                            _socket.player_character(_pckt.Decode4(true));
                            break;
                        case 5: // mascot
                            _socket.player_mascot(_pckt.Decode4(true));
                            break;
                        case 7: // start
                            _socket.player_character(_pckt.Decode4(true));
                            _socket.player_caddie(_pckt.Decode4(true));
                            _socket.player_clubset(_pckt.Decode4(true));
                            _socket.player_ball(_pckt.Decode4());
                            this.startGame(_socket);
                            return false;
                    }

                    const p = new Packet(0x4B);

                    p.Encode4(0);

                    p.Encode1(opt);

                    switch (opt) {
                        case 1: // caddie
                            if (_socket.player_ei_caddie)
                                p.EncodeBuffer(_socket.player_ei_caddie);
                            else
                                p.fillZeroByte(25);
                            break;
                        case 2: // ball
                            p.Encode4(_socket.player_ball());
                            break;
                        case 3: // clubset
                            if (_socket.player_ei_csi)
                                p.EncodeBuffer(_socket.player_ei_csi);
                            else
                                p.fillZeroByte(28);
                            break;
                        case 4: // character
                            if (_socket.player_ei_character)
                                p.EncodeBuffer(_socket.player_ei_character);
                            else
                                p.fillZeroByte(513);
                            break;
                        case 5: // mascot
                            if (_socket.player_ei_mascot)
                                p.EncodeBuffer(_socket.player_ei_mascot);
                            else
                                p.fillZeroByte(62);
                            break;
                    }

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x11,
                true,
                function(_pckt, _socket) {

                    const p = new Packet(0x53);

                    p.Encode4(_socket.player_oid);

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x17,
                true,
                function(_pckt, _socket) {

                    const p = new Packet(0x5A);

                    p.Encode4(_pckt.Decode4());
                    p.Encode4(randomInt(0, 0xFFFFFFFF));
                    p.Encode4(_socket.player_oid);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x19,
                true,
                function(_pckt, _socket) {

                    _socket.player_shot++;

                    const p = new Packet(0x60);

                    p.EncodeBuffer(_pckt.DecodeBuffer(12));

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x1A,
                true,
                function(_pckt, _socket) {

                    _pckt.Discart(9);

                    _socket.par_hole = _pckt.Decode1();
                    _socket.total_shot += _socket.shot;
                    _socket.total_pang += _socket.player_pang;
                    _socket.total_bonus_pang += _socket.player_bonus_pang;
                    _socket.shot = 0;
                    _socket.player_pang = 0m;
                    _socket.player_bonus_pang = 0m

                    const p = new Packet(0x9E);

                    if (_socket.last_weather == 1)
                        _socket.last_weather = 2;
                    else
                        _socket.last_weather = randomInt(0, 3);

                    p.Encode(1);
                    p.Encode2(0);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    p.reset(0x5B);

                    p.Encode1(randomInt(0, 9));
                    p.Encode1(0);
                    p.Encode1(randomInt(0, 256) & 0xFF);
                    p.Encode1(0);
                    p.Encode1(1);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    p.reset(0x8D);

                    p.Encode4(0);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x1B,
                true,
                function(_pckt, _socket) {

                    const ssd = _pckt.DecodeBuffer(38);

                    for (let i = 0; i < 38; i++)
                        ssd[i] ^= _socket.room.key[i % 16];

                    _socket.player_pang = BigInt(ssd.readUInt32LE(19)) - _socket.total_pang;
                    _socket.player_bonus_pang = BigInt(ssd.readUInt32LE(23)) - _socket.total_bonus_pang;
                    _socket.player_shot++;

                    const p = new Packet(0x6E);

                    p.Encode4(_socket.player_oid);
                    p.Encode1(_socket.holes[_socket.hole_seq]);
                    p.Encode4(ssd.readFloatLE(4));
                    p.Encode4(ssd.readFloatLE(12));
                    p.Encode4(ssd.readUInt32LE(31));
                    p.Encode4(ssd.readUInt16LE(35));

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x1C,
                true,
                function(_pckt, _socket) {

                    const p = new Packet(0xCC);

                    p.Encode4(_socket.player_oid);
                    p.Encode1(0);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x20,
                true,
                function(_pckt, _socket) {

                    let opt = _pckt.Decode1();

                    switch (opt) {
                        case 0: // character all equips
                            {
                                const char_all_equips = _pckt.DecodeBuffer(513);

                                const character = _socket.findCharacter(char_all_equips.readInt32LE(4));
                                
                                if (character)
                                    char_all_equips.copy(character);

                                break;
                            }
                        case 1: // caddie
                            _socket.player_caddie(_pckt.Decode4(true));
                            break;
                        case 2: // itemslot
                            _socket.player_itemslot(_pckt.DecodeBuffer(40));
                            break;
                        case 3: // ball and clubset
                            _socket.player_ball(_pckt.Decode4());
                            _socket.player_clubset(_pcket.Decode4(true));
                            break;
                        case 4: // skins
                            _socket.player_skins(_pckt.DecodeBuffer(24));
                            break;
                        case 5: // character id
                            _socket.player_character(_pckt.Decode4(true));
                            break;
                        case 8: // mascot
                            _socket.player_mascot(_pckt.Decode4(true));
                            break;
                        case 9: // cutin
                            {
                                const character = _socket.findCharacter(_pckt.Decode4(true));

                                if (character) {

                                    const cutin = _pckt.DecodeBuffer(16);

                                    cutin.copy(character, 440);
                                }

                                break;
                            }
                        case 10: // poster
                            _socket.player_poster(_pckt.DecodeBuffer(8));
                            break;
                    }

                    const p = new Packet(0x6B);

                    p.Encode1(4);
                    p.Encode1(opt);

                    switch (opt) {
                        case 0: // character all equips
                            if (_socket.player_ei_character)
                                p.EncodeBuffer(_socket.player_ei_character);
                            else
                                p.fillZeroByte(513);
                            break;
                        case 1: // caddie
                            if (_socket.player_ei_caddie)
                                p.EncodeBuffer(_socket.player_ei_caddie);
                            else
                                p.fillZeroByte(25);
                            break;
                        case 2: // itemslot
                            p.EncodeBuffer(_socket.player_itemslot());
                            break;
                        case 3: // ball and clubset
                            p.Encode4(_socket.player_ball());
                            p.Encode4(_socket.player_clubset());
                            break;
                        case 4: // skins
                            p.EncodeBuffer(_socket.player_skins());
                            break;
                        case 5: // character
                            p.Encode4(_socket.player_character());
                            break;
                        case 8: // mascot
                            if (_socket.player_ei_mascot)
                                p.EncodeBuffer(_socket.player_ei_mascot);
                            else
                                p.fillZeroByte(62);
                            break;
                        case 9: // cutin
                            if (_socket.player_ei_character) {

                                p.Encode4(_socket.player_ei_character.readInt32LE(4));
                                p.EncodeBuffer(_socket.player_ei_character.slice(440, 460));

                            }else
                                p.fillZeroByte(20);
                            break;
                        case 10: // poster
                            p.EncodeBuffer(_socket.poster());
                            break;
                    }

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x31,
                true,
                function(_pckt, _socket) {
                    
                    if ((_socket.hole_seq + 1) < _socket.room.qntd_hole) {

                        const p = new Packet(0x6D);

                        p.Encode4(_socket.player_oid);
                        p.Encode1(_socket.holes[_socket.hole_seq]);
                        p.Encode1(_socket.total_shot);
                        p.Encode4(_socket.player_shot - _socket.par_hole);
                        p.Encode8(_socket.player_pang);
                        p.Encode8(_socket.player_bonus_pang);
                        p.Encode1(1);

                        _socket.write(p.makePacketComplete(_socket.parseKey));

                    }else {

                        const p = new Packet(0x199);

                        _socket.write(p.makePacketComplete(_socket.parseKey));

                        p.reset(0x6D);

                        p.Encode4(_socket.player_oid);
                        p.Encode1(_socket.holes[_socket.hole_seq]);
                        p.Encode1(_socket.total_shot);
                        p.Encode4(_socket.player_shot - _socket.par_hole);
                        p.Encode8(_socket.player_pang);
                        p.Encode8(_socket.player_bonus_pang);
                        p.Encode1(1);

                        _socket.write(p.makePacketComplete(_socket.parseKey));

                        p.reset(0x6C);

                        p.Encode4(_socket.player_oid);
                        p.Encode1(2);

                        _socket.write(p.makePacketComplete(_socket.parseKey));

                        p.reset(0xCE);

                        p.Encode1(0);
                        p.Encode2(0);

                        _socket.write(p.makePacketComplete(_socket.parseKey));

                        p.reset(0x79);

                        p.Encode4(0);
                        p.Encode4(0);
                        p.Encode1(0);
                        p.Encode1(2);

                        for (let i = 0; i < 6; i++) {
                            p.Encode4(-1);
                            p.Encode4(0);
                        }

                        _socket.write(p.makePacketComplete(_socket.parseKey));
                    }

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x65,
                true,
                function(_pckt, _socket) {

                    const p = new Packet(0xC7);

                    p.EncodeFloat(_pckt.DecodeFloat);
                    p.Encode4(_socket.player_oid);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x12F,
                true,
                function(_pckt, _socket) {

                    const seld = _pckt.DecodeBuffer(87);

                    const p = new Packet(0x1F7);

                    p.Encode4(_socket.player_oid);
                    p.Encode1(_socket.holes[_socket.hole_seq]);
                    p.EncodeBuffer(seld);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x184,
                true,
                function(_pckt, _socket) {

                    const assist = _socket.findWarehouseItemByTypeid(0x1BE00016);

                    if (!assist) {

                        const p = new Packet(0x26A);

                        p.Encode4(1);

                        _socket.write(p.makePacketComplete(_socket.parseKey));

                        return false;
                    }

                    let qntd = assist.readUInt16LE(12);
                    let qntd_dep = qntd;

                    if (qntd == 1) {

                        qntd_dep = qntd + 1;

                        assist.writeUInt16LE(qntd_dep, 12);

                    }else {

                        qntd_dep = qntd - 1;

                        assist.writeUInt16LE(qntd_dep, 12);
                    }

                    const p = new Packet(0x216);

                    p.Encode4((new Date()).getTime() & 0xFFFFFFFF);
                    p.Encode4(1);
                    p.Encode1(2);
                    p.Encode4(assist.readUInt32LE(4));
                    p.Encode4(assist.readInt32LE(0));
                    p.Encode4(0);
                    p.Encode4(qntd);
                    p.Encode4(qntd_dep);
                    p.Encode4(qntd_dep - qntd);
                    p.fillZeroByte(25);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    p.reset(0x26A);

                    p.Encode4(0);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x185,
                true,
                function(_pckt, _socket) {

                    const p = new Packet(0x26B);

                    p.Encode4(0);
                    p.Encode4(_pckt.Decode4());
                    p.Encode4(_socket.player_uid);

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
        this.game_client_packet_callbacks.push([
            new PacketCallback(
                0x44,
                false,
                function(_pckt, _socket) {

                    let opt = _pckt.Decode1();

                    if (opt == 0) {

                        let client_version = _pckt.DecodeStr();
                        let room_number = _pckt.Decode2(true);

                        _pckt.Discart(89);

                        this.player_oid = _pckt.Decode4();

                        _pckt.Discart(172);

                        this.player_uid = _pckt.Decode4();

                        console.log(`[S][G] Login Game Server Ok, Client Version: ${
                            client_version
                        }, Room Number: ${
                            room_number
                        }, OID: ${this.player_oid}, UID: ${this.player_uid}`);
                    }

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x49,
                false,
                function(_pckt, _socket) {

                    // maked room
                    _socket.room = {
                        number: 0,
                        name: 'practice',
                        pass: '123456',
                        tipo: 4,
                        course: 0,
                        modo: 0,
                        time_30s: 30 * 60000,
                        qntd_hole: 18,
                        max_player: 1,
                        hole_repeat: 1,
                        fixed_hole: 0,
                        natural: 0,
                        key: Buffer.alloc(16)
                    };

                    _socket.room.name = _pckt.DecodeBuffer(64).toString('utf8');
                    _pckt.Discart(3);
                    _socket.room.max_player = _pckt.Decode1();
                    _pckt.Discart(1);
                    _socket.room.key = _pckt.DecodeBuffer(16);
                    _socket.room.Discart(2);
                    _socket.room.qntd_hole = _pckt.Decode1();
                    _socket.room.tipo = _pckt.Decode1();
                    _socket.room.number = _pckt.Decode2(true);
                    _socket.room.modo = _pckt.Decode1();
                    _socket.room.course = _pckt.Decode1();
                    _pckt.Discart(4);
                    _socket.room.time_30s = _pckt.Decode4();
                    _pckt.Discart(100); // !@
                    _socket.room.natural = _pckt.Decode4();

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x70,
                false,
                function(_pckt, _socket) {

                    _pckt.Discart(2);

                    let count = _pckt.Decode2();

                    for (let i = 0; i < count; i++)
                        _socket.player_characters.push(_pckt.DecodeBuffer(513));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x71,
                false,
                function(_pckt, _socket) {

                    _pckt.Discart(2);

                    let count = _pckt.Decode2();

                    for (let i = 0; i < count; i++)
                        _socket.player_caddies.push(_pckt.DecodeBuffer(25));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x72,
                false,
                function(_pckt, _socket) {

                    _socket.player_user_equip = _pckt.DecodeBuffer(116);

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x73,
                false,
                function(_pckt, _socket) {

                    _pckt.Discart(2);

                    let count = _pckt.Decode2();

                    for (let i = 0; i < count; i++)
                        _socket.player_warehouse_items.push(_pckt.DecodeBuffer(196));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0xE1,
                false,
                function(_pckt, _socket) {

                    let count = _pckt.Decode1();

                    for (let i = 0; i < count; i++)
                        _socket.player_mascots.push(_pckt.DecodeBuffer(62));

                    return false;
                }
                .bind(this)
            )
        ]);

        // login packet conflict callbacks

        // game packet conflict callbacks
        this.game_packet_conflict_callbacks.push([
            new PacketCallback(
                8,
                false,
                function(_pckt, _objKey) {

                    _pckt.Discart(13);

                    let modo = _pckt.Decode1();

                    console.log(`[S][G] Request make room, modo: ${modo}`);

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

                    console.log(`[S][G] Request info do player: ${uid}, opt: ${opt}`);

                    _objKey.key = `${_pckt.type}-${opt}`;

                    return false;
                }
                .bind(this)
            )
        ]);
    }

    startGame(_socket) {

        // init player game info
        _socket.last_weather = 0;
        _socket.hole_seq = 0;
        _socket.holes = Array.from({length: 18}, (_, i) => i + 1);
        _socket.player_pang = 0m;
        _socket.player_bonus_pang = 0m;
        _socket.par_hole = 4;
        _socket.player_shot = 0;
        _socket.total_shot = 0;
        _socket.total_pang = 0m;
        _socket.total_bonus_pang = 0m;

        const p = new Packet(0x76);

        p.Encode1(_socket.room.tipo);
        p.Encode4(1);
        p.EncodeBuffer(getCurrentDateAsSYSTEMTIME());

        _socket.write(p.makePacketComplete(_socket.parseKey));

        // random course
        if (_socket.room.modo != 4 && (_socket.room.course == 0x7F || (_socket.room.course & 0x80) != 0))
            _socket.room.course = 0x80 | (
                Array.from({length: 22}, (_, i) => i)
                .filter(el => el != 12 && el != 17)
                .sort(() => 0.5 - Math.random())
                .shift()
            );

        p.reset(0x52);

        p.Encode1(_socket.room.course);
        p.Encode1(_socket.room.tipo);
        p.Encode1(_socket.room.modo);
        p.Encode1(_socket.room.qntd_hole);
        p.Encode4(0);
        p.Encode4(0);
        p.Encode4(_socket.room.time_30s);

        switch (_socket.room.modo) {
            case 1:
                _socket.holes = Array().concat(_socket.holes.slice(9, 18), _socket.holes.slice(0, 9));
                break;
            case 2:
                let hole = randomInt(0, 18);
                _socket.holes = Array().concat(
                    _socket.holes.slice(hole, _socket.holes.length),
                    _socket.holes.slice(0, hole - _socket.holes.length)
                );
                break;
            case 3:
                _socket.holes.sort(() => 0.5 - Math.random());
                break;
        }
        
        const pin = randomInt(0, 3);

        for (let i = 0; i < 18; i++) {

            p.Encode4(randomInt(0, 0x7FFFFFFF));
            p.Encode1((_socket.room.fixed_hole ? pin : randomInt(0, 3)));
            p.Encode1(_socket.room.course);
            p.Encode1(_socket.holes[i]);
        }

        p.Encode4(randomInt(0, 0xFFFF));

        for (let i = 0; i < 18; i++)
            p.Encode1(0);

        _socket.write(p.makePacketComplete(_socket.parseKey));
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
                console.log('[S][L] login server error: ', err);

                // reply
                if (initialized == 0)
                    _callback(false, 'fail to listen login server');
            });

            this.login_server.on('close', () => {
                console.log('[S][L] login server closed');
                this.login_server = null;
            });

            this.login_server.listen(10201, () => {
                console.log('[S][L] login_server listen in port: 10201');
                initialized = 1;
            });

        }else
            initialized = 1;

        if (this.game_server === null) {

            this.game_server = net.createServer(this.onConnectedSocketGameServer.bind(this));

            this.game_server.on('error', (err) => {
                console.log('[S][G] game_server error: ', err);

                // reply
                if (initialized == 1)
                    _callback(false, 'fail to listen game server');
            });

            this.game_server.on('close', () => {
                console.log('[S][G] game_server closed');
                this.game_server = null;
            });

            this.game_server.listen(20201, () => {
                console.log('[S][G] game_server listen in port: 10201');
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

            _socket.data_bf = _socket.data_bf.slice(length + kPacketHeaderLength);

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

        console.log(`[S][L] Packet.type: ${_pckt.type}`);

        _pckt.printToConsole();

        const status_translate = this.login_packet_callbacks.execute(_pckt, _socket);

        if (status_translate.skip || status_translate.exit)
            return !status_translate.exit;

        // reset _pckt
        _pckt.reset();

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

        console.log(`[S][G] Packet.type: ${_pckt.type}`);

        _pckt.printToConsole();

        const status_translate = this.game_packet_callbacks.execute(_pckt, _socket);

        if (status_translate.skip || status_translate.exit)
            return !status_translate.exit;

        // reset _pckt
        _pckt.reset();

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

        console.log('[S][L] Socket connected');

        _socket.player_id = 'Unknown';
        _socket.parseKey = randomInt(0, 16);
        _socket.data_bf = Buffer.alloc(0);

        _socket.on('error', (_err) => {
            console.log('[S][L] socket error: ', _err);
        });

        _socket.on('end', () => {
            console.log('[S][L] socket end');
        });

        _socket.on('close', () => {
            console.log('[S][L] socket closed');
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

        console.log('[S][G] Socket connected');

        _socket.player_id = 'Unknown';
        _socket.parseKey = randomInt(0, 16);
        _socket.data_bf = Buffer.alloc(0);

        _socket.on('error', (_err) => {
            console.log('[S][G] socket error: ', _err);
        });

        _socket.on('end', () => {
            console.log('[S][G] socket end');
        });

        _socket.on('close', () => {
            console.log('[S][G] socket closed');
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
