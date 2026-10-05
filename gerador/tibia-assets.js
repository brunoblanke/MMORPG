// gerador/tibia-assets.js

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Lê os arquivos do cliente do Tibia (Tibia.spr e Tibia.dat) pro gerador de
// sprites. Lê dois formatos: o da versão 7.80–8.54 e o estendido (10.x em
// diante, usado pelas conversões do cliente atual: sprites às vezes com
// transparência, ids de 4 bytes, animação com tempo por quadro e criatura parada/andando em
// grupos separados). O resto do gerador vê os dois do mesmo jeito.
//   - catálogo dos itens e criaturas, por categoria;
//   - PNG de uma variação de um item (o gerador monta as folhas com eles);
//   - sugestão do conjunto de borda que combina com um chão;
//   - sugestão das 4 peças de parede (X, Y, canto, pilar) de um material;
//   - propriedades de um item (bloqueia, move, altura…), pros objetos;
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

// .dat estendido: número → número da tabela acima (o que não existe no 7.80
// fica com 100 + o número, sem uso), bytes de dado de cada um e o do mercado
// (tamanho variável).
const EXTENDED_FLAGS = [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16, 116, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32];
const EXTENDED_DATA_BYTES = { 0: 2, 8: 2, 9: 2, 22: 4, 25: 4, 26: 2, 29: 2, 30: 2, 33: 2, 35: 2 };
const EXTENDED_MARKET = 34;

// Direções do jogo (linhas do sprite) → coluna de direção do Tibia (0 norte, 1 leste, 2 sul, 3 oeste).
const DIRECTION_PATTERNS = [2, 0, 1, 3];

// Borda: faixa de cada lado do sqm usada pra reconhecer a peça, quanto dela
// precisa estar desenhada pro lado contar como "cheio", e a maior diferença
// de cor (média RGB) pra um conjunto ainda combinar com o chão.
const EDGE_BAND = 3;
const EDGE_FULL = 0.75;
const OUTER_CORNER_MAX_PIXELS = 600;
const MAX_BORDER_COLOR_DISTANCE = 35;
const BORDER_KEYS_TOTAL = 12;

// Chão feito de itens separados (padraoDeItens): até 9 peças, no máximo 4 por
// lado, de cor parecida; vale se as emendas não forem mais que 15% piores que
// o meio das peças.
const PATTERN_MAX_PIECES = 9;
const PATTERN_MAX_SIDE = 4;
const PATTERN_COLOR_DISTANCE = 35;
const PATTERN_SEAM_TOLERANCE = 1.15;

// Parede: as 4 peças, cada uma com um item do Tibia de molde (o formato é o
// mesmo em todo material): x horizontal, y vertical, xy canto, yx pilar. Uma
// parede é daquela peça se o desenho coincide com o molde pelo menos tanto.
const WALL_TEMPLATES = { x: 1271, y: 1270, xy: 1619, yx: 2242 };
const WALL_MATCH = 0.75;
const WALL_SIZE = 64;

// Porta: no .dat toda porta tem a ajuda da lente 1104 (porta comum) ou 1105
// (porta especial). A fechada bloqueia a passagem; a aberta vem logo depois
// dela (às vezes com uma trancada no meio).
const DOOR_LENS = [1104, 1105];
const DOOR_GAP = 3;
const DOOR_SEARCH = 30;

// Cores padrão da roupa (cabeça, corpo, pernas, pés) na paleta do Tibia.
const DEFAULT_OUTFIT_COLORS = [78, 69, 58, 76];

class TibiaAssets {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(pastaCliente, arquivos = { spr: 'Tibia.spr', dat: 'Tibia.dat' }) {
    this.spr = fs.readFileSync(path.join(pastaCliente, arquivos.spr));
    this.dat = fs.readFileSync(path.join(pastaCliente, arquivos.dat));
    this.estendido = this.spr.readUInt32LE(4) * 4 + 8 <= this.spr.length && this.spr.readUInt32LE(8) === this.spr.readUInt32LE(4) * 4 + 8;
    this.spriteCount = this.estendido ? this.spr.readUInt32LE(4) : this.spr.readUInt16LE(4);
    this.inicioDosEnderecos = this.estendido ? 8 : 6;
    this.bytesPorPixel = this.estendido && this.temTransparencia() ? 4 : 3;
    this.things = this.estendido ? lerDatEstendido(this.dat) : lerDat(this.dat);
    this.thumbCache = new Map();
  }

