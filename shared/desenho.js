// shared/desenho.js

// Sprites desenhadas por código pelo próprio navegador, em vetor (Canvas 2D), sem arquivo de imagem, na câmera do Tibia: o chão é visto de cima (x pra leste, y pra
// sul) e a altura z "deita" na diagonal, pra cima e pra esquerda (CAMERA px por unidade de altura), então a cabeça de
// quem está em pé fica em cima à esquerda dos pés. Cada modelo é um esqueleto 3D (juntas x, y, z) com poses por fase
// (0 parado, 1 a 8 um passo completo); as partes são cápsulas e bolas com contorno, pintadas das mais ao fundo pras
// mais à frente. A receita do gerador com "desenho" ({ modelo, visual, argumento }) não tem .png: o jogo e o editor
// chamam desenharFolha ao carregar as folhas (shared/assets.js), no tamanho do jogo e num maior pra tela nítida.

const CAMERA = 0.74;
const NITIDEZ = 4;
const DIRECOES = { sul: [0, 1], norte: [0, -1], leste: [1, 0], oeste: [-1, 0] };

// ================================================================================================================================================================================================================================================
// misturar
// A cor a ('#rrggbb') puxada pra b em fracao (0 a 1).

function misturar(a, b, fracao) {
  const canal = (hex, i) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return '#' + [0, 1, 2].map(i => Math.round(canal(a, i) + (canal(b, i) - canal(a, i)) * fracao).toString(16).padStart(2, '0')).join('');
}

// ================================================================================================================================================================================================================================================
// projetar
// Ponto 3D [x, y, z] → tela [px, py], com o chão do modelo em origem.

function projetar(origem, [x, y, z]) {
  return [origem[0] + x - z * CAMERA, origem[1] + y - z * CAMERA];
}

// ================================================================================================================================================================================================================================================
// envoltorio
// O contorno convexo (sentido horário) de pontos de tela [x, y].

function envoltorio(pontos) {
  const ordem = [...pontos].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const vira = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const meia = (lista) => {
    const casca = [];
    for (const p of lista) {
      while (casca.length >= 2 && vira(casca[casca.length - 2], casca[casca.length - 1], p) <= 0) casca.pop();
      casca.push(p);
    }
    casca.pop();
    return casca;
  };
  return [...meia(ordem), ...meia([...ordem].reverse())];
}

// ================================================================================================================================================================================================================================================
// pontosDoVolume
// Os pontos de tela das seções do volume: bola { c, r } (esfera: círculo na tela) ou anel { c, a, b } (corte do corpo:
// elipse 3D com os semieixos a e b).

function pontosDoVolume(origem, secoes) {
  const pontos = [];
  for (const secao of secoes) {
    const [cx, cy] = projetar(origem, secao.c);
    for (let i = 0; i < 20; i++) {
      const t = i / 20 * Math.PI * 2;
      if (secao.r !== undefined) {
        pontos.push([cx + Math.cos(t) * secao.r, cy + Math.sin(t) * secao.r]);
      } else {
        const p = [0, 1, 2].map(k => secao.c[k] + secao.a[k] * Math.cos(t) + secao.b[k] * Math.sin(t));
        pontos.push(projetar(origem, p));
      }
    }
  }
  return pontos;
}

// ================================================================================================================================================================================================================================================
// pintarVolume
// Volume moldado: o envoltório das seções em cores chapadas, como ilustração vetorial: a cor, a sombra embaixo à
// direita, um reflexo discreto em cima à esquerda e contorno fino; luz = false tira o reflexo.

