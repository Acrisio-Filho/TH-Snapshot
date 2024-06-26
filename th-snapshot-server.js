// Arquivo th-snapshot-server.js
// Criado em 28/04/2024 as 17:05 por Acrisio
// Definição do server que vai enviar o snapshot para o cliente

const { randomInt } = require('node:crypto');
const net = require('net');
const Packet = require('./packet/packet');
const SequencePacket = require('./util/sequence_packet');
const PacketCallback = require('./util/packet_callback');
const PacketAnalyzer = require('./util/packet_analyzer');
const Iff = require('./util/iff.js');

const kServerType = {
    LOGIN_SERVER: 0,
    GAME_SEVER: 1
}

function getCurrentDateAsSYSTEMTIME(_dt = new Date()) {

    const st = Buffer.alloc(16);

    st.writeUInt16LE(_dt.getFullYear(), 0);
    st.writeUInt16LE(_dt.getMonth(), 2);
    st.writeUInt16LE(_dt.getDay(), 4);
    st.writeUInt16LE(_dt.getDate(), 6);
    st.writeUInt16LE(_dt.getHours(), 8);
    st.writeUInt16LE(_dt.getMinutes(), 10);
    st.writeUInt16LE(_dt.getSeconds(), 12);
    st.writeUInt16LE(_dt.getMilliseconds(), 14);

    return st;
}

function getNowDateAsSeconds() {
    return Math.round(Date.now() / 1000);
}