  // ================================================================================================================================================================================================================================================
  // temTransparencia
  // O .spr estendido pode ter a cor em RGB ou RGBA: é RGBA se, lendo assim,
  // os primeiros sprites desenhados terminam certinho no tamanho deles.

  temTransparencia() {
    let conferidos = 0;
    for (let id = 1; id <= this.spriteCount && conferidos < 20; id++) {
      const inicio = this.enderecoDoSprite(id);
      if (!inicio) continue;
      conferidos++;
      let p = inicio + 5;
      const fim = p + this.spr.readUInt16LE(inicio + 3);
      while (p < fim) p += 4 + this.spr.readUInt16LE(p + 2) * 4;
      if (p !== fim) return false;
    }
    return conferidos > 0;
  }

  // ================================================================================================================================================================================================================================================
  // enderecoDoSprite
  // Onde o sprite começa no .spr (0 se ele é vazio).

  enderecoDoSprite(id) {
    return this.spr.readUInt32LE(this.inicioDosEnderecos + (id - 1) * 4);
  }

  // ================================================================================================================================================================================================================================================
  // catalogo
  // Lista compacta pro gerador: itens [id, categoria, largura, altura, quadros,
  // variações] e criaturas [id, largura, altura, quadros, tem cores, addons].
  // O que não tem desenho fica de fora.

  catalogo() {
    const items = [];
    for (const [id, thing] of this.things.item) {
      if (!this.temDesenho(thing)) continue;
      items.push([id, categoriaDoItem(thing), thing.w, thing.h, thing.anim, totalDeVariacoes(thing), thing.px * thing.py * thing.pz]);
    }
    const creatures = [];
    for (const [id, thing] of this.things.outfit) {
      if (!this.temDesenho(thing)) continue;
      creatures.push([id, thing.w, thing.h, thing.anim, thing.layers > 1, thing.py - 1]);
    }
    return { items, creatures };
  }

  // ================================================================================================================================================================================================================================================
  // temDesenho

  temDesenho(thing) {
    return thing.sprites.some(id => id > 0 && id <= this.spriteCount && this.enderecoDoSprite(id) > 0);
  }

  // ================================================================================================================================================================================================================================================
  // spriteDoItem
  // PNG de um quadro da animação de uma variação do item. As variações vêm
  // na ordem do Tibia: x muda primeiro, depois y, depois z (no chão, a
  // posição no mapa). Item com mais de uma camada (monte de pedras sobre a
  // grama, buraco de pá…) ganha, depois das normais, as mesmas variações com
  // todas as camadas empilhadas, como o Tibia desenha.

  spriteDoItem(id, variacao = 0, anim = 0) {
    const thing = this.things.item.get(id);
    if (!thing) return null;
    const base = thing.px * thing.py * thing.pz;
    if (!Number.isInteger(variacao) || variacao < 0 || variacao >= totalDeVariacoes(thing)) return null;
    if (!Number.isInteger(anim) || anim < 0 || anim >= thing.anim) return null;

    const chave = `item:${id}:${variacao}:${anim}`;
    if (this.thumbCache.has(chave)) return this.thumbCache.get(chave);
    const camadas = variacao >= base;
    const v = variacao % base;
    const x = v % thing.px;
    const y = Math.floor(v / thing.px) % thing.py;
    const z = Math.floor(v / (thing.px * thing.py));
    const quadro = this.quadro(thing, { x, y, z, anim });
    for (let layer = 1; camadas && layer < thing.layers; layer++) {
      colar(quadro.pixels, quadro.largura, this.quadro(thing, { x, y, z, anim, layer }), 0, 0);
    }
    const png = gerarPng(quadro.pixels, quadro.largura, quadro.altura);
    this.thumbCache.set(chave, png);
    return png;
  }

  // ================================================================================================================================================================================================================================================
  // infoDoItem
  // Tamanho, quadros, variações e as propriedades do .dat que importam pro
  // jogo, ou null se o item não existe.