function pintarVolume(ctx, origem, parte) {
  const casca = envoltorio(pontosDoVolume(origem, parte.secoes));
  if (casca.length < 3) return;
  const caminho = (dx = 0, dy = 0) => {
    ctx.beginPath();
    casca.forEach(([x, y], i) => (i ? ctx.lineTo(x + dx, y + dy) : ctx.moveTo(x + dx, y + dy)));
    ctx.closePath();
  };
  const xs = casca.map(p => p[0]);
  const ys = casca.map(p => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const tamanho = Math.max(x1 - x0, y1 - y0);
  ctx.save();
  ctx.lineJoin = 'round';
  caminho();
  ctx.fillStyle = sombra(parte.cor);
  ctx.fill();
  ctx.clip();
  const recuo = Math.min(1.3, tamanho * 0.15);
  caminho(-recuo, -recuo);
  ctx.fillStyle = parte.cor;
  ctx.fill();
  if (parte.luz !== false) {
    ctx.clip();
    const faixa = Math.min(1.6, tamanho * 0.2);
    caminho(-recuo - faixa, -recuo - faixa);
    ctx.fillStyle = luz(parte.cor);
    ctx.fill();
  }
  ctx.restore();
}

// ================================================================================================================================================================================================================================================
// sombra / luz
// Os tons chapados de sombra e de luz de uma cor (sombra puxada pro marrom avermelhado, luz pro creme).

function sombra(cor) {
  return misturar(cor, '#3b1f1c', 0.3);
}

function luz(cor) {
  return misturar(cor, '#fff4e0', 0.16);
}

// ================================================================================================================================================================================================================================================
// pintar
// Pinta as partes na ordem da câmera (as mais ao norte/oeste e mais baixas primeiro). Parte: grupo { camadas }
// (pintarParte), volume { secoes, cor }
// (pintarVolume), cápsula { a, b, largura, cor } (sem b é uma bola de diâmetro largura) ou traço fino { a, b, largura,
// cor, contorno: false, luz: false } (olho, boca); frente desempata (mais = por cima); luz = false tira o brilho.

function pintar(ctx, origem, partes) {
  const centro = (parte) => {
    if (parte.camadas) return centro(parte.camadas[parte.camadas.length - 1]);
    if (parte.secoes) {
      const cs = parte.secoes.map(s => s.c);
      return [0, 1, 2].map(i => cs.reduce((soma, c) => soma + c[i], 0) / cs.length);
    }
    return parte.b ? [0, 1, 2].map(i => (parte.a[i] + parte.b[i]) / 2) : parte.a;
  };
  const fundo = (parte) => {
    const m = centro(parte);
    return m[0] + m[1] + m[2] * 0.6 + (parte.frente || 0);
  };
  ctx.lineCap = 'round';
  for (const parte of [...partes].sort((p, q) => fundo(p) - fundo(q))) pintarParte(ctx, origem, parte);
}

// ================================================================================================================================================================================================================================================
// pintarParte
// Uma parte (volume, cápsula ou traço); grupo { camadas } pinta as camadas nessa ordem, sem reordenar (cabelo: tufos
// por baixo e a calota por cima).

function pintarParte(ctx, origem, parte) {
  if (parte.camadas) {
    for (const camada of parte.camadas) pintarParte(ctx, origem, camada);
    return;
  }
  {
    if (parte.secoes) {
      pintarVolume(ctx, origem, parte);
      return;
    }
    const a = projetar(origem, parte.a);
    const b = projetar(origem, parte.b || parte.a);
    const traco = (largura, cor, dx = 0, dy = 0) => {
      ctx.strokeStyle = cor;
      ctx.lineWidth = largura;
      ctx.beginPath();
      ctx.moveTo(a[0] + dx, a[1] + dy);
      ctx.lineTo(b[0] + dx + 0.01, b[1] + dy);
      ctx.stroke();
    };
    if (parte.luz === false && parte.contorno === false) {
      traco(parte.largura, parte.cor);
      return;
    }
    traco(parte.largura, misturar(parte.cor, '#000000', 0.22));
    traco(parte.largura * 0.74, parte.cor, -parte.largura * 0.1, -parte.largura * 0.1);
    if (parte.luz !== false && parte.largura >= 3) traco(parte.largura * 0.3, misturar(parte.cor, '#ffffff', 0.3), -parte.largura * 0.22, -parte.largura * 0.22);
  }
}

// ================================================================================================================================================================================================================================================
// eixos
// Pra frente e pra direita de quem olha na direção; soma(p, frente, direita, z) dá o ponto no mundo.

function eixos(direcao) {
  const f = DIRECOES[direcao];
  const r = [-f[1], f[0]];
  return (frente, direita, z) => [f[0] * frente + r[0] * direita, f[1] * frente + r[1] * direita, z];
}

// ================================================================================================================================================================================================================================================
// ESTILOS
// Conjuntos de equipamento que aparecem no corpo (visual.equip: { elmo, peito, pernas, botas, escudo, arma } com o
// nome do estilo). metal = placas, borda = frisos e detalhes, tecido = capa, tabardo e pluma.

const ALTURA_CORPO = 1;
const GROSSURA = 1;

const ESTILOS = {
  crown: { metal: '#c3c9d3', borda: '#d8a838', tecido: '#2c55b4' }
};

// ================================================================================================================================================================================================================================================
// cabelo
// Cabelo de ilustração: calota cobrindo o alto e a nuca, franja de lado (ou repartida no meio no feminino) com umas
// mechas riscadas, costeletas; o feminino desce em mechas onduladas pelos lados do rosto e pelas costas.

function cabelo(P, anel, bola, visual, z, escurecer) {
  const cor = visual.cabelo;
  const escuro = escurecer(cor, 0.22);
  const claro = misturar(cor, '#fff0d8', 0.18);
  const partes = [];
  const camadas = [{ secoes: [bola(P(-0.7, 0, z + 3.3), 3.95), bola(P(-1.9, 0, z + 1.1), 3.35), bola(P(-1.2, 0, z + 4.6), 3.1)], cor }];
  if (visual.feminino) {
    for (const lado of [-1, 1]) camadas.push({ secoes: [bola(P(1.5, lado * 1.5, z + 4.9), 1.7), bola(P(2.3, lado * 2.8, z + 3.3), 1.05), bola(P(0, lado * 0.4, z + 5.9), 1.3)], cor: claro });
  } else {
    camadas.push({ secoes: [bola(P(1.3, -1.2, z + 5), 2.05), bola(P(2.4, 1.3, z + 4.2), 1.25), bola(P(-0.2, -0.6, z + 6), 1.8)], cor: claro });
  }
  for (const [a, b] of [[[-1.6, -1.5, z + 6.6], [1.4, -0.3, z + 5.8]], [[-1.2, 0.9, z + 6.7], [1.6, 1.6, z + 5.2]], [[-2.4, -0.2, z + 6.2], [0.4, 0.8, z + 6.4]]]) {
    camadas.push({ a: P(...a), b: P(...b), largura: 0.35, cor: escuro, contorno: false, luz: false });
  }
  partes.push({ camadas, frente: 2 });
  for (const lado of [-1, 1]) {
    partes.push({ secoes: [bola(P(0.9, lado * 3.6, z + 3.2), 0.85), bola(P(1.4, lado * 3.75, z + 1), 0.6)], cor, luz: false, frente: 0.6 });
  }
  if (!visual.feminino) return partes;
  partes.push({ secoes: [bola(P(-2.2, 0, z + 2), 3.7), anel(-2.5, 0, z - 4, 3.9, 1.8), anel(-2.6, 0, z - 8.6, 3.3, 1.5)], cor, frente: -0.4 });
  for (const lado of [-1, 0, 1]) partes.push({ secoes: [bola(P(-2.6, lado * 2, z - 9.2), 1.5), bola(P(-2.4, lado * 2.3, z - 10.6), 0.9)], cor: escurecer(cor, 0.08), frente: -0.3 });
  for (const lado of [-1, 1]) {
    partes.push({ secoes: [bola(P(0.4, lado * 3.4, z + 2.8), 1.7), bola(P(0.2, lado * 3.9, z - 1.8), 1.6), bola(P(0.6, lado * 3.6, z - 5.6), 1.25), bola(P(0.9, lado * 3.9, z - 7.4), 0.8)], cor, frente: 0.3 });
  }
  return partes;
}

// ================================================================================================================================================================================================================================================
// vestido
// Saia comprida até o chão com a barra de outra cor (visual.barra) e o painel da frente (visual.painel), como nos
// vestidos de corte.

function vestido(partes, P, anel, bola, visual, sobe) {
  if (visual.barra) partes.push({ secoes: [anel(0, 0, 0.6 + sobe * 0.3, 6.3, 5.1), anel(0, 0, 2.8 + sobe * 0.3, 5.9, 4.7)], cor: visual.barra, luz: false, frente: -6 });
  if (visual.painel) partes.push({ secoes: [bola(P(2.1, 0, 14 + sobe), 1), anel(2.9, 0, 2.6 + sobe * 0.3, 2.6, 1.9)], cor: visual.painel, frente: 2 });
}

// ================================================================================================================================================================================================================================================
// humano
// Partes do humano na direção e fase, na proporção do Tibia, em volumes moldados presos ao esqueleto: o corpo e,
// por cima, a roupa (camisa de manga comprida com gola e punho, calça, botas com dobra, cinto) e o equipamento do
// visual.equip (ESTILOS), peça por peça: o que o player vestir aparece no desenho. visual: { pele, cabelo, camisa,
// calca, sapato, cinto, fivela, feminino, equip }. deitar: função que leva cada ponto do corpo em pé pro corpo no chão
// (cadáver).

function humano(direcao, fase, visual, deitar = null) {
  const base = eixos(direcao);
  const P = deitar ? (f, l, z) => deitar(base(f, l, z * ALTURA_CORPO)) : (f, l, z) => base(f, l, z * ALTURA_CORPO);
  const menos = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const anel = (f, l, z, rl, rf) => {
    const c = P(f, l, z);
    return { c, a: menos(P(f, l + rl, z), c), b: menos(P(f + rf, l, z), c) };
  };
  const bola = (ponto, r) => ({ c: ponto, r: r * GROSSURA });
  const t = fase ? (fase - 1) / 8 * Math.PI * 2 : 0;
  const s = fase ? Math.sin(t) : 0;
  const sobe = fase ? Math.abs(Math.cos(t)) * 0.8 : 0;
  const equip = visual.equip || {};
  const estilo = (peca) => ESTILOS[equip[peca]] || null;
  const partes = [];
  const pele = visual.pele;
  const escurecer = (cor, f = 0.28) => misturar(cor, '#000000', f);
  const perna = (lado, passo) => {
    const ergue = Math.max(0, passo) * 2;
    const quadril = P(0, lado * 2, 13 + sobe);
    const joelho = P(passo * 2.4 + 0.7, lado * 2.1, 7.2 + ergue * 0.6 + sobe * 0.5);
    const tornozelo = P(passo * 4.2, lado * 2.1, 1.7 + ergue);
    const cano = P(passo * 3.4 + 0.2, lado * 2.1, 4.6 + ergue * 0.8);
    const roupa = visual.feminino ? pele : visual.calca;
    const larga = visual.calcaLarga ? 1.22 : 1;
    if (!visual.vestido) {
      partes.push({ secoes: [bola(quadril, 2.3 * larga), bola(joelho, 1.75 * larga)], cor: roupa });
      partes.push({ secoes: [bola(joelho, 1.7 * larga), bola(tornozelo, 1.3 * larga)], cor: roupa });
    }
    if (visual.calcaLarga) partes.push({ secoes: [bola(P(passo * 3.5 + 0.3, lado * 2.1, 6.2 + ergue * 0.8 + sobe * 0.3), 2.15), bola(P(passo * 3.1, lado * 2.1, 7.6 + ergue * 0.7 + sobe * 0.4), 1.9)], cor: roupa, frente: 0.2 });
    const pe = [bola(P(passo * 4.2 - 0.4, lado * 2.1, 1 + ergue), 1.4), bola(P(passo * 4.2 + 2.2, lado * 2.1, 0.8 + ergue), 1.15)];
    const botas = estilo('botas');
    partes.push({ secoes: [bola(cano, 1.75), bola(tornozelo, 1.5), ...pe], cor: botas ? botas.metal : visual.sapato, luz: !!botas, frente: 0.1 });
    if (!botas && !visual.calcaLarga && !visual.vestido) partes.push({ secoes: [anel(passo * 3.4 + 0.2, lado * 2.1, 5.2 + ergue * 0.8, 1.9, 1.9), anel(passo * 3.4 + 0.2, lado * 2.1, 6 + ergue * 0.8, 1.9, 1.9)], cor: escurecer(visual.sapato, -0.1), luz: false, frente: 0.15 });
    const pernas = estilo('pernas');
    if (pernas) {
      partes.push({ secoes: [bola(quadril, 2.55), bola(joelho, 2)], cor: pernas.metal, frente: 0.05 });
      partes.push({ secoes: [bola(joelho, 1.95), bola(cano, 1.7)], cor: pernas.metal, frente: 0.05 });
      partes.push({ secoes: [bola(joelho, 1.5)], cor: pernas.borda, frente: 0.2 });
    }
  };
  perna(-1, s);
  perna(1, -s);
  if (!visual.vestido) partes.push({ secoes: [anel(0, 0, 11.4, 3.4 * (visual.calcaLarga ? 1.1 : 1), 2.2), anel(0, 0, 14.4, 3.5, 2.3)], cor: visual.calca, frente: -0.2 });
  const barra = visual.vestido ? [anel(0, 0, 1.2 + sobe * 0.3, 5.9, 4.7), anel(0, 0, 6.5 + sobe * 0.6, 5, 3.9), anel(0, 0, 11.5 + sobe, 3.8, 2.7)]
    : visual.feminino ? [anel(0, 0, 5.4 + sobe, 4.6, 3.4), anel(0, 0, 9.4 + sobe, 4, 2.8)] : [anel(0, 0, 12.6 + sobe, 3.6, 2.4)];
  const tronco = [...barra, anel(0, 0, 15.2 + sobe, 3.25, 2.15), anel(0, 0, 19.2 + sobe, 4.1, 2.7), anel(0, 0, 21.9 + sobe, 4.7, 2.45), anel(0, 0, 23.1 + sobe, 2.3, 1.75)];
  partes.push({ secoes: tronco, cor: visual.vestido || visual.camisa, frente: 0.2 });
  if (visual.vestido) vestido(partes, P, anel, bola, visual, sobe);
  if (visual.tunica) partes.push({ secoes: [anel(0, 0, 9 + sobe, 4.2, 3.1), anel(0, 0, 12.6 + sobe, 3.75, 2.6), anel(0, 0, 15.2 + sobe, 3.4, 2.3), anel(0, 0, 19.3 + sobe, 4.25, 2.85), anel(0, 0, 22 + sobe, 4.85, 2.6), anel(0, 0, 22.9 + sobe, 2.9, 2)], cor: visual.tunica, frente: 0.5 });
  const golaCor = visual.tunica || visual.vestido || visual.camisa;
  if (visual.golaAberta) {
    partes.push({ secoes: [bola(P(2, 0, 23.2 + sobe), 1), bola(P(2.6, 0, 20.4 + sobe), 0.3)], cor: pele, luz: false, frente: 1.5 });
    for (const z of [21.9, 21]) partes.push({ a: P(2.75, -0.7, z + sobe), b: P(2.75, 0.7, z - 0.3 + sobe), largura: 0.35, cor: escurecer(golaCor, 0.45), contorno: false, luz: false, frente: 1.8 });
  } else partes.push({ secoes: [anel(0.2, 0, 22.7 + sobe, 2.1, 1.7), anel(0.2, 0, 23.5 + sobe, 2.1, 1.7)], cor: escurecer(golaCor), luz: false, frente: 1.4 });
  if (visual.cinto && !estilo('peito')) {
    const folga = visual.tunica ? 0.3 : 0;
    partes.push({ secoes: [anel(0, 0, 13.9 + sobe, 3.55 + folga, 2.4 + folga), anel(0, 0, 14.9 + sobe, 3.45 + folga, 2.35 + folga)], cor: visual.cinto, luz: false, frente: 1.6 });
    if (visual.fivela) partes.push({ secoes: [bola(P(2.4 + folga, 0, 14.4 + sobe), 0.8)], cor: visual.fivela, luz: false, frente: 2.4 });
    if (visual.bolsa) partes.push({ secoes: [bola(P(1.3, 3.5, 13.4 + sobe), 1.3), bola(P(1.4, 3.6, 11.8 + sobe), 1.15)], cor: visual.bolsa, frente: 1.9 });
  }
  const peito = estilo('peito');
  if (peito) {
    partes.push({ secoes: [anel(0, 0, 12.8 + sobe, 3.9, 2.7), anel(0, 0, 15.4 + sobe, 3.6, 2.5), anel(0, 0, 19.4 + sobe, 4.5, 3.05), anel(0, 0, 22 + sobe, 4.9, 2.75), anel(0, 0, 23 + sobe, 2.8, 2.1)], cor: peito.metal, frente: 0.6 });
    partes.push({ secoes: [anel(0, 0, 14.6 + sobe, 3.75, 2.62), anel(0, 0, 15.5 + sobe, 3.7, 2.58)], cor: peito.borda, luz: false, frente: 1.7 });
    partes.push({ a: P(3, 0, 21 + sobe), b: P(3.4, 0, 9.4 + sobe), largura: 3.4, cor: peito.tecido, frente: 1.9 });
    partes.push({ a: P(3.55, 0, 19.6 + sobe), b: P(3.6, 0, 16.4 + sobe), largura: 0.8, cor: peito.borda, contorno: false, luz: false, frente: 2.2 });
    partes.push({ a: P(3.55, -1.1, 18.4 + sobe), b: P(3.55, 1.1, 18.4 + sobe), largura: 0.8, cor: peito.borda, contorno: false, luz: false, frente: 2.2 });
  }
  partes.push({ secoes: [bola(P(0.2, 0, 23 + sobe), 1.3), bola(P(0.3, 0, 24.8 + sobe), 1.3)], cor: pele, frente: 0.1 });
  const braco = (lado, passo) => {
    const ombro = P(0, lado * 4.5, 21.7 + sobe);
    const cotovelo = P(passo * 1.5 - 0.4, lado * 5, 16.8 + sobe);
    const pulso = P(passo * 3.4 + 0.5, lado * 4.9, 12.8 + sobe + Math.max(0, passo) * 1.1);
    const mao = P(passo * 3.6 + 0.7, lado * 4.9, 11.6 + sobe + Math.max(0, passo) * 1.1);
    const manga = visual.manga || visual.camisa;
    if (visual.bufante) partes.push({ secoes: [bola(ombro, 2.5), bola(P(passo * 0.8 - 0.2, lado * 4.9, 19.4 + sobe), 2.2)], cor: manga, frente: 0.05 });
    else partes.push({ secoes: [bola(ombro, 1.9), bola(cotovelo, 1.5)], cor: manga });
    partes.push({ secoes: [bola(cotovelo, 1.45), bola(pulso, 1.2)], cor: visual.mangaCurta ? pele : visual.vestido || manga });
    if (visual.mangaCurta) partes.push({ secoes: [bola(cotovelo, 1.75)], cor: manga, frente: 0.08 });
    else partes.push({ secoes: [bola(pulso, 1.3)], cor: escurecer(visual.vestido || manga), luz: false, frente: 0.04 });
    partes.push({ secoes: [bola(mao, 1.35)], cor: pele, luz: false, frente: 0.06 });
    if (peito) {
      partes.push({ secoes: [bola(P(0, lado * 4.8, 22.4 + sobe), 2.7), bola(P(-0.3, lado * 5.6, 21 + sobe), 2.2)], cor: peito.metal, frente: 0.9 });
      partes.push({ secoes: [bola(P(0.1, lado * 5.9, 20.4 + sobe), 1.2)], cor: peito.borda, luz: false, frente: 1 });
      partes.push({ secoes: [bola(cotovelo, 1.75), bola(pulso, 1.5)], cor: peito.metal, frente: 0.1 });
    }
    const escudo = lado < 0 && estilo('escudo');
    if (escudo) {
      const c = P(passo * 2 + 1.2, lado * 6.6, 15.6 + sobe);
      const frente = menos(P(passo * 2 + 4.4, lado * 6.6, 15.6 + sobe), c);
      const cima = [0, 0, 5.4];
      const encolhe = (v, k) => v.map(n => n * k);
      partes.push({
        camadas: [
          { secoes: [{ c, a: frente, b: cima }, { c: P(passo * 2 + 1.2, lado * 6.6, 9.6 + sobe), r: 0.6 }], cor: escudo.borda, luz: false },
          { secoes: [{ c: P(passo * 2 + 1.2, lado * 6.75, 15.8 + sobe), a: encolhe(frente, 0.84), b: encolhe(cima, 0.86) }, { c: P(passo * 2 + 1.2, lado * 6.75, 10.6 + sobe), r: 0.3 }], cor: escudo.tecido },
          { a: P(passo * 2 + 1.2, lado * 6.9, 19.4 + sobe), b: P(passo * 2 + 1.2, lado * 6.9, 11.6 + sobe), largura: 0.9, cor: escudo.borda, contorno: false, luz: false },
          { a: P(passo * 2 - 1.2, lado * 6.9, 16.6 + sobe), b: P(passo * 2 + 3.6, lado * 6.9, 16.6 + sobe), largura: 0.9, cor: escudo.borda, contorno: false, luz: false }
        ],
        frente: 0.3
      });
    }
    const arma = lado > 0 && estilo('arma');
    if (arma) {
      const ponta = P(passo * 3.6 + 4.6, lado * 5.1, 2.4 + sobe);
      partes.push({ camadas: [
        { a: mao, b: ponta, largura: 1.3, cor: '#e4e8ee' },
        { a: P(passo * 3.6 + 1.4, lado * 3.6, 11.4 + sobe), b: P(passo * 3.6 + 1.4, lado * 6.2, 11.4 + sobe), largura: 1, cor: arma.borda, luz: false },
        { a: P(passo * 3.6 + 0.1, lado * 4.9, 12.6 + sobe), largura: 1.3, cor: arma.borda, luz: false }
      ], frente: 0.2 });
    }
  };
  braco(-1, -s);
  braco(1, s);
  const z = 26.4 + sobe;
  partes.push({ secoes: [bola(P(0.3, 0, z + 1.6), 3.9), bola(P(1, 0, z - 0.2), 2.85)], cor: pele, frente: 0.4 });
  for (const lado of [-1, 1]) partes.push({ secoes: [bola(P(0.1, lado * 3.9, z + 1.4), 0.95)], cor: pele, frente: 0.5 });
  const elmo = estilo('elmo');
  if (elmo) {
    const pontas = [[1.6, 0], [0.4, -2.4], [0.4, 2.4], [-1.9, -1.6], [-1.9, 1.6]].map(([df, dl]) => ({ secoes: [bola(P(-0.4 + df, dl, z + 5.4), 0.7), bola(P(-0.4 + df, dl, z + 7.1), 0.22)], cor: elmo.borda, luz: false }));
    partes.push({ camadas: [
      { secoes: [bola(P(-2.6, 0, z + 5.6), 1.3), bola(P(-5.6, 0, z + 3), 0.7)], cor: elmo.tecido },
      { secoes: [bola(P(0, 0, z + 2.3), 4.75), bola(P(0.8, 0, z), 3.5)], cor: elmo.metal },
      { secoes: [anel(-0.4, 0, z + 4.9, 3.5, 3.5), anel(-0.4, 0, z + 5.5, 3.2, 3.2)], cor: elmo.borda, luz: false },
      ...pontas
    ], frente: 6 });
    if (!deitar) {
      partes.push({ a: P(4.7, -2.2, z + 1.9), b: P(4.7, 2.2, z + 1.9), largura: 0.95, cor: '#15141a', contorno: false, luz: false, frente: 8 });
      partes.push({ a: P(4.9, 0, z + 1.3), b: P(5, 0, z - 1.6), largura: 0.6, cor: '#15141a', contorno: false, luz: false, frente: 8 });
    }
    return partes;
  }
  partes.push(...cabelo(P, anel, bola, visual, z, escurecer));
  if (deitar) return partes;
  for (const lado of [-1, 1]) {
    partes.push({ a: P(3.6, lado * 1.45, z + 1.6), b: P(3.6, lado * 1.45, z + 2.1), largura: 0.95, cor: '#1c1a22', contorno: false, luz: false, frente: 4 });
    partes.push({ a: P(3.4, lado * 0.9, z + 3.1), b: P(3.35, lado * 2.1, z + 3.2), largura: 0.5, cor: escurecer(visual.cabelo, 0.35), contorno: false, luz: false, frente: 4 });
  }
  partes.push({ a: P(3.95, 0, z + 0.9), largura: 0.7, cor: escurecer(pele, 0.14), contorno: false, luz: false, frente: 4 });
  partes.push({ a: P(3.8, -0.6, z - 0.4), b: P(3.8, 0.6, z - 0.4), largura: 0.45, cor: misturar(pele, '#5a1a1a', 0.5), contorno: false, luz: false, frente: 4 });
  return partes;
}

// ================================================================================================================================================================================================================================================
// lobo
// Partes do lobo (quadrúpede) em volumes: corpo, peito claro, cabeça com focinho, orelhas, rabo peludo; as patas
// alternam em diagonal. visual: { pelo, barriga, olho }.

const TAMANHO_LOBO = 1.2;

function lobo(direcao, fase, visual) {
  const base = eixos(direcao);
  const p = (f, l, z) => base(f * TAMANHO_LOBO, l * TAMANHO_LOBO, z * TAMANHO_LOBO);
  const bola = (ponto, r) => ({ c: ponto, r: r * TAMANHO_LOBO });
  const t = fase ? (fase - 1) / 8 * Math.PI * 2 : 0;
  const s = fase ? Math.sin(t) : 0;
  const sobe = fase ? Math.abs(Math.cos(t)) * 0.6 : 0;
  const escuro = misturar(visual.pelo, '#000000', 0.18);
  const claro = visual.barriga;
  const partes = [];
  const pata = (frente, lado, passo) => {
    const ergue = Math.max(0, passo) * 1.8;
    const cima = p(frente, lado * 2.5, 8.6 + sobe);
    const meio = p(frente + passo * 1.6 - 0.6, lado * 2.6, 4.2 + ergue * 0.6);
    const pe = p(frente + passo * 3.2, lado * 2.6, 1 + ergue);
    const cor = lado < 0 ? escuro : visual.pelo;
    partes.push({ secoes: [bola(cima, 2.1), bola(meio, 1.3)], cor });
    partes.push({ secoes: [bola(meio, 1.25), bola(pe, 0.95), bola(p(frente + passo * 3.2 + 1, lado * 2.6, 0.9 + ergue), 1.1)], cor, frente: 0.1 });
  };
  pata(5.2, -1, s);
  pata(5.2, 1, -s);
  pata(-5.6, -1, -s);
  pata(-5.6, 1, s);
  partes.push({ secoes: [bola(p(-7.6, 0, 10.6 + sobe), 1.5), bola(p(-10.4, 0, 9.6 + sobe - s), 2.1), bola(p(-13, 0, 7.6 + sobe - s * 1.4), 1.3)], cor: visual.pelo, frente: -0.4 });
  partes.push({ secoes: [bola(p(-5.4, 0, 10 + sobe), 3.5), bola(p(-0.5, 0, 10.2 + sobe), 3.8), bola(p(4.4, 0, 10.8 + sobe), 4.3)], cor: visual.pelo });
  partes.push({ secoes: [bola(p(5, 0, 8.6 + sobe), 3), bola(p(7.6, 0, 11.6 + sobe), 2.4), bola(p(1, 0, 8 + sobe), 2.2)], cor: claro, frente: 0.6 });
  partes.push({ secoes: [bola(p(8.6, 0, 14.8 + sobe), 3.2), bola(p(7, 0, 12.6 + sobe), 2.9)], cor: visual.pelo, frente: 1 });
  partes.push({ secoes: [bola(p(10.6, 0, 13.8 + sobe), 2), bola(p(13.6, 0, 12.9 + sobe), 1.2)], cor: claro, frente: 1.2 });
  partes.push({ secoes: [bola(p(14.3, 0, 13.2 + sobe), 0.75)], cor: '#1b1513', luz: false, frente: 2 });
  for (const lado of [-1, 1]) {
    partes.push({ secoes: [bola(p(7.4, lado * 1.9, 17.2 + sobe), 1.15), bola(p(7, lado * 2.2, 20 + sobe), 0.3)], cor: escuro, frente: 1.1 });
    partes.push({ a: p(11.1, lado * 1.5, 15.2 + sobe), b: p(11.3, lado * 1.4, 15 + sobe), largura: 1, cor: visual.olho, contorno: false, luz: false, frente: 2 });
  }
  return partes;
}

// ================================================================================================================================================================================================================================================
// caido
// Corpo no chão (cadáver): estagio 0 fresco, 1 apodrecendo (cores puxadas pro verde escuro), 2 só os ossos.
// forma: 'humano' ou 'lobo'.

function caido(forma, estagio, visual) {
  const podre = (cor) => estagio === 1 ? misturar(cor, '#3f4a2a', 0.6) : cor;
  const osso = '#e6ddc4';
  const partes = [];
  if (estagio === 2) {
    partes.push({ a: [-6, 0, 1.2], b: [5, 0, 1.2], largura: 1.8, cor: osso, luz: false });
    for (const x of [-4, -1.5, 1, 3.5]) partes.push({ a: [x, -3, 1.4], b: [x, 3, 1.4], largura: 1.3, cor: osso, luz: false });
    partes.push({ a: [5, 0, 1.2], b: [11, -2.6, 1], largura: 1.6, cor: osso, luz: false }, { a: [5, 0, 1.2], b: [11, 2.6, 1], largura: 1.6, cor: osso, luz: false });
    partes.push({ a: [forma === 'lobo' ? -10.5 : -9.5, 0, 2], largura: forma === 'lobo' ? 5 : 6, cor: osso });
    return partes;
  }
  if (forma === 'lobo') {
    partes.push({ a: [-5, 0, 3.4], b: [6, 0, 3.4], largura: 7.4, cor: podre(visual.pelo) });
    partes.push({ a: [-9.6, -0.6, 3.4], largura: 6.6, cor: podre(visual.pelo) }, { a: [-12, -0.8, 2.6], b: [-14.4, -1, 2.4], largura: 3, cor: podre(visual.pelo) });
    partes.push({ a: [7, 0, 3], b: [12.5, -1.6, 2], largura: 2.8, cor: podre(visual.pelo) });
    for (const x of [-4.6, -1.8, 3, 5.6]) partes.push({ a: [x, 2.4, 2.4], b: [x + 1.4, 7.4, 1.4], largura: 2.5, cor: podre(misturar(visual.pelo, '#000000', 0.2)) });
    return partes;
  }
  const cor = (hex) => podre(hex);
  const visualCaido = { ...visual, pele: cor(visual.pele), camisa: cor(visual.camisa), calca: cor(visual.calca), cabelo: cor(visual.cabelo), sapato: cor(visual.sapato), cinto: visual.cinto && cor(visual.cinto), fivela: visual.fivela && cor(visual.fivela), equip: {} };
  partes.push(...humano('leste', 0, visualCaido, ([x, y, zz]) => [12 - zz * 0.8, y, 2.4 + x * 0.55]));
  return partes;
}

// ================================================================================================================================================================================================================================================
// folhaDeCriatura
// A folha do jogo: 9 quadros de 64 px por direção (sul, norte, leste, oeste) e a linha do cadáver (fresco,
// apodrecendo, ossos), escala vezes maior. modelo: humano ou lobo. Desenha pelo menos NITIDEZ vezes maior e reduz
// (traço mais limpo).

function folhaDeCriatura(modelo, visual, escala = 1) {
  const nitidez = Math.max(NITIDEZ, escala);
  const grande = document.createElement('canvas');
  grande.width = 64 * 9 * nitidez;
  grande.height = 64 * 5 * nitidez;
  const ctx = grande.getContext('2d');
  const quadro = (x, y, partes, origem) => {
    const tela = document.createElement('canvas');
    tela.width = tela.height = 64 * nitidez;
    const tctx = tela.getContext('2d');
    tctx.scale(nitidez, nitidez);
    pintar(tctx, origem, partes);
    ctx.drawImage(tela, x * nitidez, y * nitidez);
  };
  Object.keys(DIRECOES).forEach((direcao, linha) => {
    for (let fase = 0; fase < 9; fase++) quadro(fase * 64, linha * 64, modelo(direcao, fase, visual), [52, 54]);
  });
  for (let estagio = 0; estagio < 3; estagio++) quadro(estagio * 64, 4 * 64, caido(modelo === lobo ? 'lobo' : 'humano', estagio, visual), [46, 50]);
  if (nitidez === escala) return grande;
  const canvas = document.createElement('canvas');
  canvas.width = 64 * 9 * escala;
  canvas.height = 64 * 5 * escala;
  const saida = canvas.getContext('2d');
  saida.imageSmoothingQuality = 'high';
  saida.drawImage(grande, 0, 0, canvas.width, canvas.height);
  return canvas;
}

// ================================================================================================================================================================================================================================================
// telaDe
// Canvas quadrado de lado × escala px, já na escala: [canvas, ctx].

function telaDe(lado, escala) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = lado * escala;
  const ctx = canvas.getContext('2d');
  ctx.scale(escala, escala);
  return [canvas, ctx];
}

