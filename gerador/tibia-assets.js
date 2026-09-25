// gerador/tibia-assets.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Lê os arquivos do cliente do Tibia (Tibia.spr e Tibia.dat, versão 7.80–8.54)
// pro gerador de sprites:
//   - catálogo dos itens e criaturas, por categoria;
//   - PNG de uma variação de um item (o gerador monta as folhas com eles);
//   - sugestão do conjunto de borda que combina com um chão;
//   - folha de criatura: uma linha por direção (sul, norte, leste, oeste) e
//     os quadros (1º parado, depois andando).

const SPRITE_SIZE = 32;
const ITEM_FIRST_ID = 100;

// Propriedades do .dat 7.80–8.54: número → nome (e quantos bytes de dado seguem).
const FLAG = {
  GROUND: 0, GROUND_BORDER: 1, ON_BOTTOM: 2, ON_TOP: 3, CONTAINER: 4, STACKABLE: 5,
  FORCE_USE: 6, MULTI_USE: 7, CHARGES: 8, WRITABLE: 9, WRITABLE_ONCE: 10, FLUID_CONTAINER: 11,
  FLUID: 12, UNPASSABLE: 13, UNMOVEABLE: 14, BLOCK_MISSILE: 15, BLOCK_PATH: 16, PICKUPABLE: 17,
  HANGABLE: 18, VERTICAL: 19, HORIZONTAL: 20, ROTATABLE: 21, LIGHT: 22, DONT_HIDE: 23,
  TRANSLUCENT: 24, OFFSET: 25, ELEVATION: 26, LYING: 27, ANIMATE_ALWAYS: 28, MINIMAP: 29,
  LENS_HELP: 30, FULL_GROUND: 31, IGNORE_LOOK: 32
};
const FLAG_DATA_BYTES = { 0: 2, 9: 2, 10: 2, 22: 4, 25: 4, 26: 2, 29: 2, 30: 2 };

// Direções do jogo (linhas do sprite) → coluna de direção do Tibia (0 norte, 1 leste, 2 sul, 3 oeste).
const DIRECTION_PATTERNS = [2, 0, 1, 3];

// Borda: faixa de cada lado do sqm usada pra reconhecer a peça, quanto dela
// precisa estar desenhada pro lado contar como "cheio", e a maior diferença
// de cor (média RGB) pra um conjunto ainda combinar com o chão.
const EDGE_BAND = 3;
const EDGE_FULL = 0.75;
const OUTER_CORNER_MAX_PIXELS = 600;
const MAX_BORDER_COLOR_DISTANCE = 35;

// Cores padrão da roupa (cabeça, corpo, pernas, pés) na paleta do Tibia.
const DEFAULT_OUTFIT_COLORS = [78, 69, 58, 76];

class TibiaAssets {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(pastaCliente) {
    this.spr = fs.readFileSync(path.join(pastaCliente, 'Tibia.spr'));
    this.dat = fs.readFileSync(path.join(pastaCliente, 'Tibia.dat'));
    this.spriteCount = this.spr.readUInt16LE(4);
    this.things = lerDat(this.dat);
    this.thumbCache = new Map();
  }

  // ================================================================================================================================================================================================================================================
  // catalogo
  // Lista compacta pro gerador: itens [id, categoria, largura, altura, quadros,
  // variações] e criaturas [id, largura, altura, quadros]. Itens sem desenho
  // ficam de fora.

  catalogo() {
    const items = [];
    for (const [id, thing] of this.things.item) {
      if (!this.temDesenho(thing)) continue;
      items.push([id, categoriaDoItem(thing), thing.w, thing.h, thing.anim, thing.px * thing.py * thing.pz]);
    }
    const creatures = [];
    for (const [id, thing] of this.things.outfit) {
      if (!this.temDesenho(thing)) continue;
      creatures.push([id, thing.w, thing.h, thing.anim]);
    }
    return { items, creatures };
  }