const sIff = new Iff('./data/pangya_th.iff');

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

                        const p = new Packet(1);

                        p.Encode1(2);

                        _socket.write(p.makePacketComplete(_socket.parseKey));

                        setTimeout(() => { _socket.destroy(); }, 100);

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

                        setTimeout(() => { _socket.destroy(); }, 100);

                        return true;
                    }

                    // init player info
                    _socket.player_characters = [];
                    _socket.player_caddies = [];
                    _socket.player_mascots = [];
                    _socket.player_warehouse_items = [];
                    _socket.player_cards = [];

                    _socket.player_lounge_effect = {
                        big_head: 1.0,
                        fast_walk: 1.0
                    };

                    // room
                    _socket.room = {
                        number: 0,
                        name: 'practice',
                        pass: '123456',
                        tipo: 4,
                        tipo_ex: -1,
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
                            
                            const iff_clubset = sIff.findItem('ClubSet.iff', this.player_ei_clubset.readUInt32LE(4));

                            this.player_ei_csi = Buffer.alloc(28);

                            this.player_ei_csi.writeInt32LE(this.player_ei_clubset.readInt32LE(0));
                            this.player_ei_csi.writeUInt32LE(this.player_ei_clubset.readUInt32LE(4), 4);
                            this.player_ei_clubset.copy(this.player_ei_csi, 8, 12, 22);

                            if (iff_clubset) {

                                for (let i = 0; i < 5; i++)
                                    this.player_ei_csi.writeUInt16LE(
                                        iff_clubset.readUInt16LE(194 + i * 2) + this.player_ei_clubset.readUInt16LE(170 + i * 2),
                                        18 + i * 2
                                    );

                            }else
                                this.player_ei_clubset.copy(this.player_ei_csi, 18, 170, 180);
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

                    _socket.findCard = function(_id) {
                        return this.player_cards.filter(el => el.readInt32LE(0) == _id).shift();
                    }

                    _socket.findCardByTypeid = function(_typeid) {
                        return this.player_cards.filter(el => el.readUInt32LE(4) == _typeid).shift();
                    }

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                3,
                true,
                function(_pckt, _socket) {

                    _pckt.Discart(4);

                    const p = new Packet(0x40);

                    p.Encode1(0);
                    p.EncodeStr(_pckt.DecodeStr());
                    p.EncodeStr(_pckt.DecodeStr());

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                8,
                false,
                function(_pckt, _socket, _ret) {

                    _pckt.Discart(9);

                    let max_player = _pckt.Decode1();
                    let tipo = _pckt.Decode1();
                    let qntd_hole = _pckt.Decode1();
                    let course = _pckt.Decode1();
                    let modo = _pckt.Decode1();

                    if (modo == 4)
                        _pckt.Discart(5);

                    _pckt.Discart(4);

                    let name = _pckt.DecodeStr();

                    if (tipo == 0x13)
                        return false;
                    else if (tipo != 2) {

                        const p = new Packet(0x49);

                        p.Encode2(2);

                        _socket.write(p.makePacketComplete(_socket.parseKey));

                        _ret.skip = true;

                        return false;
                    }

                    _socket.room.max_player = max_player;
                    _socket.room.tipo = tipo;
                    _socket.room.qntd_hole = qntd_hole;
                    _socket.room.course = course;
                    _socket.room.modo = modo;
                    _socket.room.name = name;

                    _socket.player_room_number = _socket.room.number;

                    const p = new Packet(0x46);

                    p.Encode1(3);
                    p.Encode1(1);
                    p.Encode4(_socket.player_uid);
                    p.Encode4(_socket.player_oid);
                    p.Encode2(_socket.player_room_number);
                    p.EncodeStrWithFixedSize(_socket.player_id, 22);
                    p.Encode1(_socket.player_level);
                    p.fillZeroByte(8);
                    p.Encode4(1000);
                    p.fillZeroByte(154);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    p.reset(0x4A);

                    p.Encode2(-1);
                    p.Encode1(_socket.room.tipo);
                    p.Encode1(_socket.room.course);
                    p.Encode1(_socket.room.qntd_hole);
                    p.Encode1(_socket.room.modo);
                    p.Encode4(0);
                    p.Encode1(_socket.room.max_player);
                    p.Encode1(30);
                    p.Encode1(0);
                    p.Encode4(0);
                    p.Encode4(0);
                    p.Encode4(0x2C000000);
                    p.Encode1(0);
                    p.EncodeStr(_socket.room.name);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    p.reset(0x49);

                    p.Encode2(0);
                    p.EncodeStrWithFixedSize(_socket.room.name, 64);
                    p.Encode1(1);
                    p.Encode1(1);
                    p.Encode1(0);
                    p.Encode1(_socket.room.max_player);
                    p.Encode1(1);
                    p.fillZeroByte(17);
                    p.Encode1(30);
                    p.Encode1(_socket.room.qntd_hole);
                    p.Encode1(_socket.room.tipo);
                    p.Encode2(_socket.room.number);
                    p.Encode1(_socket.room.modo);
                    p.Encode1(_socket.room.course);
                    p.fillZeroByte(8);
                    p.Encode4(0x2C000000);
                    p.fillZeroByte(88);
                    p.Encode1(_socket.room.tipo_ex);
                    p.fillZeroByte(24);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    p.reset(0x48);

                    p.Encode1(7);
                    p.Encode2(-1);
                    p.Encode1(1);

                    p.Encode4(_socket.player_oid);
                    p.EncodeStrWithFixedSize(_socket.player_nickname, 22);
                    p.fillZeroByte(21);
                    p.Encode1(1);
                    p.fillZeroByte(8);

                    if (_socket.player_ei_character)
                        p.Encode4(_socket.player_ei_character.readUInt32LE(0));
                    else
                        p.Encode4(0x4000000);

                    p.fillZeroByte(26);
                    p.Encode1(_socket.player_level);
                    p.fillZeroByte(19);
                    p.Encode4(_socket.player_uid);
                    p.fillZeroByte(236);

                    if (_socket.player_ei_character)
                        p.EncodeBuffer(_socket.player_ei_character);
                    else {

                        p.Encode4(0x4000000);
                        p.Encode4(10);
                        p.fillZeroByte(505);
                    }

                    p.Encode1(0);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    p.reset(0x47);

                    p.Encode1(1);
                    p.Encode1(1);
                    p.Encode2(-1);
                    p.EncodeStrWithFixedSize(_socket.room.name, 64);
                    p.Encode1(1);
                    p.Encode1(1);
                    p.Encode1(0);
                    p.Encode1(_socket.room.max_player);
                    p.Encode1(1);
                    p.fillZeroByte(17);
                    p.Encode1(30);
                    p.Encode1(_socket.room.qntd_hole);
                    p.Encode1(_socket.room.tipo);
                    p.Encode1(_socket.room.number);
                    p.Encode1(_socket.room.modo);
                    p.Encode1(_socket.room.course);
                    p.fillZeroByte(8);
                    p.Encode4(0x2C000000);
                    p.fillZeroByte(88);
                    p.Encode1(_socket.room.tipo_ex);
                    p.fillZeroByte(24);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    _ret.skip = true;

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
                    p.Encode4(0x2C000000);
                    p.Encode1(0);
                    p.EncodeStr(_socket.room.name);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0xB,
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
                    }

                    const p = new Packet(0x4B);

                    p.Encode4(0);

                    p.Encode1(opt);
                    p.Encode4(_socket.player_oid);

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
                0xC,
                true,
                function(_pckt, _socket) {

                    let opt = _pckt.Decode1();
                    let lounge_effect = {
                        item_id: 0,
                        effect: 0
                    };

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
                        case 6:
                            lounge_effect.item_id = _pckt.Decode4(true);
                            lounge_effect.effect = _pckt.Decode4();
                            switch (lounge_effect.effect) {
                                case 1: // big head
                                    _socket.player_lounge_effect.big_head = _socket.player_lounge_effect.big_head > 1.0 ? 2.0 : 1.0;
                                    break;
                                case 2: // fast walk
                                    _socket.player_lounge_effect.fast_walk = _socket.player_lounge_effect.fast_walk > 1.0 ? 2.0 : 1.0;
                                    break;
                            }
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
                    p.Encode4(_socket.player_oid);

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
                        case 6: // Lounge Effect
                            p.Encode4(lounge_effect.effect);
                            switch (lounge_effect.effect) {
                                case 1: // big head
                                    p.EncodeFloat(_socket.player_lounge_effect.big_head);
                                    break;
                                case 2:
                                    p.EncodeFloat(_socket.player_lounge_effect.fast_walk);
                                    break;
                                case 3:
                                    p.Encode4(1);
                                    break;
                            }
                            break;
                    }

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0xE,
                true,
                function(_pckt, _socket) {

                    const p = new Packet(0x230);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    p.reset(0x231);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    p.reset(0x77);

                    p.Encode4(100);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0xF,
                false,
                function(_pckt, _socket, _ret) {

                    if (_socket.room.tipo == 0x13 || _socket.player_room_number == -1)
                        return false;

                    _socket.player_room_number = -1;

                    const p = new Packet(0x48);

                    p.Encode1(2);
                    p.Encode2(-1);
                    p.Encode4(_socket.player_oid);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    p.reset(0x46);

                    p.Encode1(3);
                    p.Encode1(1);
                    p.Encode4(_socket.player_uid);
                    p.Encode4(_socket.player_oid);
                    p.Encode2(_socket.player_room_number);
                    p.EncodeStrWithFixedSize(_socket.player_id, 22);
                    p.Encode1(_socket.player_level);
                    p.fillZeroByte(8);
                    p.Encode4(1000);
                    p.fillZeroByte(154);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    p.reset(0x47);

                    p.Encode1(1);
                    p.Encode1(2);
                    p.Encode2(-1);
                    p.EncodeStrWithFixedSize(_socket.room.name, 64);
                    p.Encode1(1);
                    p.Encode1(1);
                    p.Encode1(0);
                    p.Encode1(_socket.room.max_player);
                    p.Encode1(1);
                    p.fillZeroByte(17);
                    p.Encode1(30);
                    p.Encode1(_socket.room.qntd_hole);
                    p.Encode1(_socket.room.tipo);
                    p.Encode1(_socket.room.number);
                    p.Encode1(_socket.room.modo);
                    p.Encode1(_socket.room.course);
                    p.fillZeroByte(8);
                    p.Encode4(0x2C000000);
                    p.fillZeroByte(88);
                    p.Encode1(_socket.room.tipo_ex);
                    p.fillZeroByte(24);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    p.reset(0x4C);

                    p.Encode2(-1);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    _ret.skip = true;

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

                    _socket.write(p.makePacketComplete(_socket.parseKey));

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
                    p.Encode4(randomInt(0, 0x7FFF));
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
                    _socket.total_gpang += _socket.player_gpang;
                    _socket.total_gbonus_pang += _socket.player_gbonus_pang;
                    _socket.shot = 0;
                    _socket.player_gpang = 0n;
                    _socket.player_gbonus_pang = 0n;

                    const p = new Packet(0x9E);

                    if (_socket.last_weather == 1)
                        _socket.last_weather = 2;
                    else
                        _socket.last_weather = randomInt(0, 3);

                    p.Encode1(_socket.last_weather);
                    p.Encode2(0);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    p.reset(0x5B);

                    if (_socket.room.modo != 4) {
                        _socket.player_wind = randomInt(0, 9);
                        _socket.player_degree = randomInt(0, 256);
                    }

                    p.Encode1(_socket.player_wind);
                    p.Encode1(0);
                    p.Encode1(_socket.player_degree);
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

                    _socket.player_gpang = BigInt(ssd.readUInt32LE(19)) - _socket.total_gpang;
                    _socket.player_gbonus_pang = BigInt(ssd.readUInt32LE(23)) - _socket.total_gbonus_pang;
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
                            _socket.player_clubset(_pckt.Decode4(true));
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
                    
                    const p = new Packet(0x132);

                    p.Encode4(0);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    if ((_socket.hole_seq + 1) < _socket.room.qntd_hole) {

                        p.reset(0x6D);

                        p.Encode4(_socket.player_oid);
                        p.Encode1(_socket.holes[_socket.hole_seq]);
                        p.Encode1(_socket.total_shot);
                        p.Encode4(_socket.player_shot - _socket.par_hole);
                        p.Encode8(_socket.player_gpang);
                        p.Encode8(_socket.player_gbonus_pang);
                        p.Encode1(1);

                        _socket.write(p.makePacketComplete(_socket.parseKey));

                    }else {

                        p.reset(0x199);

                        _socket.write(p.makePacketComplete(_socket.parseKey));

                        p.reset(0x6D);

                        p.Encode4(_socket.player_oid);
                        p.Encode1(_socket.holes[_socket.hole_seq]);
                        p.Encode1(_socket.total_shot);
                        p.Encode4(_socket.player_shot - _socket.par_hole);
                        p.Encode8(_socket.player_gpang);
                        p.Encode8(_socket.player_gbonus_pang);
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
                0x4A,
                true,
                function(_pckt, _socket) {

                    const typeid = _pckt.Decode4();

                    let qntd = 100;

                    const item = _socket.findWarehouseItemByTypeid(typeid);

                    if (item)
                        qntd = item.readUInt16LE(12);

                    const p = new Packet(0xA4);

                    p.Encode2(qntd);
                    p.Encode4(typeid);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x4B,
                true,
                function(_pckt, _socket) {

                    let opt = _pckt.Decode1();
                    _pckt.Discart(1);
                    let stat = _pckt.Decode1();
                    let item_id = _pckt.Decode4(true);

                    if (opt == 1 || opt == 3) {

                        const clubset = _socket.findWarehouseItem(item_id);

                        if (clubset) {

                            const pcl = clubset.slice(12, 22);

                            if (opt == 1)
                                pcl.writeUInt16LE(pcl.readUInt16LE(stat * 2) + 1, stat * 2);
                            else if (opt == 3)
                                pcl.writeUInt16LE(pcl.readUInt16LE(stat * 2) - 1, stat * 2);

                            // update
                            if (_socket.player_clubset() == clubset.readInt32LE(0))
                                _socket.player_clubset(clubset.readInt32LE(0));
                        }

                        const p = new Packet(0xC8);

                        p.Encode8(_socket.player_pang);
                        p.Encode8(0);

                        _socket.write(p.makePacketComplete(_socket.parseKey));

                        p.reset(0xA5);

                        p.Encode1(Math.floor(opt / 2) + 1);
                        p.Encode1(opt % 2);
                        p.Encode1(stat);
                        p.Encode4(item_id);
                        p.Encode8(0n);

                        _socket.write(p.makePacketComplete(_socket.parseKey));
                    }

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x63,
                true,
                function(_pckt, _socket) {

                    let opt = _pckt.Decode1();

                    const p = new Packet(0xC4);

                    p.Encode4(_socket.player_oid);
                    p.Encode1(opt);

                    switch (opt) {
                        case 0: // face
                            p.EncodeFloat(_pckt.DecodeFloat());
                            break;
                        case 1: // motion in room
                            p.EncodeStr(_pckt.DecodeStr());
                            break;
                        case 4: // set location
                            p.EncodeBuffer(_pckt.DecodeBuffer(12));
                            break;
                        case 5: // player state lounge
                            p.Encode4(_pckt.Decode4());
                            break;
                        case 6: // update location
                            p.EncodeBuffer(_pckt.DecodeBuffer(12));
                            break;
                        case 7: // motion lounge
                            p.EncodeStr(p.DecodeStr());
                            break;
                        case 8: // player state icon lounge
                            p.Encode4(_pckt.Decode4());
                            break;
                        case 10: // motion item special lounge
                            p.EncodeStr(_pckt.DecodeStr());
                            break;
                    }

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x65,
                true,
                function(_pckt, _socket) {

                    const p = new Packet(0xC7);

                    p.EncodeFloat(_pckt.DecodeFloat());
                    p.Encode4(_socket.player_oid);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x81,
                true,
                function(_pckt, _socket) {

                    const p = new Packet(0x46);

                    p.Encode1(1);
                    p.Encode1(1);
                    p.Encode4(_socket.player_uid);
                    p.Encode4(_socket.player_oid);
                    p.Encode2(_socket.player_room_number);
                    p.EncodeStrWithFixedSize(_socket.player_id, 22);
                    p.Encode1(_socket.player_level);
                    p.fillZeroByte(8);
                    p.Encode4(1000);
                    p.fillZeroByte(154);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    p.reset(0x47);

                    p.Encode1(0);
                    p.Encode1(0);
                    p.Encode2(-1);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    p.reset(0xF5);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x82,
                true,
                function(_pckt, _socket) {

                    const p = new Packet(0x46);

                    p.Encode1(2);
                    p.Encode1(1);
                    p.Encode4(_socket.player_uid);
                    p.Encode4(_socket.player_oid);
                    p.Encode2(_socket.player_room_number);
                    p.EncodeStrWithFixedSize(_socket.player_id, 22);
                    p.Encode1(_socket.player_level);
                    p.fillZeroByte(8);
                    p.Encode4(1000);
                    p.fillZeroByte(154);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    p.reset(0xF6);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0xBD,
                true,
                function(_pckt, _socket) {

                    let typeid = _pckt.Decode4();

                    const card = _socket.findCardByTypeid(typeid);
                    const iff_card = sIff.findItem('Card.iff', typeid);

                    if (!card || !iff_card) {

                        const p = new Packet(0x160);

                        p.Encode4(1);

                        return false;
                    }

                    const p = new Packet(0x160);

                    p.Encode4(0);

                    p.Encode4(card.readInt32LE(0));
                    p.Encode4(typeid);
                    p.fillZeroByte(12);
                    p.Encode4(1);
                    p.EncodeBuffer(getCurrentDateAsSYSTEMTIME());
                    p.EncodeBuffer(getCurrentDateAsSYSTEMTIME(new Date(Date.now() + 36000000 + 60000 * iff_card.readUInt16LE(344))));
                    p.Encode2(0);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0xE5,
                true,
                function(_pckt, _socket) {

                    const p = new Packet(0x18D);

                    p.Encode1(0);
                    p.Encode2(-1);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0xEB,
                true,
                function(_pckt, _socket) {

                    const p = new Packet(0x196);

                    p.Encode4(_socket.player_oid);
                    p.EncodeFloat(1.0);
                    p.EncodeFloat(1.0);
                    p.EncodeFloat(1.0);
                    p.EncodeFloat(1.0);

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
                0x130,
                true,
                function(_pckt, _socket) {

                    const p = new Packet(0x8C);

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

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x138,
                true,
                function(_pckt, _socket) {

                    const p = new Packet(0x203);

                    p.Encode4(_socket.player_uid);
                    p.Encode4(_pckt.Decode4());

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x141,
                true,
                function(_pckt, _socket) {

                    _socket.player_wind = randomInt(0, 9);
                    _socket.player_degree = randomInt(0, 256);

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x15C,
                true,
                function(_pckt, _socket) {

                    const p = new Packet(0x236);

                    p.Encode4(_socket.player_uid);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x15D,
                true,
                function(_pckt, _socket) {

                    const p = new Packet(0x237);

                    p.Encode4(0);
                    p.Encode4(_socket.player_uid);
                    p.Encode4(_pckt.Decode4());
                    _pckt.Discart(4);
                    p.Encode1(_pckt.Decode1());

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x171,
                true,
                function(_pckt, _socket) {

                    const p = new Packet(0x24C);

                    p.Encode4(0);
                    p.Encode4(_pckt.Decode4());
                    p.Encode4(_socket.player_uid);
                    p.EncodeBuffer(_pckt.DecodeBuffer(5));

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x180,
                true,
                function(_pckt, _socket) {

                    const p = new Packet(0x265);

                    p.Encode4(0);
                    p.Encode4(_pckt.Decode4());
                    p.Encode4(_socket.player_uid);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x181,
                true,
                function(_pckt, _socket) {

                    const p = new Packet(0x266);

                    p.Encode4(0);
                    p.EncodeBuffer(_pckt.DecodeBuffer(16));
                    p.Encode4(_socket.player_uid);

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

                    p.Encode4(getNowDateAsSeconds());
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
            ),
            new PacketCallback(
                0x188,
                true,
                function(_pckt, _socket) {

                    let stat = _pckt.Decode4();

                    let cibf = _pckt.DecodeBuffer(513);

                    const character = _socket.findCharacter(cibf.readInt32LE(4));

                    if (character) {

                        character.writeUInt8(character.readUInt8(456 + stat) + 1, 456 + stat);

                        const p = new Packet(0xC8);

                        p.Encode8(_socket.player_pang);
                        p.Encode8(0n);

                        _socket.write(p.makePacketComplete(_socket.parseKey));

                        p.reset(0x216);

                        p.Encode4(getNowDateAsSeconds());
                        p.Encode4(1);
                        p.Encode1(0xC9);
                        p.Encode4(character.readUInt32LE(0));
                        p.Encode4(character.readInt32LE(4));
                        p.fillZeroByte(16);
                        p.Encode2(character.readUInt8(456));
                        p.Encode2(character.readUInt8(457));
                        p.Encode2(character.readUInt8(458));
                        p.Encode2(character.readUInt8(459));
                        p.Encode2(character.readUInt8(460));
                        p.fillZeroByte(15);

                        _socket.write(p.makePacketComplete(_socket.parseKey));

                        p.reset(0x26F);

                        p.Encode4(0);
                        p.Encode4(stat);

                        _socket.write(p.makePacketComplete(_socket.parseKey));

                    }else {
                        
                        const p = new Packet(0x26F);

                        p.Encode4(1);

                        _socket.write(p.makePacketComplete(_socket.parseKey));
                    }

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x189,
                true,
                function(_pckt, _socket) {

                    let stat = _pckt.Decode4();

                    let cibf = _pckt.DecodeBuffer(513);

                    const character = _socket.findCharacter(cibf.readInt32LE(4));

                    if (character) {

                        character.writeUInt8(character.readUInt8(456 + stat) - 1, 456 + stat);

                        const p = new Packet(0x216);

                        p.Encode4(getNowDateAsSeconds());
                        p.Encode4(1);
                        p.Encode1(0xC9);
                        p.Encode4(character.readUInt32LE(0));
                        p.Encode4(character.readInt32LE(4));
                        p.fillZeroByte(16);
                        p.Encode2(character.readUInt8(456));
                        p.Encode2(character.readUInt8(457));
                        p.Encode2(character.readUInt8(458));
                        p.Encode2(character.readUInt8(459));
                        p.Encode2(character.readUInt8(460));
                        p.fillZeroByte(15);

                        _socket.write(p.makePacketComplete(_socket.parseKey));

                        p.reset(0x270);

                        p.Encode4(0);
                        p.Encode4(stat);

                        _socket.write(p.makePacketComplete(_socket.parseKey));

                    }else {
                        
                        const p = new Packet(0x270);

                        p.Encode4(1);

                        _socket.write(p.makePacketComplete(_socket.parseKey));
                    }

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x18A,
                true,
                function(_pckt, _socket) {

                    let char_typeid = _pckt.Decode4();
                    let char_id = _pckt.Decode4(true);
                    let card_typeid = _pckt.Decode4();
                    let card_id = _pckt.Decode4(true);
                    let char_card_slot = _pckt.Decode4();

                    const character = _socket.findCharacter(char_id);

                    if (!character) {

                        const p = new Packet(0x271);

                        p.Encode4(1);

                        return false;
                    }

                    character.writeUInt32LE(card_typeid, 465 + (char_card_slot - 1) * 4);

                    const p = new Packet(0x216);

                    p.Encode4(getNowDateAsSeconds());
                    p.Encode4(1);
                    p.Encode1(0xCB);
                    p.Encode4(char_typeid);
                    p.Encode4(char_id);
                    p.fillZeroByte(36);
                    p.Encode4(card_typeid);
                    p.Encode4(char_card_slot);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    p.reset(0x271);

                    p.Encode4(0);

                    p.Encode4(card_typeid);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x18B,
                true,
                function(_pckt, _socket) {

                    let char_typeid = _pckt.Decode4();
                    let char_id = _pckt.Decode4(true);
                    let card_typeid = _pckt.Decode4();
                    let card_id = _pckt.Decode4(true);
                    let char_card_slot = _pckt.Decode4();

                    const character = _socket.findCharacter(char_id);

                    if (!character) {

                        const p = new Packet(0x272);

                        p.Encode4(1);

                        return false;
                    }

                    character.writeUInt32LE(card_typeid, 465 + (char_card_slot - 1) * 4);

                    const p = new Packet(0x216);

                    p.Encode4(getNowDateAsSeconds());
                    p.Encode4(1);
                    p.Encode1(0xCB);
                    p.Encode4(char_typeid);
                    p.Encode4(char_id);
                    p.fillZeroByte(36);
                    p.Encode4(card_typeid);
                    p.Encode4(char_card_slot);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    p.reset(0x272);

                    p.Encode4(0);

                    p.Encode4(card_typeid);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x18C,
                true,
                function(_pckt, _socket) {

                    let char_typeid = _pckt.Decode4();
                    let char_id = _pckt.Decode4(true);
                    let removedor_typeid = _pckt.Decode4();
                    let removedor_id = _pckt.Decode4(true);
                    let char_card_slot = _pckt.Decode4();

                    const character = _socket.findCharacter(char_id);

                    if (!character) {

                        const p = new Packet(0x273);

                        p.Encode4(1);

                        return false;
                    }

                    let card_typeid = character.readUInt32LE(465 + (char_card_slot - 1) * 4);
                    character.writeUInt32LE(0, 465 + (char_card_slot - 1) * 4);

                    const p = new Packet(0x216);

                    p.Encode4(getNowDateAsSeconds());
                    p.Encode4(1);
                    p.Encode1(0xCB);
                    p.Encode4(char_typeid);
                    p.Encode4(char_id);
                    p.fillZeroByte(36);
                    p.Encode4(0);
                    p.Encode4(char_card_slot);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    p.reset(0x273);

                    p.Encode4(0);

                    p.Encode4(card_typeid);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x196,
                true,
                function(_pckt, _socket) {

                    const p = new Packet(0x27E);

                    p.Encode4(_socket.player_uid);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x197,
                true,
                function(_pckt, _socket) {

                    const p = new Packet(0x27F);

                    p.Encode4(_socket.player_uid);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x198,
                true,
                function(_pckt, _socket) {

                    const p = new Packet(0x280);

                    p.Encode4(0);
                    p.Encode4(_pckt.Decode4());
                    p.Encode4(_socket.player_uid);

                    _socket.write(p.makePacketComplete(_socket.parseKey));

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x199,
                true,
                function(_pckt, _socket) {

                    const p = new Packet(0x281);

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
                        _socket.player_room_number = _pckt.Decode2(true);

                        _pckt.Discart(22);

                        _socket.player_nickname = _pckt.DecodeFixedStr(22, 'utf8');

                        _pckt.Discart(45);

                        _socket.player_oid = _pckt.Decode4();

                        _pckt.Discart(172);

                        _socket.player_uid = _pckt.Decode4();

                        _pckt.Discart(74);

                        _socket.player_exp = _pckt.Decode4();
                        _socket.player_level = _pckt.Decode1();
                        _socket.player_pang = _pckt.Decode8();

                        console.log(`[S][G] Login Game Server Ok, Client Version: ${
                            client_version
                        }, Room Number: ${
                            _socket.player_room_number
                        }, OID: ${_socket.player_oid}, UID: ${_socket.player_uid}, Level: ${
                            _socket.player_level
                        }, Exp: ${_socket.player_exp}, Pang: ${_socket.player_pang}`);
                        
                        _pckt.Discart(11839);

                        // block flag
                        _pckt.Encode8(0xFFFFFFFFBFEFDFFDn);
                    }

                    return false;
                }
                .bind(this)
            ),
            new PacketCallback(
                0x49,
                false,
                function(_pckt, _socket) {

                    let opt = _pckt.Decode1();
                    
                    if (opt != 0)
                        return false;

                    if (_pckt.Decode1() != 0)
                        _pckt.Discart(4);

                    _socket.room.name = _pckt.DecodeFixedStr(64, 'utf8');
                    _pckt.Discart(3);
                    _socket.room.max_player = _pckt.Decode1();
                    _pckt.Discart(1);
                    _socket.room.key = _pckt.DecodeBuffer(16);
                    _pckt.Discart(2);
                    _socket.room.qntd_hole = _pckt.Decode1();
                    _socket.room.tipo = _pckt.Decode1();
                    _socket.room.number = _pckt.Decode2(true);
                    _socket.room.modo = _pckt.Decode1();
                    _socket.room.course = _pckt.Decode1();
                    _pckt.Discart(4);
                    _socket.room.time_30s = _pckt.Decode4();
                    _pckt.Discart(92);
                    _socket.room.tipo_ex = _pckt.Decode1(true);
                    _socket.room.artefact = _pckt.Decode4();
                    _socket.room.natural = _pckt.Decode4();

                    _socket.player_lounge_effect.big_head = 1.0;
                    _socket.player_lounge_effect.fast_walk = 1.0;

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
            ),
            new PacketCallback(
                0x138,
                false,
                function(_pckt, _socket) {

                    let opt = _pckt.Decode4();

                    if (opt != 0)
                        return false;

                    let count = _pckt.Decode2();

                    for (let i = 0; i < count; i++)
                        _socket.player_cards.push(_pckt.DecodeBuffer(58));

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
        _socket.player_wind = 0;
        _socket.player_degree = 0;
        _socket.last_weather = 0;
        _socket.hole_seq = 0;
        _socket.holes = Array.from({length: 18}, (_, i) => i + 1);
        _socket.player_gpang = 0n;
        _socket.player_gbonus_pang = 0n;
        _socket.par_hole = 4;
        _socket.player_shot = 0;
        _socket.total_shot = 0;
        _socket.total_gpang = 0n;
        _socket.total_gbonus_pang = 0n;

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
        p.Encode4(0x2C000000);
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