// ================================================================================================================================================================================================================================================
// face
// Polígono 3D cheio; o traço (cor e largura opcionais) por padrão é da cor dele, só pra fechar as emendas.

function face(ctx, origem, pontos, cor, contorno = cor, largura = 0.5) {
  ctx.beginPath();
  pontos.map(ponto => projetar(origem, ponto)).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = cor;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = largura;
  ctx.strokeStyle = contorno;
  ctx.stroke();
}

// ================================================================================================================================================================================================================================================
// caixa
// Caixa 3D de (x0, y0) a (x1, y1) no chão, da altura z0 até z1: o topo claro, a frente (sul) na cor e o lado leste
// escuro, que são as faces que a câmera do Tibia mostra.

function caixa(ctx, origem, [x0, y0, x1, y1], z0, z1, cor) {
  face(ctx, origem, [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], misturar(cor, '#000000', 0.34));
  face(ctx, origem, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], cor);
  face(ctx, origem, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], misturar(cor, '#ffffff', 0.26));
}

// ================================================================================================================================================================================================================================================
// risco
// Linha 3D fina (tábua, aro, detalhe).

function risco(ctx, origem, a, b, cor, largura = 1) {
  const [ax, ay] = projetar(origem, a);
  const [bx, by] = projetar(origem, b);
  ctx.strokeStyle = cor;
  ctx.lineWidth = largura;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.stroke();
}