  // ================================================================================================================================================================================================================================================
  // temDesenho

  temDesenho(thing) {
    return thing.sprites.some(id => id > 0 && id <= this.spriteCount && this.spr.readUInt32LE(6 + (id - 1) * 4) > 0);
  }

  // ================================================================================================================================================================================================================================================
  // spriteDoItem
  // PNG do 1º quadro de uma variação do item. As variações vêm na ordem do
  // Tibia: x muda primeiro, depois y, depois z (no chão, a posição no mapa).

  spriteDoItem(id, variacao = 0) {
    const thing = this.things.item.get(id);
    if (!thing) return null;
    const total = thing.px * thing.py * thing.pz;
    if (!Number.isInteger(variacao) || variacao < 0 || variacao >= total) return null;

    const chave = `item:${id}:${variacao}`;
    if (this.thumbCache.has(chave)) return this.thumbCache.get(chave);
    const x = variacao % thing.px;
    const y = Math.floor(variacao / thing.px) % thing.py;
    const z = Math.floor(variacao / (thing.px * thing.py));
    const quadro = this.quadro(thing, { x, y, z, anim: 0 });
    const png = gerarPng(quadro.pixels, quadro.largura, quadro.altura);
    this.thumbCache.set(chave, png);
    return png;
  }

  // ================================================================================================================================================================================================================================================
  // sugerirBordas
  // O conjunto de borda que combina com o chão (ids do meio): o de cor mais
  // parecida, desempatando pelo número mais perto do chão (no Tibia o
  // conjunto costuma vir logo depois dele). Devolve { pecas: { s: id, … },
  // conjunto: [primeiro, último] } ou null se nenhum combinar.

  sugerirBordas(chaoIds) {
    const cores = chaoIds.map(id => this.things.item.get(id)).filter(Boolean).map(thing => corMedia(this.quadro(thing, {})));
    if (!cores.length) return null;
    const cor = [0, 1, 2].map(c => cores.reduce((soma, atual) => soma + atual[c], 0) / cores.length);

    let melhor = null;
    for (const conjunto of this.conjuntosDeBorda()) {
      const diferenca = conjunto.reduce((soma, peca) => soma + distanciaDeCor(peca.cor, cor), 0) / conjunto.length;
      const pontos = diferenca + Math.min(Math.abs(conjunto[0].id - chaoIds[0]), 2000) / 200;
      if (diferenca <= MAX_BORDER_COLOR_DISTANCE && (!melhor || pontos < melhor.pontos)) melhor = { conjunto, pontos };
    }
    if (!melhor) return null;

    const pecas = {};
    for (const peca of melhor.conjunto) pecas[peca.chave] = peca.id;
    return { pecas, conjunto: [melhor.conjunto[0].id, melhor.conjunto[melhor.conjunto.length - 1].id] };
  }

  // ================================================================================================================================================================================================================================================
  // conjuntosDeBorda
  // Bordas em sequência de números, cada uma reconhecida pelo desenho (qual
  // peça é); uma peça repetida começa outro conjunto. Só conjuntos com 8 ou
  // mais peças diferentes contam. Calculado uma vez.

  conjuntosDeBorda() {
    if (this.cacheConjuntos) return this.cacheConjuntos;
    const conjuntos = [];
    for (const [id, thing] of this.things.item) {
      if (categoriaDoItem(thing) !== 'border' || !this.temDesenho(thing)) continue;
      const quadro = this.quadro(thing, {});
      const chave = pecaDeBorda(quadro);
      if (!chave) continue;
      const peca = { id, chave, cor: corMedia(quadro) };
      const atual = conjuntos[conjuntos.length - 1];
      const continua = atual && id === atual[atual.length - 1].id + 1 && !atual.some(p => p.chave === chave);
      if (continua) atual.push(peca);
      else conjuntos.push([peca]);
    }
    this.cacheConjuntos = conjuntos.filter(conjunto => conjunto.length >= 8);
    return this.cacheConjuntos;
  }