  infoDoItem(id) {
    const thing = this.things.item.get(id);
    if (!thing) return null;
    return {
      id,
      categoria: categoriaDoItem(thing),
      tamanho: Math.max(thing.w, thing.h) * SPRITE_SIZE,
      quadros: thing.anim,
      msPorQuadro: thing.duracoes && thing.duracoes.length ? Math.round(thing.duracoes.reduce((a, b) => a + b, 0) / thing.duracoes.length) : 0,
      variacoes: totalDeVariacoes(thing),
      variacoesSemCamadas: thing.px * thing.py * thing.pz,
      padrao: [thing.px, thing.py],
      bloqueia: temFlag(thing, FLAG.UNPASSABLE),
      move: !temFlag(thing, FLAG.UNMOVEABLE),
      altura: temFlag(thing, FLAG.ELEVATION),
      pegavel: temFlag(thing, FLAG.PICKUPABLE),
      empilhavel: temFlag(thing, FLAG.STACKABLE),
      container: temFlag(thing, FLAG.CONTAINER)
    };
  }

  // ================================================================================================================================================================================================================================================
  // padraoDeItens
  // Chão do Tibia feito de itens separados que juntos formam um bloco sem
  // costura (ex.: areia 959–966, 2 × 4): os vizinhos de número do mesmo tipo
  // e cor parecida, no arranjo em que as emendas ficam tão suaves quanto o
  // meio de cada peça. { colunas, linhas, ids } (ids linha a linha) ou null.

  padraoDeItens(id) {
    const simples = (outro) => {
      const thing = this.things.item.get(outro);
      return thing && categoriaDoItem(thing) === 'ground' && thing.w === 1 && thing.h === 1 && thing.px * thing.py === 1;
    };
    if (!simples(id)) return null;
    const cor = (item) => corMedia(this.quadro(this.things.item.get(item), {}));
    const parecido = (a, b) => simples(b) && distanciaDeCor(cor(a), cor(b)) <= PATTERN_COLOR_DISTANCE;
    let inicio = id;
    let fim = id;
    while (parecido(inicio, inicio - 1) && id - inicio < PATTERN_MAX_PIECES) inicio--;
    while (parecido(fim, fim + 1) && fim - id < PATTERN_MAX_PIECES) fim++;
    for (let total = Math.min(PATTERN_MAX_PIECES, fim - inicio + 1); total >= 2; total--) {
      for (let primeiro = Math.max(inicio, id - total + 1); primeiro <= Math.min(id, fim - total + 1); primeiro++) {
        const padrao = this.blocoSemCostura(Array.from({ length: total }, (_, i) => primeiro + i));
        if (padrao) return padrao;
      }
    }
    return null;
  }

  // ================================================================================================================================================================================================================================================
  // blocoSemCostura
  // O arranjo das peças (até 4 por lado) em que as emendas, repetindo o
  // bloco, ficam tão suaves quanto o meio de cada peça, ou null.

  blocoSemCostura(ids) {
    const total = ids.length;
    const pixels = new Map(ids.map(item => [item, this.quadro(this.things.item.get(item), {}).pixels]));
    const diferenca = (a, ia, b, ib) => Math.abs(a[ia] - b[ib]) + Math.abs(a[ia + 1] - b[ib + 1]) + Math.abs(a[ia + 2] - b[ib + 2]);
    const emenda = (a, b, horizontal) => {
      let soma = 0;
      for (let k = 0; k < SPRITE_SIZE; k++) {
        soma += horizontal
          ? diferenca(pixels.get(a), (k * SPRITE_SIZE + SPRITE_SIZE - 1) * 4, pixels.get(b), k * SPRITE_SIZE * 4)
          : diferenca(pixels.get(a), ((SPRITE_SIZE - 1) * SPRITE_SIZE + k) * 4, pixels.get(b), k * 4);
      }
      return soma / SPRITE_SIZE;
    };
    let interno = 0;
    for (const item of ids) {
      for (let k = 0; k < SPRITE_SIZE; k++) interno += diferenca(pixels.get(item), (k * SPRITE_SIZE + 15) * 4, pixels.get(item), (k * SPRITE_SIZE + 16) * 4) / SPRITE_SIZE;
    }
    interno /= total;
    const direita = new Map(ids.map(a => [a, new Map(ids.map(b => [b, emenda(a, b, true)]))]));
    const abaixo = new Map(ids.map(a => [a, new Map(ids.map(b => [b, emenda(a, b, false)]))]));

    let melhor = null;
    for (let colunas = 1; colunas <= PATTERN_MAX_SIDE; colunas++) {
      if (total % colunas || total / colunas > PATTERN_MAX_SIDE) continue;
      const linhas = total / colunas;
      const custo = (ordem) => {
        let soma = 0;
        for (let y = 0; y < linhas; y++) {
          for (let x = 0; x < colunas; x++) {
            const a = ordem[y * colunas + x];
            soma += direita.get(a).get(ordem[y * colunas + (x + 1) % colunas]) + abaixo.get(a).get(ordem[((y + 1) % linhas) * colunas + x]);
          }
        }
        return soma / (2 * total);
      };
      for (const ordem of permutacoes(ids.slice(1), [ids[0]])) {
        const valor = custo(ordem);
        if (!melhor || valor < melhor.valor) melhor = { valor, colunas, linhas, ids: ordem };
      }
    }
    if (!melhor || melhor.valor > interno * PATTERN_SEAM_TOLERANCE) return null;
    return { colunas: melhor.colunas, linhas: melhor.linhas, ids: melhor.ids };
  }