// ================================================================================================================================================================================================================================================
// caixote
// Caixa de madeira (32 px) com tábuas e travessa em X na frente.

function caixote(escala = 1) {
  const [canvas, ctx] = telaDe(32, escala);
  const origem = [20, 20];
  const madeira = '#b27e46';
  const veio = misturar(madeira, '#000000', 0.4);
  caixa(ctx, origem, [-9, -9, 9, 9], 0, 13, madeira);
  for (const z of [4.4, 8.8]) risco(ctx, origem, [-9, 9, z], [9, 9, z], veio, 0.8);
  risco(ctx, origem, [-8, 9, 1], [8, 9, 12], veio, 1.4);
  risco(ctx, origem, [8, 9, 1], [-8, 9, 12], veio, 1.4);
  for (const y of [-3, 3]) risco(ctx, origem, [-9, y, 13], [9, y, 13], veio, 0.8);
  risco(ctx, origem, [9, -9, 6.5], [9, 9, 6.5], misturar(veio, '#000000', 0.3), 0.8);
  return canvas;
}

// ================================================================================================================================================================================================================================================
// barril
// Barril (32 px): no chão visto de cima o círculo continua círculo; o corpo liga o círculo de baixo ao de cima.

function barril(escala = 1) {
  const [canvas, ctx] = telaDe(32, escala);
  const origem = [20, 20];
  const madeira = '#9c663a';
  const raio = (z) => 7.4 + Math.sin(z / 15 * Math.PI) * 1.5;
  const circulo = (z, cor, borda = true, r = raio(z)) => {
    const [cx, cy] = projetar(origem, [0, 0, z]);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = cor;
    ctx.fill();
    if (!borda) return;
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = cor;
    ctx.stroke();
  };
    for (let z = 0; z <= 15; z += 0.5) circulo(z, z > 3 && z < 5 || z > 10.5 && z < 12.5 ? '#5c5c66' : misturar(madeira, '#000000', 0.12), false);
  for (let z = 0; z <= 15; z += 0.5) {
    const [cx, cy] = projetar(origem, [0, 0, z]);
    ctx.fillStyle = z > 3 && z < 5 || z > 10.5 && z < 12.5 ? '#8a8a94' : misturar(madeira, '#ffffff', 0.16);
    ctx.fillRect(cx - raio(z) * 0.2, cy + raio(z) * 0.62, raio(z) * 0.42, 0.7);
  }
  circulo(15, misturar(madeira, '#ffffff', 0.3));
  circulo(15, misturar(madeira, '#000000', 0.25), false, 5.2);
  circulo(15, misturar(madeira, '#ffffff', 0.18), false, 4.3);
  return canvas;
}