  // ================================================================================================================================================================================================================================================
  // miniaturaCriatura
  // PNG da criatura parada, virada pro sul.

  miniaturaCriatura(id) {
    const chave = `creature:${id}`;
    if (this.thumbCache.has(chave)) return this.thumbCache.get(chave);
    const thing = this.things.outfit.get(id);
    if (!thing) return null;
    const quadro = this.quadroCriatura(thing, Math.min(DIRECTION_PATTERNS[0], thing.px - 1), 0, DEFAULT_OUTFIT_COLORS);
    const png = gerarPng(quadro.pixels, quadro.largura, quadro.altura);
    this.thumbCache.set(chave, png);
    return png;
  }

  // ================================================================================================================================================================================================================================================
  // exportarCriatura
  // Grava o PNG da criatura (direções × quadros) com as cores de roupa dadas.

  exportarCriatura(id, pastaImg, cores = DEFAULT_OUTFIT_COLORS) {
    const thing = this.things.outfit.get(id);
    if (!thing || !this.temDesenho(thing)) return null;

    const tamanho = Math.max(thing.w, thing.h) * SPRITE_SIZE;
    const folha = new Uint8Array(tamanho * thing.anim * tamanho * 4 * 4);
    DIRECTION_PATTERNS.forEach((pattern, linha) => {
      for (let anim = 0; anim < thing.anim; anim++) {
        const quadro = this.quadroCriatura(thing, Math.min(pattern, thing.px - 1), anim, cores);
        colar(folha, tamanho * thing.anim, quadro, anim * tamanho + tamanho - quadro.largura, linha * tamanho + tamanho - quadro.altura);
      }
    });

    const arquivo = `tibia/creatures/${id}.png`;
    gravarPng(path.join(pastaImg, arquivo), folha, tamanho * thing.anim, tamanho * 4);
    return { file: arquivo, spriteSize: tamanho, frames: thing.anim };
  }

  // ================================================================================================================================================================================================================================================
  // quadroCriatura
  // Quadro da criatura; com 2 camadas (roupa de humano), a 2ª é a máscara das
  // cores: amarelo = cabeça, vermelho = corpo, verde = pernas, azul = pés.

  quadroCriatura(thing, direcao, anim, cores) {
    const base = this.quadro(thing, { x: direcao, anim, layer: 0 });
    if (thing.layers < 2) return base;
    const mascara = this.quadro(thing, { x: direcao, anim, layer: 1 });
    const rgb = cores.map(corDaPaleta);
    for (let i = 0; i < base.pixels.length; i += 4) {
      if (!mascara.pixels[i + 3]) continue;
      const [r, g, b] = [mascara.pixels[i], mascara.pixels[i + 1], mascara.pixels[i + 2]];
      const parte = r && g && !b ? 0 : r && !g && !b ? 1 : !r && g && !b ? 2 : !r && !g && b ? 3 : -1;
      if (parte < 0) continue;
      for (let c = 0; c < 3; c++) base.pixels[i + c] = Math.round(base.pixels[i + c] * rgb[parte][c] / 255);
    }
    return base;
  }

  // ================================================================================================================================================================================================================================================
  // quadro
  // Monta um quadro (w×h sprites de 32px) de uma variação e camada. No .dat,
  // a parte (0,0) é o canto de baixo à direita; as outras crescem pra cima e
  // pra esquerda.

  quadro(thing, { x = 0, y = 0, z = 0, anim = 0, layer = 0 }) {
    const largura = thing.w * SPRITE_SIZE;
    const altura = thing.h * SPRITE_SIZE;
    const pixels = new Uint8Array(largura * altura * 4);
    for (let cy = 0; cy < thing.h; cy++) {
      for (let cx = 0; cx < thing.w; cx++) {
        const indice = ((((((anim * thing.pz + z) * thing.py + y) * thing.px + x) * thing.layers + layer) * thing.h + cy) * thing.w + cx);
        const sprite = this.sprite(thing.sprites[indice]);
        colar(pixels, largura, { pixels: sprite, largura: SPRITE_SIZE, altura: SPRITE_SIZE },
          (thing.w - 1 - cx) * SPRITE_SIZE, (thing.h - 1 - cy) * SPRITE_SIZE);
      }
    }
    return { pixels, largura, altura };
  }

