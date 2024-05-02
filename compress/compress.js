// Arquivo compress.js
// Criado em 03/04/2022 as 23:59 por Acrisio
// Definição da classe Compress

class Compress {

    /**
     * _Buffer : Buffer
     */
    static Compress_Data(_Buffer) {

        const size = _Buffer.length;

        const Janela = Array(0x4000).fill(-1);
        const inicioFixoPadrao = Buffer.concat([_Buffer]);
        const CompressFixo = Buffer.alloc(size+ 15);

        let Falta = 0, c_index = 0, s_index = 0, s_index2 = 0, truta = 0, porra = 0, lMul = 0, teste = 0;
        let Casado = 0, result = 0, difference = 0, tnc = 0, diffTamanho = 0, diffTamanho12 = 0, padrao = 0;

        if (size > 13) {

            s_index += 4;

            do {

                teste = inicioFixoPadrao[s_index] << 6;
                teste ^= inicioFixoPadrao[s_index + 1];
                teste <<= 5;
                teste ^= inicioFixoPadrao[s_index + 2];
                teste <<= 5;
                teste ^= inicioFixoPadrao[s_index + 3];
                teste *= 0x21;
                teste &= 0xFFFFFFFF;
                teste >>= 5;
                teste &= 0x3FFF;

                Casado = Janela[teste];

                if (Casado >= 0) {

                    difference = porra = s_index - Casado;

                    if (porra != 0) {

                        if (porra < 0xBFFF && porra > 0) {

                            if (porra > 2048 && inicioFixoPadrao[Casado + 3] != inicioFixoPadrao[s_index + 3]) {

                                teste = (teste & 0x7FF) ^ 0x201F;

                                Casado = Janela[teste];

                                if (Casado >= 0) {

                                    difference = porra = s_index - Casado;

                                    if (porra != 0) {

                                        if (porra < 0xBFFF && porra > 0) {

                                            if (porra > 2048 && inicioFixoPadrao[Casado + 3] != inicioFixoPadrao[s_index + 3])
                                                result = 1;
                                            else {
                                                porra = difference;

                                                result = 2;
                                            }

                                        }else
                                            result = 1;

                                    }else
                                        result = 1;

                                }else
                                    result = 1;

                            }else
                                result = 2;
                        }else
                            result = 1;

                    }else
                        result = 1;

                }else
                    result = 1;

                if (result == 2) {

                    if (inicioFixoPadrao[Casado] == inicioFixoPadrao[s_index]
                        && inicioFixoPadrao[Casado + 1] == inicioFixoPadrao[s_index + 1]
                        && inicioFixoPadrao[Casado + 2] == inicioFixoPadrao[s_index + 2]) {

                        tnc = s_index - s_index2;
                        Janela[teste] = s_index;

                        if (tnc != 0) {

                            diffTamanho = tnc;

                            if (tnc > 3) {

                                if (tnc > 0x12) {

                                    truta = tnc - 0x12;
                                    CompressFixo[c_index++] = 0;
                                    diffTamanho12 = truta;

                                    if (truta > 0xFF) {

                                        lMul = Math.floor(truta / 0xFF);
                                        padrao = lMul;

                                        do {
                                            CompressFixo[c_index++] = 0;
                                        } while (--lMul > 0);

                                        diffTamanho12 = truta % 0xFF;

                                        tnc = diffTamanho;

                                    }

                                    truta = diffTamanho12;

                                }else
                                    truta = tnc - 3;

                                CompressFixo[c_index++] = truta & 0xFF;

                            }else
                                CompressFixo[c_index - 2] |= tnc;

                            do {
                                CompressFixo[c_index++] = inicioFixoPadrao[s_index2++];
                            } while (--tnc > 0);
                        }

                        porra = inicioFixoPadrao[s_index + 3];
                        s_index += 4;

                        if (porra == inicioFixoPadrao[Casado + 3]) {

                            porra = inicioFixoPadrao[s_index++];

                            if (porra == inicioFixoPadrao[Casado + 4]) {
                                
                                porra = inicioFixoPadrao[s_index++];

                                if (porra == inicioFixoPadrao[Casado + 5]) {

                                    porra = inicioFixoPadrao[s_index++];

                                    if (porra == inicioFixoPadrao[Casado + 6]) {

                                        porra = inicioFixoPadrao[s_index++];

                                        if (porra == inicioFixoPadrao[Casado + 7]) {

                                            porra = inicioFixoPadrao[s_index++];

                                            if (porra == inicioFixoPadrao[Casado + 8]) {

                                                Casado += 9;

                                                if (s_index < size) {

                                                    do {

                                                        if (inicioFixoPadrao[Casado] != inicioFixoPadrao[s_index])
                                                            break;

                                                        Casado++;
                                                        s_index++;
                                                    } while (s_index < size);
                                                }

                                                porra = s_index - s_index2;
                                                tnc = difference;

                                                if (tnc > 0x4000) {

                                                    tnc -= 0x4000;
                                                    difference = tnc;
                                                    tnc >>= 0x0B;
                                                    tnc &= 8;

                                                    if (porra > 9) {

                                                        porra -= 9;
                                                        tnc |= 0x10;
                                                        CompressFixo[c_index] = tnc & 0xFF;

                                                        result = 3;

                                                    }else {

                                                        porra -= 2;
                                                        tnc |= porra;
                                                        tnc |= 0x10;
                                                        CompressFixo[c_index] = tnc & 0xFF;

                                                        truta = difference;

                                                        result = 4;
                                                    }

                                                }else {

                                                    difference = --tnc;

                                                    if (porra > 0x21) {

                                                        porra -= 0x21;
                                                        CompressFixo[c_index] = 0x20;

                                                        result = 3;

                                                    }else {

                                                        porra -= 2;
                                                        porra |= 0x20;
                                                        CompressFixo[c_index] = porra & 0xFF;

                                                        truta = tnc;

                                                        result = 4;
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }

                        if (result != 3 && result != 4) {

                            s_index--;
                            porra = s_index - s_index2;
                            truta = difference;

                            if (truta <= 0x800) {

                                truta--;
                                porra--;
                                porra <<= 3;
                                tnc = truta & 7;
                                porra |= tnc;
                                porra <<= 2;
                                truta >>= 3;
                                CompressFixo[c_index++] = porra & 0xFF;
                                CompressFixo[c_index++] = truta & 0xFF;

                                s_index2 = s_index;

                            }else {

                                porra -= 2;

                                if (truta > 0x4000) {

                                    truta -= 0x4000;
                                    tnc = truta >> 0x0B;
                                    tnc &= 8;
                                    tnc |= porra;
                                    tnc |= 0x10;
                                    CompressFixo[c_index] = tnc & 0xFF;

                                    result = 4;

                                }else {

                                    truta--;
                                    porra |= 0x20;
                                    CompressFixo[c_index] = porra & 0xFF;

                                    result = 4;
                                }
                            }
                        }

                    }else
                        result = 1;
                }

                if (result == 3) {

                    c_index++;

                    if (porra > 0xFF) {

                        lMul = Math.floor(porra / 0xFF);
                        diffTamanho = lMul;

                        do {
                            CompressFixo[c_index++] = 0;
                        } while (--lMul > 0);

                        porra %= 0xFF;
                    }

                    truta = difference;
                    CompressFixo[c_index] = porra & 0xFF;

                    result = 4;
                }

                if (result == 4) {

                    c_index++;
                    tnc = truta << 2;
                    truta >>= 6;
                    CompressFixo[c_index++] = tnc & 0xFF;
                    CompressFixo[c_index++] = truta & 0xFF;

                    s_index2 = s_index;
                }

                if (result == 1)
                    Janela[teste] = s_index++;

            } while (s_index < (size - 13));

            Falta = size - s_index2;

        }else
            Falta = size;

        if (Falta > 0) {

            s_index = size - Falta;

            if (c_index == 0 && Falta <= 0xEE)
                CompressFixo[c_index++] = Falta + 0x11;
            else {

                if (Falta <= 3)
                    CompressFixo[c_index - 2] |= Falta;
                else {

                    if (Falta > 0x12) {

                        porra = Falta - 0x12;
                        CompressFixo[c_index++] = 0;
                        truta = porra;

                        if (porra > 0xFF) {

                            lMul = Math.floor(porra / 0xFF);

                            do {                            
                                CompressFixo[c_index++] = 0;
                            } while (--lMul > 0);

                            truta = porra % 0xFF;
                        }

                    }else
                        truta = Falta - 3;

                    CompressFixo[c_index++] = truta & 0xFF;
                }
            }

            do {
                CompressFixo[c_index++] = inicioFixoPadrao[s_index++];
            } while (--Falta > 0);
        }

        CompressFixo[c_index++] = 0x11;
        CompressFixo[c_index++] = 0;
        CompressFixo[c_index++] = 0;

        return Buffer.concat([CompressFixo.slice(0, c_index)]);
    }

    static Decompress_Data(_Buffer, _size_dec) {

        const size = _Buffer.length;

        const compress = Buffer.concat([_Buffer]);
        const entrada_padrao = Buffer.alloc(_size_dec);

        let erro = 0, teste = 0, c_index = 0, d_index = 0, d_index2 = 0, tnc = 0;
        let truta = 0, porra = 0, tamanho = 0;

        teste = compress[c_index];

        if (teste > 0x11) {

            tnc = teste - 0x11;
            c_index++;

            if (tnc >= 4) {

                do {
                    entrada_padrao[d_index++] = compress[c_index++];
                } while (--tnc > 0);

                erro = -1;

            }else
                erro = -2;

        }else
            erro = -10;

        do {

            if (erro == -10) {

                teste = compress[c_index++];

                if (!(teste < 0x10))
                    erro = -3;
                else {

                    if (teste == 0) {

                        if (compress[c_index] == 0) {

                            do {
                                porra = compress[++c_index];
                                teste += 0xFF;
                            } while (porra == 0);
                        }

                        porra = compress[c_index++];
                        teste = teste + porra + 0xF;
                    }

                    entrada_padrao[d_index++] = compress[c_index++];
                    entrada_padrao[d_index++] = compress[c_index++];
                    entrada_padrao[d_index++] = compress[c_index++];
                    entrada_padrao[d_index++] = compress[c_index++];
                    teste--;

                    if (teste != 0) {

                        if (teste < 4) {

                            do {
                                entrada_padrao[d_index++] = compress[c_index++];
                            } while (--teste > 0);
                        }else {

                            do {
                                entrada_padrao[d_index++] = compress[c_index++];
                                entrada_padrao[d_index++] = compress[c_index++];
                                entrada_padrao[d_index++] = compress[c_index++];
                                entrada_padrao[d_index++] = compress[c_index++];
                                
                                teste -= 4;
                            } while (!(teste < 4));

                            if (teste > 0) {

                                do {
                                    entrada_padrao[d_index++] = compress[c_index++];
                                } while (--teste > 0);
                            }
                        }
                    }

                    erro = -1;
                }
            }

            if (erro == -1) {

                teste = compress[c_index++];

                if (teste < 0x10) {

                    porra = compress[c_index++];
                    teste >>= 2;
                    porra <<= 2;
                    d_index2 = d_index - teste;
                    d_index2 -= porra;
                    d_index2 -= 0x801;
                    porra = entrada_padrao[d_index2++];
                    entrada_padrao[d_index++] = porra & 0xFF;

                    erro = -4;

                }else
                    erro = -3;
            }

            if (erro == -2) {

                entrada_padrao[d_index++] = compress[c_index++];

                if (tnc > 1) {

                    entrada_padrao[d_index++] = compress[c_index++];

                    if (tnc > 2)
                        entrada_padrao[d_index++] = compress[c_index++];
                }

                teste = compress[c_index++];

                erro = -3;
            }

            if (erro == -3) {

                if (teste < 0x40) {

                    if (teste < 0x20) {

                        d_index2 = d_index;

                        if (teste < 0x10) {

                            porra = compress[c_index++];
                            teste >>= 2;
                            d_index2 -= teste;
                            porra <<= 2;
                            d_index2 -= porra;
                            d_index2--;

                            erro = -4;

                        }else {

                            porra = teste & 8;
                            porra <<= 0x0B;
                            d_index2 -= porra;
                            teste &= 7;

                            if (teste == 0) {

                                if (compress[c_index] == 0) {

                                    do {
                                        porra = compress[++c_index];
                                        teste += 0xFF;
                                    } while (porra == 0);
                                }

                                porra = compress[c_index++];
                                teste += porra + 7;
                            }

                            porra = compress[c_index + 1];
                            porra = (porra << 8) + compress[c_index];
                            porra >>= 2;
                            d_index2 -= porra;
                            c_index += 2;

                            if (d_index2 == d_index) {

                                tamanho = d_index;

                                if (c_index == size)
                                    tamanho = d_index;
                                
                                break;
                            }else {

                                d_index2 -= 0x4000;

                                erro = -12;
                            }
                        }

                    }else {

                        teste &= 0x1F;

                        if (teste == 0) {

                            if (compress[c_index] == 0) {

                                do {
                                    porra = compress[++c_index];
                                    teste += 0xFF;
                                } while (porra == 0);
                            }

                            porra = compress[c_index++];
                            teste += porra + 0x1F;
                        }

                        porra = compress[c_index + 1];
                        porra = (porra << 8) + compress[c_index];
                        porra >>= 2;
                        d_index2 = d_index - porra;
                        d_index2--;
                        c_index += 2;

                        erro = -12;
                    }

                }else {

                    porra = teste >> 2;
                    porra &= 7;
                    d_index2 = d_index - porra;
                    porra = compress[c_index++];
                    porra <<= 3;
                    d_index2 -= porra;
                    d_index2--;
                    teste >>= 5;
                    teste--;

                    erro = -13;
                }
            }

            if (erro == -12) {

                if (teste < 6)
                    erro = -13;
                else {

                    porra = d_index - d_index2;

                    if (porra < 4)
                        erro = -13;
                    else {

                        entrada_padrao[d_index++] = entrada_padrao[d_index2++];
                        entrada_padrao[d_index++] = entrada_padrao[d_index2++];
                        entrada_padrao[d_index++] = entrada_padrao[d_index2++];
                        entrada_padrao[d_index++] = entrada_padrao[d_index2++];
                        teste -= 2;

                        do {

                            entrada_padrao[d_index++] = entrada_padrao[d_index2++];
                            entrada_padrao[d_index++] = entrada_padrao[d_index2++];
                            entrada_padrao[d_index++] = entrada_padrao[d_index2++];
                            entrada_padrao[d_index++] = entrada_padrao[d_index2++];

                            teste -= 4;
                        } while (!(teste < 4));

                        if (teste > 0) {

                            do {
                                entrada_padrao[d_index++] = entrada_padrao[d_index2++];
                            } while (--teste > 0);
                        }

                        erro = -5;
                    }
                }
            }

            if (erro == -13) {

                entrada_padrao[d_index++] = entrada_padrao[d_index2++];
                entrada_padrao[d_index++] = entrada_padrao[d_index2++];

                do {
                    entrada_padrao[d_index++] = entrada_padrao[d_index2++];
                } while (--teste > 0);

                erro = -5;
            }

            if (erro == -4) {

                entrada_padrao[d_index++] = entrada_padrao[d_index2];
                entrada_padrao[d_index++] = entrada_padrao[d_index2 + 1];

                erro = -5;
            }

            if (erro == -5) {

                tnc = compress[c_index - 2];
                tnc &= 3;
                truta = tnc;

                if (tnc == 0)
                    erro = -10;
                else
                    erro = -2;
            }

        } while (c_index <= size);

        if (c_index != size)
            tamanho = d_index;

        return Buffer.concat([entrada_padrao.slice(0, tamanho)]);
    }
}

module.exports = Compress;