// ================================================================================================================================================================================================================================================
// poste
// Poste de luz (64 px): base no sqm de baixo à direita, a haste sobe na diagonal da câmera e a lanterna fica no alto.
// aceso = a lanterna com luz (o estado ativo).

function poste(escala = 1, aceso = false) {
  const [canvas, ctx] = telaDe(64, escala);
  const origem = [50, 50];
  const ferro = '#444450';
  caixa(ctx, origem, [-4.5, -4.5, 4.5, 4.5], 0, 2.5, ferro);
  caixa(ctx, origem, [-1.6, -1.6, 1.6, 1.6], 2.5, 36, ferro);
  caixa(ctx, origem, [-4.6, -4.6, 4.6, 4.6], 36, 37.6, ferro);
  if (aceso) {
    const [gx, gy] = projetar(origem, [0, 0, 42]);
    const brilho = ctx.createRadialGradient(gx, gy, 1, gx, gy, 13);
    brilho.addColorStop(0, 'rgba(255, 226, 120, 0.75)');
    brilho.addColorStop(1, 'rgba(255, 226, 120, 0)');
    ctx.fillStyle = brilho;
    ctx.fillRect(gx - 14, gy - 14, 28, 28);
  }
  caixa(ctx, origem, [-3.6, -3.6, 3.6, 3.6], 37.6, 46, aceso ? '#ffd45a' : '#7c8c94');
  caixa(ctx, origem, [-4.8, -4.8, 4.8, 4.8], 46, 47.6, ferro);
  caixa(ctx, origem, [-2.2, -2.2, 2.2, 2.2], 47.6, 50, ferro);
  return canvas;
}