  // ================================================================================================================================================================================================================================================
  // sprite
  // Sprite 32×32 em RGBA. No .spr cada sprite é: cor transparente (3 bytes),
  // tamanho, e pares (pixels transparentes, pixels coloridos + RGB deles).

  sprite(id) {
    const pixels = new Uint8Array(SPRITE_SIZE * SPRITE_SIZE * 4);
    if (id <= 0 || id > this.spriteCount) return pixels;
    const inicio = this.spr.readUInt32LE(6 + (id - 1) * 4);
    if (!inicio) return pixels;

    const tamanho = this.spr.readUInt16LE(inicio + 3);
    let p = inicio + 5;
    const fim = p + tamanho;
    let pixel = 0;
    while (p < fim) {
      pixel += this.spr.readUInt16LE(p);
      const coloridos = this.spr.readUInt16LE(p + 2);
      p += 4;
      for (let i = 0; i < coloridos; i++, pixel++, p += 3) {
        pixels[pixel * 4] = this.spr[p];
        pixels[pixel * 4 + 1] = this.spr[p + 1];
        pixels[pixel * 4 + 2] = this.spr[p + 2];
        pixels[pixel * 4 + 3] = 255;
      }
    }
    return pixels;
  }
}

// ================================================================================================================================================================================================================================================
// lerDat
// Itens (a partir do id 100), roupas/criaturas, efeitos e projéteis, cada um
// com propriedades, tamanho, variações, quadros e os ids das sprites.

function lerDat(dat) {
  const quantos = {
    item: dat.readUInt16LE(4) - ITEM_FIRST_ID + 1,
    outfit: dat.readUInt16LE(6),
    effect: dat.readUInt16LE(8),
    missile: dat.readUInt16LE(10)
  };
  const things = { item: new Map(), outfit: new Map(), effect: new Map(), missile: new Map() };
  let p = 12;

  for (const tipo of ['item', 'outfit', 'effect', 'missile']) {
    const primeiro = tipo === 'item' ? ITEM_FIRST_ID : 1;
    for (let n = 0; n < quantos[tipo]; n++) {
      const flags = {};
      for (;;) {
        const flag = dat[p++];
        if (flag === 0xFF) break;
        const bytes = FLAG_DATA_BYTES[flag] || 0;
        flags[flag] = bytes === 2 ? dat.readUInt16LE(p) : true;
        p += bytes;
      }
      const w = dat[p];
      const h = dat[p + 1];
      p += 2;
      if (w > 1 || h > 1) p++;
      const [layers, px, py, pz, anim] = dat.subarray(p, p + 5);
      p += 5;
      const total = w * h * layers * px * py * pz * anim;
      const sprites = [];
      for (let i = 0; i < total; i++, p += 2) sprites.push(dat.readUInt16LE(p));
      things[tipo].set(primeiro + n, { flags, w, h, layers, px, py, pz, anim, sprites });
    }
  }

  if (p !== dat.length) throw new Error(`Tibia.dat não é da versão 7.80–8.54 (leu ${p} de ${dat.length} bytes)`);
  return things;
}

// ================================================================================================================================================================================================================================================
// temFlag

function temFlag(thing, ...flags) {
  return flags.some(flag => flag in thing.flags);
}

// ================================================================================================================================================================================================================================================
// categoriaDoItem
// ground: chão; border: borda de chão; wall: parede/construção (fica embaixo
// dos outros itens); item: dá pra pegar; object: o resto (móveis, natureza…).

