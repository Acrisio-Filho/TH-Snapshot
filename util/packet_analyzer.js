// Arquivo packet_analyzer.js
// Criado em 01/05/2024 as 05:09 por Acrisio
// Definição da classe PacketAnalyzer

class PacketAnalyzer {

    map = new Map();

    push(_pckt_callback) {

        if (!(_pckt_callback instanceof Array))
            _pckt_callback = [_pckt_callback];

        for (const pc of _pckt_callback)
            this.map.set(pc.type, pc);
    }

    has(_type) {
        return this.map.has(_type);
    }

    execute(_pckt, _arg) {

        const ret = {
            skip: false,
            exit: false
        }

        if (!this.map.has(_pckt.type))
            return ret;

        const pckt_callback = this.map.get(_pckt.type);

        ret.skip = pckt_callback.skip;

        if (!pckt_callback.callback || !(pckt_callback.callback instanceof Function))
            return ret;

        ret.exit = pckt_callback.callback(_pckt, _arg, ret);

        return ret;
    }
}

module.exports = PacketAnalyzer;