// ================================================================================================================================================================================================================================================
// sorteio
// Números de 0 a 1 sempre iguais pra mesma semente (a mesma árvore sai sempre igual).

function sorteio(semente) {
  let estado = semente >>> 0;
  return () => {
    estado = (estado * 1664525 + 1013904223) >>> 0;
    return estado / 4294967296;
  };
}

// ================================================================================================================================================================================================================================================
// folhagem
// Copa de folhas: tufos (bolas com contorno) ao redor do centro, do fundo pra frente, verde mais escuro embaixo à
// direita e mais claro em cima à esquerda.

function folhagem(ctx, origem, centro, raio, altura, cores, quantos, semente) {
  const aleatorio = sorteio(semente);
  const tufos = [];
  for (let i = 0; i < quantos; i++) {
    const angulo = aleatorio() * Math.PI * 2;
    const distancia = Math.sqrt(aleatorio()) * raio;
    const z = centro[2] + (aleatorio() - 0.5) * altura;
    tufos.push({ c: [centro[0] + Math.cos(angulo) * distancia, centro[1] + Math.sin(angulo) * distancia, z], r: 2.6 + aleatorio() * 3 });
  }
  tufos.sort((a, b) => (a.c[0] + a.c[1] + a.c[2] * 0.6) - (b.c[0] + b.c[1] + b.c[2] * 0.6));
  for (const tufo of tufos) {
    const luz = (tufo.c[2] - centro[2]) / altura - (tufo.c[0] + tufo.c[1] - centro[0] - centro[1]) / (raio * 3) + 0.5;
    const cor = luz > 0.75 ? cores[2] : luz > 0.35 ? cores[1] : cores[0];
    pintarVolume(ctx, origem, { secoes: [tufo], cor });
  }
}