function categoriaDoItem(thing) {
  if (temFlag(thing, FLAG.GROUND)) return 'ground';
  if (temFlag(thing, FLAG.GROUND_BORDER)) return 'border';
  if (temFlag(thing, FLAG.ON_BOTTOM)) return 'wall';
  if (temFlag(thing, FLAG.PICKUPABLE)) return 'item';
  return 'object';
}

// ================================================================================================================================================================================================================================================
// sqmDoQuadro
// Pixels do sqm principal do quadro (32 × 32 do canto de baixo à direita).

function sqmDoQuadro(quadro, callback) {
  for (let y = 0; y < SPRITE_SIZE; y++) {
    for (let x = 0; x < SPRITE_SIZE; x++) {
      const i = ((quadro.altura - SPRITE_SIZE + y) * quadro.largura + quadro.largura - SPRITE_SIZE + x) * 4;
      if (quadro.pixels[i + 3]) callback(x, y, i);
    }
  }
}

// ================================================================================================================================================================================================================================================
// corMedia
// Cor média [r, g, b] dos pixels desenhados do sqm.

function corMedia(quadro) {
  const soma = [0, 0, 0];
  let total = 0;
  sqmDoQuadro(quadro, (x, y, i) => {
    for (let c = 0; c < 3; c++) soma[c] += quadro.pixels[i + c];
    total++;
  });
  return total ? soma.map(v => v / total) : [0, 0, 0];
}

// ================================================================================================================================================================================================================================================
// distanciaDeCor

