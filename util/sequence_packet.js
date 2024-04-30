// Arquivo sequence_packet.js
// Criado em 29/04/2024 as 5:00 por Acrisio
// Definição da classe SequencePacket

const fs = require('fs');

class SequencePacket {

    curr_key = 'None';
    sequence = new Map();

    set_key(key) {
        this.curr_key = key;
    }

    add_sequence(obj) {

        if (this.sequence.has(this.curr_key))
            this.sequence.get(this.curr_key).push(obj);
        else
            this.sequence.set(this.curr_key, [obj]);
    }

    get_sequence(key) {

        var keys = this._all_keys_match(key);

        if (keys.length <= 0)
            return [];

        return Array.from(this.sequence.entries()).filter(el => keys.includes(el[0])).map(el => el[1]);
    }

    has_sequence(key) {
        return this._all_keys_match(key).length > 0;
    }

    _all_keys_match(_search) {
        return Array.from(this.sequence.keys()).filter(el => el.search(`^${_search}(-|$)`) > -1);
    }

    load(_name) {

        this.curr_key = 'None';

        if (this.sequence.size > 0)
            this.sequence.clear();

        try {

            this.sequence = new Map(JSON.parse(fs.readFileSync(`${_name}.json`)));

        }catch (ex) {

            console.log(`Failed in load file: ${_name}.json, exception: ${ex}`);

            return false;
        }

        return true;
    }

    save(_name) {

        try {

            fs.writeFileSync(`${_name}.json`, JSON.stringify(Array.from(this.sequence)));

        }catch (ex) {

            console.log(`Failed in save file: ${_name}.json, exception: ${ex}`);

            return false;
        }

        return true;
    }
}

module.exports = SequencePacket;