// ================================================================================================================================================================================================================================================
// arvore
// Árvore (64 px): tronco no meio do sqm e a copa subindo pro sqm de cima à esquerda, em tufos de folhas.

function arvore(escala = 1) {
  const [canvas, ctx] = telaDe(64, escala);
  const origem = [32, 32];
  const casca = '#6e4a2c';
  pintarVolume(ctx, origem, { secoes: [{ c: [13, 17, 0.5], r: 1.6 }, { c: [19, 15, 0.5], r: 1.4 }, { c: [16, 19, 0.5], r: 1.5 }, { c: [16, 16, 1.5], r: 2.7 }, { c: [16, 16, 11], r: 1.9 }], cor: casca });
  pintar(ctx, origem, [{ a: [16, 16, 9], b: [11, 14, 15], largura: 1.9, cor: casca }, { a: [16, 16, 10], b: [21, 18, 15], largura: 1.7, cor: casca }]);
  folhagem(ctx, origem, [14, 14, 22], 14.5, 12, ['#2f6a2a', '#3f8a34', '#62ab45'], 58, 7);
  return canvas;
}

// ================================================================================================================================================================================================================================================
// arbusto
// Arbusto (32 px): tufos baixos no meio do sqm, com umas frutinhas.

function arbusto(escala = 1) {
  const [canvas, ctx] = telaDe(32, escala);
  const origem = [4, 4];
  folhagem(ctx, origem, [14, 14, 5], 6.5, 6, ['#2f6a2a', '#3f8a34', '#62ab45'], 14, 3);
  pintar(ctx, origem, [[11, 18, 7], [17, 13, 8.5], [19, 19, 5.5]].map(c => ({ a: c, largura: 1.6, cor: '#c8342c', luz: false, frente: 30 })));
  return canvas;
}

// ================================================================================================================================================================================================================================================
// capim
// Tufo de capim com flores (32 px): folhas finas que se curvam e umas flores na ponta.

function capim(escala = 1) {
  const [canvas, ctx] = telaDe(32, escala);
  const origem = [4, 4];
  const aleatorio = sorteio(11);
  const folhas = [];
  for (let i = 0; i < 11; i++) {
    const x = 9 + aleatorio() * 10;
    const y = 11 + aleatorio() * 10;
    const curva = (aleatorio() - 0.5) * 4;
    folhas.push({ a: [x, y, 0], b: [x + curva, y + curva * 0.5, 4 + aleatorio() * 4], largura: 1.1, cor: aleatorio() > 0.5 ? '#4e9a3a' : '#3a7e30' });
  }
  pintar(ctx, origem, folhas);
  const flores = ['#f2e15a', '#ffffff', '#e889c8'];
  pintar(ctx, origem, [[10, 13, 7], [16, 12, 8.5], [18, 19, 6.5], [12, 19, 6]].map((c, i) => ({ a: c, largura: 2, cor: flores[i % 3], luz: false, frente: 30 })));
  return canvas;
}

// ================================================================================================================================================================================================================================================
// muro
// Bloco de muro de pedra entre (x0, y0) e (x1, y1) no chão, de z0 a z1: pedras em fileiras desencontradas na frente
// (sul) e no lado leste, topo arredondado mais claro. semente = o sorteio do tom de cada pedra.

