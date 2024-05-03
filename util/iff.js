// Arquivo iff.js
// Criado em 31/12/2021 as 03:13 por Acrisio
// Definição da classe Iff

const StreamZip = require('node-stream-zip');

class Iff {

    path = null;
    files = [];

    constructor(_path) {

        this.path = _path;

        this.init();
    }

    async init() {

        if (this.path == null)
            return;

        // reset
        this.files = [];

        const zip = new StreamZip.async({ file: this.path });

        const entries = await zip.entries();

        for (const entry of Object.values(entries)) {

            if (entry.isDirectory)
                continue;

            // Log in debug mode
            if (false/*Desativa*/)
                console.log(`Loading file Iff: ${entry.name}, size: ${entry.size}`);

            let iff_ctx = {
                name: entry.name,
                size: entry.size,
                elements: []
            };

            iff_ctx.data = await zip.entryData(entry.name);

            this.initElements(iff_ctx);

            this.files.push(iff_ctx);
        }

        await zip.close();
    }

    initElements(_ctx) {

        let len = _ctx.data.readUInt16LE(0);

        let size = Math.floor((_ctx.size - 8) / len);

        for (let i = 0; i < len; i++)
            _ctx.elements.push(Buffer.from(_ctx.data.buffer, _ctx.data.byteOffset + 8 + (i * size), size));

        // Log in debug mode
        if (false/*Desativa*/)
            console.log(`Iff: ${_ctx.name}, Element loaded: ${len}, Size Element: ${size}`);
    }

    findIff(_name) {
        return this.files.find(iff => iff.name == _name);
    }

    findCommonItem(_typeid) {

        for (let i = 0; i < this.files.length; i++) {

            if (this.files[i].name == 'Desc.iff' || this.files[i].name == 'ChildItem.iff')
                continue;

            var element = this.files[i].elements.find(el => el.readUInt32LE(4) == _typeid);

            if (element !== undefined)
                return element;
        }

        return null;
    }

    findItem(_iff_name, _typeid) {

        const iff = this.findIff(_iff_name);

        if (iff === undefined)
            return iff;

        return iff.elements.find(el => el.readUInt32LE(4) == _typeid);
    }
}

module.exports = Iff;