function distanciaDeCor(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// ================================================================================================================================================================================================================================================
// pecaDeBorda
// Qual peça de borda o desenho é, pelos lados do sqm que ele cobre:
//   um lado cheio            → lado (faixa em cima = 's', à direita = 'o'…)
//   dois lados vizinhos      → canto de dentro ('int-sl' = em cima e à esquerda…)
//   nenhum lado, desenho pequeno num canto → canto de fora ('sl' = em cima à esquerda…)
// Os nomes dizem onde a peça fica em relação ao piso. null se não der pra saber.

function pecaDeBorda(quadro) {
  const lados = { top: 0, bottom: 0, left: 0, right: 0 };
  let total = 0;
  let somaX = 0;
  let somaY = 0;
  sqmDoQuadro(quadro, (x, y) => {
    total++;
    somaX += x;
    somaY += y;
    if (y < EDGE_BAND) lados.top++;
    if (y >= SPRITE_SIZE - EDGE_BAND) lados.bottom++;
    if (x < EDGE_BAND) lados.left++;
    if (x >= SPRITE_SIZE - EDGE_BAND) lados.right++;
  });
  if (!total) return null;

  const cheio = (lado) => lados[lado] / (EDGE_BAND * SPRITE_SIZE) > EDGE_FULL;
  const [T, B, L, R] = ['top', 'bottom', 'left', 'right'].map(cheio);
  const assinatura = `${+T}${+B}${+L}${+R}`;
  const porLados = {
    '1010': 'int-sl', '1001': 'int-so', '0110': 'int-nl', '0101': 'int-no',
    '1000': 's', '0001': 'o', '0100': 'n', '0010': 'l'
  };
  if (porLados[assinatura]) return porLados[assinatura];
  if (assinatura !== '0000' || total > OUTER_CORNER_MAX_PIXELS) return null;

  const emCima = somaY / total < SPRITE_SIZE / 2;
  const aEsquerda = somaX / total < SPRITE_SIZE / 2;
  return emCima ? (aEsquerda ? 'sl' : 'so') : (aEsquerda ? 'nl' : 'no');
}

// ================================================================================================================================================================================================================================================
// corDaPaleta
// Cor [r, g, b] de um índice da paleta de roupas do Tibia (19 tons × 7 níveis).

function corDaPaleta(indice) {
  const TONS = 19;
  const NIVEIS = 7;
  if (indice >= TONS * NIVEIS) indice = 0;

  let matiz = 0;
  let saturacao = 0;
  let brilho = 1 - indice / TONS / NIVEIS;
  if (indice % TONS !== 0) {
    matiz = (indice % TONS) / 18;
    [saturacao, brilho] = [[0.25, 1], [0.25, 0.75], [0.5, 0.75], [0.667, 0.75], [1, 1], [1, 0.75], [1, 0.5]][Math.floor(indice / TONS)];
  }
  if (brilho === 0) return [0, 0, 0];
  if (saturacao === 0) {
    const v = Math.round(brilho * 255);
    return [v, v, v];
  }

  let r;
  let g;
  let b;
  if (matiz < 1 / 6) { r = brilho; b = brilho * (1 - saturacao); g = b + (brilho - b) * 6 * matiz; }
  else if (matiz < 2 / 6) { g = brilho; b = brilho * (1 - saturacao); r = g - (brilho - b) * (6 * matiz - 1); }
  else if (matiz < 3 / 6) { g = brilho; r = brilho * (1 - saturacao); b = r + (brilho - r) * (6 * matiz - 2); }
  else if (matiz < 4 / 6) { b = brilho; r = brilho * (1 - saturacao); g = b - (brilho - r) * (6 * matiz - 3); }
  else if (matiz < 5 / 6) { b = brilho; g = brilho * (1 - saturacao); r = g + (brilho - g) * (6 * matiz - 4); }
  else { r = brilho; g = brilho * (1 - saturacao); b = r - (brilho - g) * (6 * matiz - 5); }
  return [r, g, b].map(v => Math.round(v * 255));
}

// ================================================================================================================================================================================================================================================
// colar
// Copia o quadro (pixels opacos) pra dentro da folha na posição (x, y).

function colar(folha, larguraFolha, quadro, x, y) {
  for (let linha = 0; linha < quadro.altura; linha++) {
    for (let coluna = 0; coluna < quadro.largura; coluna++) {
      const origem = (linha * quadro.largura + coluna) * 4;
      if (!quadro.pixels[origem + 3]) continue;
      const destino = ((y + linha) * larguraFolha + x + coluna) * 4;
      folha.set(quadro.pixels.subarray(origem, origem + 4), destino);
    }
  }
}

// ================================================================================================================================================================================================================================================
// gravarPng

function gravarPng(arquivo, pixels, largura, altura) {
  fs.mkdirSync(path.dirname(arquivo), { recursive: true });
  fs.writeFileSync(arquivo, gerarPng(pixels, largura, altura));
}

// ================================================================================================================================================================================================================================================
// gerarPng
// PNG RGBA sem compressão de filtro (cada linha com filtro 0).

function gerarPng(pixels, largura, altura) {
  const bruto = Buffer.alloc((largura * 4 + 1) * altura);
  for (let y = 0; y < altura; y++) {
    bruto[y * (largura * 4 + 1)] = 0;
    Buffer.from(pixels.buffer, pixels.byteOffset + y * largura * 4, largura * 4).copy(bruto, y * (largura * 4 + 1) + 1);
  }
  const cabecalho = Buffer.alloc(13);
  cabecalho.writeUInt32BE(largura, 0);
  cabecalho.writeUInt32BE(altura, 4);
  cabecalho.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    blocoPng('IHDR', cabecalho),
    blocoPng('IDAT', zlib.deflateSync(bruto, { level: 9 })),
    blocoPng('IEND', Buffer.alloc(0))
  ]);
}

// ================================================================================================================================================================================================================================================
// blocoPng

function blocoPng(tipo, dados) {
  const tamanho = Buffer.alloc(4);
  tamanho.writeUInt32BE(dados.length);
  const corpo = Buffer.concat([Buffer.from(tipo, 'ascii'), dados]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(corpo));
  return Buffer.concat([tamanho, corpo, crc]);
}

// ================================================================================================================================================================================================================================================
// crc32

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xFFFFFFFF;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

module.exports = { TibiaAssets, DEFAULT_OUTFIT_COLORS };