function muro(ctx, origem, [x0, y0, x1, y1], z0, z1, cor, semente) {
  const aleatorio = sorteio(semente);
  caixa(ctx, origem, [x0, y0, x1, y1], z0, z1, misturar(cor, '#000000', 0.3));
  const fileira = 7.2;
  const pedras = (comprimento, em) => {
    for (let z = z0; z < z1 - 0.8; z += fileira) {
      const zt = Math.min(z1, z + fileira);
      let u = -aleatorio() * 6;
      while (u < comprimento) {
        const largura = 7 + aleatorio() * 6;
        const a = Math.max(0, u) + 0.5;
        const b = Math.min(comprimento, u + largura) - 0.5;
        u += largura;
        if (b - a < 1.2) continue;
        const tom = misturar(cor, aleatorio() > 0.45 ? '#ffffff' : '#000000', 0.04 + aleatorio() * 0.2);
        const recuo = Math.min(0.9, (b - a) * 0.15);
        face(ctx, origem, [em(a + recuo, z + 0.5), em(b - recuo, z + 0.5), em(b, z + 1.4), em(b, zt - 1.4), em(b - recuo, zt - 0.5), em(a + recuo, zt - 0.5), em(a, zt - 1.4), em(a, z + 1.4)], tom, misturar(cor, '#000000', 0.5), 0.55);
        risco(ctx, origem, em(a + recuo + 0.3, zt - 0.9), em(b - recuo - 0.3, zt - 0.9), misturar(tom, '#ffffff', 0.3), 0.6);
      }
    }
  };
  pedras(x1 - x0, (u, z) => [x0 + u, y1, z]);
  pedras(y1 - y0, (u, z) => [x1, y0 + u, z]);
  face(ctx, origem, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], misturar(cor, '#ffffff', 0.22));
}

// ================================================================================================================================================================================================================================================
// portaDeMadeira
// Folha de porta de tábuas com duas barras de ferro e a maçaneta, de (x0, y0) a (x1, y1), da altura 0 até alto.

function portaDeMadeira(ctx, origem, [x0, y0, x1, y1], alto) {
  const madeira = '#9a6a3c';
  caixa(ctx, origem, [x0, y0, x1, y1], 0, alto, madeira);
  const largoX = x1 - x0 > y1 - y0;
  const ao = (u, z) => (largoX ? [x0 + u, y1, z] : [x1, y0 + u, z]);
  const comprimento = largoX ? x1 - x0 : y1 - y0;
  for (let u = 3.6; u < comprimento - 1; u += 3.6) risco(ctx, origem, ao(u, 0.6), ao(u, alto - 0.6), misturar(madeira, '#000000', 0.38), 0.6);
  for (const z of [alto * 0.24, alto * 0.74]) risco(ctx, origem, ao(0.8, z), ao(comprimento - 0.8, z), '#3e3f46', 1.6);
  const [mx, my] = projetar(origem, ao(comprimento * 0.78, alto * 0.48));
  ctx.fillStyle = '#e0c060';
  ctx.beginPath();
  ctx.arc(mx, my, 0.9, 0, Math.PI * 2);
  ctx.fill();
}

// ================================================================================================================================================================================================================================================
// pecaDeMuro
// Uma peça de parede (64 px) no lugar do Tibia: a parede x fica na borda de baixo do sqm, a y na borda da direita, o
// pilar no canto de baixo à direita; porta e janela abrem no meio da peça.

const MURO_ALTO = 42;
const MURO_FUNDO = 6.5;
const MURO_COR = '#9a978e';

function pecaDeMuro(ctx, origem, peca, semente) {
  const t = MURO_FUNDO;
  const H = MURO_ALTO;
  const bloco = (box, z0, z1, n = 0) => muro(ctx, origem, box, z0, z1, MURO_COR, semente + n);
  const parede = (eixo, z0 = 0, z1 = H, de = 0, ate = 32, n = 0) => bloco(eixo === 'x' ? [de, 32 - t, ate, 32] : [32 - t, de, 32, ate], z0, z1, n);
  const vao = (eixo, tipo) => {
    const portaAlto = 31;
    parede(eixo, 0, H, 0, 6, 1);
    parede(eixo, tipo === 'janela' ? 0 : portaAlto, H, 6, 26, 2);
    if (tipo === 'janela') parede(eixo, 26, H, 6, 26, 3);
    parede(eixo, 0, H, 26, 32, 4);
    if (tipo === 'janela') {
      parede(eixo, 0, 13, 6, 26, 5);
      for (let u = 9.5; u < 26; u += 4) risco(ctx, origem, eixo === 'x' ? [u, 32 - t / 2, 13] : [32 - t / 2, u, 13], eixo === 'x' ? [u, 32 - t / 2, 26] : [32 - t / 2, u, 26], '#3e3f46', 1);
      return;
    }
    if (tipo === 'fechada') portaDeMadeira(ctx, origem, eixo === 'x' ? [6, 32 - t + 1.5, 26, 32 - 1.5] : [32 - t + 1.5, 6, 32 - 1.5, 26], portaAlto);
    else portaDeMadeira(ctx, origem, eixo === 'x' ? [6, 32 - t - 19, 8, 32 - t] : [32 - t - 19, 6, 32 - t, 8], portaAlto);
  };
  if (peca === 'x') parede('x');
  if (peca === 'y') parede('y');
  if (peca === 'xy') {
    parede('y', 0, H, 0, 32 - t);
    parede('x', 0, H, 0, 32, 9);
  }
  if (peca === 'yx') bloco([32 - t, 32 - t, 32, 32], 0, H);
  const vaoDe = /^(porta|janela)-(x|y)(-aberta)?$/.exec(peca);
  if (vaoDe) vao(vaoDe[2], vaoDe[1] === 'janela' ? 'janela' : vaoDe[3] ? 'aberta' : 'fechada');
}

const PECAS_DE_MURO = ['x', 'y', 'xy', 'yx', 'porta-x', 'porta-x-aberta', 'porta-y', 'porta-y-aberta', 'janela-x', 'janela-y'];

// ================================================================================================================================================================================================================================================
// parede
// A folha de parede de pedra (4 peças por linha, na ordem de PECAS_DE_MURO), cada peça cortada no quadro dela.

function parede(escala = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = 64 * 4 * escala;
  canvas.height = 64 * Math.ceil(PECAS_DE_MURO.length / 4) * escala;
  const ctx = canvas.getContext('2d');
  ctx.scale(escala, escala);
  PECAS_DE_MURO.forEach((peca, i) => {
    ctx.save();
    ctx.beginPath();
    ctx.rect((i % 4) * 64, Math.floor(i / 4) * 64, 64, 64);
    ctx.clip();
    pecaDeMuro(ctx, [(i % 4) * 64 + 32, Math.floor(i / 4) * 64 + 32], peca, i * 37 + 5);
    ctx.restore();
  });
  return canvas;
}

const CRIATURAS = { humano, lobo };
const OBJETOS = { caixote, barril, poste, arvore, arbusto, capim, parede };

// ================================================================================================================================================================================================================================================
// desenharFolha
// A folha (canvas) do desenho de uma receita, escala vezes maior que o tamanho do jogo; null se o modelo não existe.

export function desenharFolha(desenho, escala = 1) {
  if (!desenho) return null;
  if (CRIATURAS[desenho.modelo]) return folhaDeCriatura(CRIATURAS[desenho.modelo], desenho.visual || {}, escala);
  return OBJETOS[desenho.modelo] ? OBJETOS[desenho.modelo](escala, desenho.argumento) : null;
}
