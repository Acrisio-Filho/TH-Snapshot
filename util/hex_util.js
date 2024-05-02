// Arquivo util.js
// Criado em 11/12/2021 as 12:42 por Acrisio

const NEXT_LINE_CONSOLE = "\n\r";

function isprint(char) {
    return !( /[\x00-\x08\x0E-\x1F\x80-\xFF-\n]/.test(char));
}

function myhexdump(data, block_size) {
	var rest = block_size - (data.length % block_size), i = 0;
	var addr = 0;
	var str = NEXT_LINE_CONSOLE // next line
	
	for (addr = 0; addr < data.length; addr += block_size) {
		str += ('0000' + addr.toString(16)).slice(-4) + '\t';
		for (i = addr; i < ((addr + block_size) < data.length ?  addr + block_size : data.length); ++i) {
			str += ('00' + data[i].toString(16)).slice(-2) + ' ';
		}
		
		if (i % block_size) {
			for (i = 0; i < rest; ++i)
				str += '--' + ' ';
		}
		
		for (i = addr; i < ((addr + block_size) < data.length ? addr + block_size : data.length); ++i) {
			str += (isprint(String.fromCharCode(data[i])) ? String.fromCharCode(data[i]) + '' : '.');
		}
		str += NEXT_LINE_CONSOLE;
	}
	
	return str;
}

module.exports = myhexdump;