  // ================================================================================================================================================================================================================================================
  // sugerirBordas
  // O conjunto de borda que combina com o chão (ids do meio): o de cor mais
  // parecida, desempatando pelo número mais perto do chão (no Tibia o
  // conjunto costuma vir logo depois dele). Prefere os de desenho novo (fora
  // de antigos, a aba Old); faltando peça, completa com o conjunto inteiro que
  // mais combina. Devolve { pecas: { s: id, … }, conjunto: [primeiro,
  // último], completadas: [peças de outro conjunto] } ou null.

  sugerirBordas(chaoIds) {
    const cores = chaoIds.map(id => this.things.item.get(id)).filter(Boolean).map(thing => corMedia(this.quadro(thing, {})));
    if (!cores.length) return null;
    const cor = [0, 1, 2].map(c => cores.reduce((soma, atual) => soma + atual[c], 0) / cores.length);
    const antigo = (conjunto) => !!this.antigos && conjunto.every(peca => this.antigos.has(peca.id));

    const melhorDe = (conjuntos) => {
      let melhor = null;
      for (const conjunto of conjuntos) {
        const diferenca = conjunto.reduce((soma, peca) => soma + distanciaDeCor(peca.cor, cor), 0) / conjunto.length;
        const pontos = diferenca + Math.min(Math.abs(conjunto[0].id - chaoIds[0]), 2000) / 200;
        if (diferenca <= MAX_BORDER_COLOR_DISTANCE && (!melhor || pontos < melhor.pontos)) melhor = { conjunto, pontos };
      }
      return melhor && melhor.conjunto;
    };
    const todos = this.conjuntosDeBorda();
    const escolhido = melhorDe(todos.filter(conjunto => !antigo(conjunto))) || melhorDe(todos);
    if (!escolhido) return null;

    const pecas = {};
    for (const peca of escolhido) pecas[peca.chave] = peca.id;
    const completo = melhorDe(todos.filter(conjunto => conjunto.length >= BORDER_KEYS_TOTAL));
    const completadas = [];
    for (const peca of completo && completo !== escolhido ? completo : []) {
      if (pecas[peca.chave]) continue;
      pecas[peca.chave] = peca.id;
      completadas.push(peca.chave);
    }
    return { pecas, conjunto: [escolhido[0].id, escolhido[escolhido.length - 1].id], completadas };
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
  // pecaDeParede
  // Qual das 4 peças de parede o item é (pelo desenho), ou null.

  pecaDeParede(id) {
    if (!this.cachePecas) this.cachePecas = new Map();
    if (this.cachePecas.has(id)) return this.cachePecas.get(id);
    if (!this.moldesDeParede) {
      this.moldesDeParede = Object.entries(WALL_TEMPLATES).map(([peca, molde]) => [peca, mascaraDeParede(this.quadro(this.things.item.get(molde), {}))]);
    }

    const thing = this.things.item.get(id);
    let peca = null;
    if (thing && categoriaDoItem(thing) === 'wall') {
      const mascara = mascaraDeParede(this.quadro(thing, {}));
      let melhor = WALL_MATCH;
      for (const [nome, molde] of this.moldesDeParede) {
        const parecido = coincidencia(mascara, molde);
        if (parecido >= melhor) {
          melhor = parecido;
          peca = nome;
        }
      }
    }
    this.cachePecas.set(id, peca);
    return peca;
  }

  // ================================================================================================================================================================================================================================================
  // sugerirParedes
  // As 4 peças do material da parede escolhida: pra cada peça, a parede de
  // cor mais parecida, desempatando pelo número mais perto (no Tibia as peças
  // de um material vêm juntas). A escolhida fica no lugar dela. Devolve
  // { pecas: { x: id, y: id, xy: id, yx: id } } (a que não achar fica de fora)
  // ou null se o item não for uma peça de parede.

  sugerirParedes(id) {
    const pecaEscolhida = this.pecaDeParede(id);
    if (!pecaEscolhida) return null;
    const cor = corMedia(this.quadro(this.things.item.get(id), {}));

    const pecas = { [pecaEscolhida]: id };
    const melhores = {};
    for (let outro = id - 60; outro <= id + 60; outro++) {
      const peca = this.pecaDeParede(outro);
      if (!peca || peca === pecaEscolhida) continue;
      const diferenca = distanciaDeCor(corMedia(this.quadro(this.things.item.get(outro), {})), cor);
      if (diferenca > MAX_BORDER_COLOR_DISTANCE) continue;
      const pontos = diferenca + Math.abs(outro - id);
      if (!melhores[peca] || pontos < melhores[peca].pontos) melhores[peca] = { id: outro, pontos };
    }
    for (const [peca, melhor] of Object.entries(melhores)) pecas[peca] = melhor.id;
    return { pecas };
  }

  // ================================================================================================================================================================================================================================================
  // portas
  // Todas as portas do Tibia em pares, na ordem dos ids:
  // [{ fechada, aberta, ultima, orientacao: 'x' | 'y', lente }]. A orientação
  // sai do desenho da fechada (parece a parede x ou a y); a trancada que vem
  // logo depois entra no mesmo par.

  portas() {
    if (this.cachePortas) return this.cachePortas;
    this.pecaDeParede(WALL_TEMPLATES.x);
    const moldes = Object.fromEntries(this.moldesDeParede);
    const pares = [];
    let atual = null;
    for (const [id, thing] of this.things.item) {
      if (categoriaDoItem(thing) !== 'door' || !this.temDesenho(thing)) continue;
      const lente = thing.flags[FLAG.LENS_HELP];
      const perto = atual && atual.lente === lente && id - atual.ultima <= DOOR_GAP;
      if (temFlag(thing, FLAG.UNPASSABLE)) {
        if (perto && !atual.aberta) {
          atual.ultima = id;
          continue;
        }
        const mascara = mascaraDeParede(this.quadro(thing, {}));
        const orientacao = coincidencia(mascara, moldes.x) >= coincidencia(mascara, moldes.y) ? 'x' : 'y';
        atual = { fechada: id, aberta: null, ultima: id, orientacao, lente };
        pares.push(atual);
      } else if (perto && !atual.aberta) {
        atual.aberta = id;
        atual.ultima = id;
      }
    }
    this.cachePortas = pares.filter(par => par.aberta);
    return this.cachePortas;
  }

  // ================================================================================================================================================================================================================================================
  // sugerirPortas
  // As 4 portas a partir de uma porta escolhida (fechada, trancada ou
  // aberta): a outra da mesma orientação vem do par dela, e o par da outra
  // orientação é o mais perto com a mesma lente. Devolve
  // { pecas: { 'porta-x', 'porta-x-aberta', 'porta-y', 'porta-y-aberta' } }
  // (o que não achar fica de fora) ou null se o item não for porta.

  sugerirPortas(id) {
    const pares = this.portas();
    const par = pares.find(p => id >= p.fechada && id <= p.ultima);
    if (!par) return null;
    const escolhidaAberta = id === par.aberta;
    const pecas = {
      [`porta-${par.orientacao}`]: escolhidaAberta ? par.fechada : id,
      [`porta-${par.orientacao}-aberta`]: par.aberta
    };
    let outro = null;
    for (const p of pares) {
      if (p.orientacao === par.orientacao || p.lente !== par.lente) continue;
      const distancia = Math.abs(p.fechada - par.fechada);
      if (distancia <= DOOR_SEARCH && (!outro || distancia < Math.abs(outro.fechada - par.fechada))) outro = p;
    }
    if (outro) {
      pecas[`porta-${outro.orientacao}`] = outro.fechada;
      pecas[`porta-${outro.orientacao}-aberta`] = outro.aberta;
    }
    return { pecas };
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
  // folhaDeCriatura
  // PNG da criatura: uma linha por direção (sul, norte, leste, oeste) e os
  // quadros lado a lado, cada um em tamanho × tamanho (32 ou 64, o tamanho do
  // desenho no Tibia). Roupa de humano leva as cores (cabeça, corpo, pernas,
  // pés) e os addons pedidos. O deslocamento do Tibia não é aplicado: se for
  // preciso, o jogo faz na hora de desenhar.
  // Devolve { png, tamanho, quadros } ou null.

  folhaDeCriatura(id, { cores = DEFAULT_OUTFIT_COLORS, addons = [] } = {}) {
    const thing = this.things.outfit.get(id);
    if (!thing || !this.temDesenho(thing)) return null;

    const tamanho = Math.max(thing.w, thing.h) * SPRITE_SIZE;
    const camadas = [0, ...addons.filter(addon => addon >= 1 && addon < thing.py)];
    const folha = new Uint8Array(tamanho * thing.anim * tamanho * 4 * 4);

    DIRECTION_PATTERNS.forEach((pattern, linha) => {
      for (let anim = 0; anim < thing.anim; anim++) {
        for (const addon of camadas) {
          const quadro = this.quadroCriatura(thing, Math.min(pattern, thing.px - 1), anim, cores, addon);
          colar(folha, tamanho * thing.anim, quadro,
            anim * tamanho + tamanho - quadro.largura, linha * tamanho + tamanho - quadro.altura);
        }
      }
    });

    return { png: gerarPng(folha, tamanho * thing.anim, tamanho * 4), tamanho, quadros: thing.anim };
  }

  // ================================================================================================================================================================================================================================================
  // quadroCriatura
  // Quadro da criatura; com 2 camadas (roupa de humano), a 2ª é a máscara das
  // cores: amarelo = cabeça, vermelho = corpo, verde = pernas, azul = pés.

  quadroCriatura(thing, direcao, anim, cores, addon = 0) {
    const base = this.quadro(thing, { x: direcao, y: addon, anim, layer: 0 });
    if (thing.layers < 2) return base;
    const mascara = this.quadro(thing, { x: direcao, y: addon, anim, layer: 1 });
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
  // tamanho, e pares (pixels transparentes, pixels coloridos + cor deles: RGB
  // no 7.80, RGBA no estendido).

  sprite(id) {
    const pixels = new Uint8Array(SPRITE_SIZE * SPRITE_SIZE * 4);
    if (id <= 0 || id > this.spriteCount) return pixels;
    const inicio = this.enderecoDoSprite(id);
    if (!inicio) return pixels;

    const bytesPorPixel = this.bytesPorPixel;
    const tamanho = this.spr.readUInt16LE(inicio + 3);
    let p = inicio + 5;
    const fim = p + tamanho;
    let pixel = 0;
    while (p < fim && pixel < SPRITE_SIZE * SPRITE_SIZE) {
      pixel += this.spr.readUInt16LE(p);
      const coloridos = this.spr.readUInt16LE(p + 2);
      p += 4;
      for (let i = 0; i < coloridos && pixel < SPRITE_SIZE * SPRITE_SIZE; i++, pixel++, p += bytesPorPixel) {
        pixels[pixel * 4] = this.spr[p];
        pixels[pixel * 4 + 1] = this.spr[p + 1];
        pixels[pixel * 4 + 2] = this.spr[p + 2];
        pixels[pixel * 4 + 3] = bytesPorPixel === 4 ? this.spr[p + 3] : 255;
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
        flags[flag] = bytes === 2 ? dat.readUInt16LE(p) : bytes === 4 ? [dat.readUInt16LE(p), dat.readUInt16LE(p + 2)] : true;
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
// lerDatEstendido
// O .dat estendido (10.x em diante): as propriedades vêm numa tabela um pouco
// diferente (traduzidas pra do 7.80), os ids das sprites têm 4 bytes, a
// animação tem o tempo de cada quadro e a criatura tem dois grupos: parada e
// andando. Pro gerador, a criatura fica como no 7.80: o 1º quadro parado e
// depois os quadros andando.

function lerDatEstendido(dat) {
  const quantos = {
    item: dat.readUInt16LE(4) - ITEM_FIRST_ID + 1,
    outfit: dat.readUInt16LE(6),
    effect: dat.readUInt16LE(8),
    missile: dat.readUInt16LE(10)
  };
  const things = { item: new Map(), outfit: new Map(), effect: new Map(), missile: new Map() };
  let p = 12;

  const lerGrupo = () => {
    const w = dat[p];
    const h = dat[p + 1];
    p += 2;
    if (w > 1 || h > 1) p++;
    const [layers, px, py, pz, anim] = dat.subarray(p, p + 5);
    p += 5;
    const duracoes = [];
    if (anim > 1) {
      p += 6;
      for (let a = 0; a < anim; a++, p += 8) duracoes.push(dat.readUInt32LE(p));
    }
    const total = w * h * layers * px * py * pz * anim;
    const sprites = [];
    for (let i = 0; i < total; i++, p += 4) sprites.push(dat.readUInt32LE(p));
    return { w, h, layers, px, py, pz, anim, duracoes, sprites };
  };

  for (const tipo of ['item', 'outfit', 'effect', 'missile']) {
    const primeiro = tipo === 'item' ? ITEM_FIRST_ID : 1;
    for (let n = 0; n < quantos[tipo]; n++) {
      const flags = {};
      for (;;) {
        const flag = dat[p++];
        if (flag === 0xFF) break;
        const nome = flag < EXTENDED_FLAGS.length ? EXTENDED_FLAGS[flag] : 100 + flag;
        if (flag === EXTENDED_MARKET) {
          const categoria = dat.readUInt16LE(p);
          p += 6;
          const tamanho = dat.readUInt16LE(p);
          flags[nome] = { categoria, nome: dat.toString('latin1', p + 2, p + 2 + tamanho) };
          p += 2 + tamanho + 4;
          continue;
        }
        const bytes = EXTENDED_DATA_BYTES[flag] || 0;
        flags[nome] = bytes === 2 ? dat.readUInt16LE(p) : bytes === 4 ? [dat.readUInt16LE(p), dat.readUInt16LE(p + 2)] : true;
        p += bytes;
      }
      if (tipo !== 'outfit') {
        things[tipo].set(primeiro + n, { flags, ...lerGrupo() });
        continue;
      }
      const grupos = [];
      for (let g = dat[p++]; g > 0; g--) {
        p++;
        grupos.push(lerGrupo());
      }
      things[tipo].set(primeiro + n, { flags, ...juntarGrupos(grupos) });
    }
  }

  if (p !== dat.length) throw new Error(`Tibia.dat estendido não foi lido inteiro (leu ${p} de ${dat.length} bytes)`);
  return things;
}

// ================================================================================================================================================================================================================================================
// juntarGrupos
// Criatura com o grupo parada e o andando (do mesmo tamanho): um grupo só com
// o 1º quadro parado seguido dos quadros andando. Senão, o grupo que tiver
// mais quadros.

function juntarGrupos(grupos) {
  const [parada, andando] = grupos;
  if (!andando) return parada;
  const mesmoTamanho = ['w', 'h', 'layers', 'px', 'py', 'pz'].every(chave => parada[chave] === andando[chave]);
  if (!mesmoTamanho) return parada.anim >= andando.anim ? parada : andando;
  const porQuadro = parada.w * parada.h * parada.layers * parada.px * parada.py * parada.pz;
  return { ...andando, anim: andando.anim + 1, duracoes: [], sprites: [...parada.sprites.slice(0, porQuadro), ...andando.sprites] };
}

// ================================================================================================================================================================================================================================================
// totalDeVariacoes
// Variações do item no gerador: as do Tibia e, se ele tem mais de uma camada
// (e não é de pilha), as mesmas de novo com as camadas empilhadas.

function totalDeVariacoes(thing) {
  const base = thing.px * thing.py * thing.pz;
  return thing.layers > 1 && !temFlag(thing, FLAG.STACKABLE) ? base * 2 : base;
}

// ================================================================================================================================================================================================================================================
// temFlag

function temFlag(thing, ...flags) {
  return flags.some(flag => flag in thing.flags);
}

// ================================================================================================================================================================================================================================================
// categoriaDoItem
// ground: chão; border: borda de chão; wall: parede/construção (fica embaixo
// dos outros itens); door: porta; item: dá pra pegar; object: o resto
// (móveis, natureza…).

function categoriaDoItem(thing) {
  if (temFlag(thing, FLAG.GROUND)) return 'ground';
  if (temFlag(thing, FLAG.GROUND_BORDER)) return 'border';
  if (temFlag(thing, FLAG.ON_BOTTOM)) return 'wall';
  if (DOOR_LENS.includes(thing.flags[FLAG.LENS_HELP])) return 'door';
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
// mascaraDeParede
// Onde o desenho tem pixel, num quadro de 64 × 64 ancorado embaixo à direita.

function mascaraDeParede(quadro) {
  const mascara = new Uint8Array(WALL_SIZE * WALL_SIZE);
  for (let y = 0; y < quadro.altura; y++) {
    for (let x = 0; x < quadro.largura; x++) {
      const mx = WALL_SIZE - quadro.largura + x;
      const my = WALL_SIZE - quadro.altura + y;
      if (mx >= 0 && my >= 0 && quadro.pixels[(y * quadro.largura + x) * 4 + 3]) mascara[my * WALL_SIZE + mx] = 1;
    }
  }
  return mascara;
}

// ================================================================================================================================================================================================================================================
// coincidencia
// Quanto duas máscaras se sobrepõem (0 a 1: pixels em comum ÷ pixels no total).

function coincidencia(a, b) {
  let comum = 0;
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    comum += a[i] & b[i];
    total += a[i] | b[i];
  }
  return total ? comum / total : 0;
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
// Copia o quadro pra dentro da folha na posição (x, y), misturando os pixels
// meio transparentes com o que já está embaixo; o que cair fora da folha fica
// de fora.

function colar(folha, larguraFolha, quadro, x, y) {
  const alturaFolha = folha.length / 4 / larguraFolha;
  for (let linha = 0; linha < quadro.altura; linha++) {
    for (let coluna = 0; coluna < quadro.largura; coluna++) {
      const origem = (linha * quadro.largura + coluna) * 4;
      if (!quadro.pixels[origem + 3]) continue;
      const fx = x + coluna;
      const fy = y + linha;
      if (fx < 0 || fy < 0 || fx >= larguraFolha || fy >= alturaFolha) continue;
      const destino = (fy * larguraFolha + fx) * 4;
      const alfa = quadro.pixels[origem + 3] / 255;
      const alfaEmbaixo = folha[destino + 3] / 255 * (1 - alfa);
      const alfaFinal = alfa + alfaEmbaixo;
      for (let c = 0; c < 3; c++) folha[destino + c] = Math.round((quadro.pixels[origem + c] * alfa + folha[destino + c] * alfaEmbaixo) / alfaFinal);
      folha[destino + 3] = Math.round(alfaFinal * 255);
    }
  }
}

// ================================================================================================================================================================================================================================================
// paletaDeRoupa
// As 133 cores da roupa ('#rrggbb'), na ordem do Tibia (19 tons × 7 níveis).

function paletaDeRoupa() {
  return Array.from({ length: 133 }, (_, i) => '#' + corDaPaleta(i).map(v => v.toString(16).padStart(2, '0')).join(''));
}

// ================================================================================================================================================================================================================================================
// permutacoes
// Todas as ordens de resto, cada uma depois de prefixo (gerador).

function* permutacoes(resto, prefixo) {
  if (!resto.length) {
    yield prefixo;
    return;
  }
  for (let i = 0; i < resto.length; i++) {
    yield* permutacoes([...resto.slice(0, i), ...resto.slice(i + 1)], [...prefixo, resto[i]]);
  }
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

module.exports = { TibiaAssets, DEFAULT_OUTFIT_COLORS, paletaDeRoupa, gerarPng };
