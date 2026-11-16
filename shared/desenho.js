// shared/desenho.js

// Sprites desenhadas por código pelo próprio navegador, em vetor (Canvas 2D), sem arquivo de imagem, na câmera do Tibia: o chão é visto de cima (x pra leste, y pra
// sul) e a altura z "deita" na diagonal, pra cima e pra esquerda (CAMERA px por unidade de altura), então a cabeça de
// quem está em pé fica em cima à esquerda dos pés. Cada modelo é um esqueleto 3D (juntas x, y, z) com poses por fase
// (0 parado, 1 a 8 um passo completo); as partes são cápsulas e bolas com contorno, pintadas das mais ao fundo pras
// mais à frente. A receita do gerador com "desenho" ({ modelo, visual, argumento }) não tem .png: o jogo e o editor
// chamam desenharFolha ao carregar as folhas (shared/assets.js), no tamanho do jogo e num maior pra tela nítida.

const CAMERA = 0.74;
const CONTORNO = '#1c1612';
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
// Volume moldado: o envoltório das seções, com sombra embaixo à direita, brilho em cima à esquerda e contorno.

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
  if (parte.contorno !== false) {
    caminho();
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = CONTORNO;
    ctx.stroke();
  }
  caminho();
  ctx.fillStyle = misturar(parte.cor, '#000000', 0.26);
  ctx.fill();
  ctx.clip();
  const recuo = Math.min(1.1, tamanho * 0.14);
  caminho(-recuo, -recuo);
  ctx.fillStyle = parte.cor;
  ctx.fill();
  if (parte.luz !== false) {
    const brilho = ctx.createRadialGradient(x0 + (x1 - x0) * 0.3, y0 + (y1 - y0) * 0.28, 0, x0 + (x1 - x0) * 0.3, y0 + (y1 - y0) * 0.28, tamanho * 0.6);
    brilho.addColorStop(0, 'rgba(255, 255, 255, 0.26)');
    brilho.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = brilho;
    ctx.fillRect(x0 - 1, y0 - 1, x1 - x0 + 2, y1 - y0 + 2);
  }
  ctx.restore();
}

// ================================================================================================================================================================================================================================================
// pintar
// Pinta as partes na ordem da câmera (as mais ao norte/oeste e mais baixas primeiro). Parte: volume { secoes, cor }
// (pintarVolume), cápsula { a, b, largura, cor } (sem b é uma bola de diâmetro largura) ou traço fino { a, b, largura,
// cor, contorno: false, luz: false } (olho, boca); frente desempata (mais = por cima); luz = false tira o brilho.

function pintar(ctx, origem, partes) {
  const centro = (parte) => {
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
  for (const parte of [...partes].sort((p, q) => fundo(p) - fundo(q))) {
    if (parte.secoes) {
      pintarVolume(ctx, origem, parte);
      continue;
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
    if (parte.contorno !== false) traco(parte.largura + 1.6, CONTORNO);
    if (parte.luz === false && parte.contorno === false) {
      traco(parte.largura, parte.cor);
      continue;
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
// humano
// Partes do humano (um cidadão comum: camisa, calça, sapato e cabelo simples) na direção e fase, em volumes moldados:
// cada parte é um conjunto de cortes (anéis) ou bolas presos ao esqueleto, e o desenho é o envoltório deles (o tronco
// afina na cintura, a perna no tornozelo, a cabeça tem queixo). visual: { pele, cabelo, camisa, calca, sapato,
// feminino }. deitar: função que leva cada ponto do corpo em pé pro corpo no chão (cadáver).

function humano(direcao, fase, visual, deitar = null) {
  const base = eixos(direcao);
  const P = deitar ? (f, l, z) => deitar(base(f, l, z)) : base;
  const menos = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const anel = (f, l, z, rl, rf) => {
    const c = P(f, l, z);
    return { c, a: menos(P(f, l + rl, z), c), b: menos(P(f + rf, l, z), c) };
  };
  const bola = (ponto, r) => ({ c: ponto, r });
  const t = fase ? (fase - 1) / 8 * Math.PI * 2 : 0;
  const s = fase ? Math.sin(t) : 0;
  const sobe = fase ? Math.abs(Math.cos(t)) * 0.8 : 0;
  const partes = [];
  const pele = visual.pele;
  const pernaCor = visual.feminino ? pele : visual.calca;
  const perna = (lado, passo) => {
    const ergue = Math.max(0, passo) * 2;
    const quadril = P(0, lado * 1.9, 11 + sobe);
    const joelho = P(passo * 2.4 + 0.8, lado * 2, 6.2 + ergue * 0.6 + sobe * 0.5);
    const tornozelo = P(passo * 4.2, lado * 2, 1.5 + ergue);
    partes.push({ secoes: [bola(quadril, 2.05), bola(joelho, 1.55)], cor: pernaCor });
    partes.push({ secoes: [bola(joelho, 1.5), bola(tornozelo, 1.15)], cor: visual.feminino ? pele : visual.calca });
    partes.push({ secoes: [bola(P(passo * 4.2 - 0.5, lado * 2, 0.9 + ergue), 1.15), bola(P(passo * 4.2 + 1.9, lado * 2, 0.75 + ergue), 1)], cor: visual.sapato, luz: false });
  };
  perna(-1, s);
  perna(1, -s);
  partes.push({ secoes: [anel(0, 0, 9.8, 3.3, 2.1), anel(0, 0, 12.4, 3.4, 2.2)], cor: visual.calca, frente: -0.2 });
  if (visual.feminino) partes.push({ secoes: [anel(0, 0, 7.4 + sobe, 4.2, 3), anel(0, 0, 12.6 + sobe, 3.4, 2.3)], cor: visual.calca, frente: 0.1 });
  partes.push({
    secoes: [anel(0, 0, 11.6 + sobe, 3.5, 2.3), anel(0, 0, 13.8 + sobe, 3.2, 2.1), anel(0, 0, 17.6 + sobe, 4, 2.5), anel(0, 0, 20.2 + sobe, 4.4, 2.2), anel(0, 0, 21.3 + sobe, 2, 1.5)],
    cor: visual.camisa,
    frente: 0.2
  });
  partes.push({ secoes: [bola(P(0.2, 0, 21.4 + sobe), 1.15), bola(P(0.3, 0, 23.2 + sobe), 1.15)], cor: pele, frente: 0.1 });
  const braco = (lado, passo) => {
    const ombro = P(0, lado * 4.3, 20 + sobe);
    const cotovelo = P(passo * 1.5 - 0.4, lado * 4.9, 15.4 + sobe);
    const mao = P(passo * 3.6 + 0.6, lado * 4.8, 11.4 + sobe + Math.max(0, passo) * 1.1);
    const manga = P(passo * 0.9 - 0.3, lado * 4.7, 17 + sobe);
    partes.push({ secoes: [bola(ombro, 1.75), bola(manga, 1.55)], cor: visual.camisa });
    partes.push({ secoes: [bola(manga, 1.25), bola(cotovelo, 1.15), bola(mao, 1)], cor: pele });
    partes.push({ secoes: [bola(mao, 1.2)], cor: pele, luz: false, frente: 0.05 });
  };
  braco(-1, -s);
  braco(1, s);
  const z = 24.6 + sobe;
  partes.push({
    secoes: [anel(0.6, 0, z - 0.6, 1.6, 1.4), anel(0.4, 0, z + 1.2, 3, 3.1), anel(0.2, 0, z + 3.2, 3.3, 3.4), anel(0, 0, z + 5, 2.8, 2.9), anel(0, 0, z + 6.1, 1.4, 1.5)],
    cor: pele,
    frente: 0.4
  });
  partes.push({
    secoes: [anel(-0.6, 0, z + 4.3, 3.45, 3), anel(-0.5, 0, z + 5.6, 3, 2.7), anel(-0.4, 0, z + 6.6, 1.7, 1.6), anel(-1.7, 0, z + 2.2, 3.25, 1.8), anel(-1.9, 0, z + 0.9, 2.6, 1.3)],
    cor: visual.cabelo,
    frente: 2
  });
  if (visual.feminino) partes.push({ secoes: [anel(-2, 0, z + 3, 3.4, 2), anel(-2.2, 0, z - 3.4, 3.1, 1.4)], cor: visual.cabelo });
  if (deitar) return partes;
  const olho = (lado) => P(3.05, lado * 1.25, z + 2.4);
  const escuro = misturar(visual.cabelo, '#000000', 0.35);
  for (const lado of [-1, 1]) {
    partes.push({ a: olho(lado), largura: 0.95, cor: '#1c1a22', contorno: false, luz: false, frente: 4 });
    partes.push({ a: P(2.85, lado * 0.7, z + 3.5), b: P(2.85, lado * 1.9, z + 3.6), largura: 0.55, cor: escuro, contorno: false, luz: false, frente: 4 });
    partes.push({ a: P(0.2, lado * 3.15, z + 2.2), largura: 1.3, cor: misturar(pele, '#000000', 0.12), contorno: false, luz: false, frente: 0.3 });
  }
  partes.push({ a: P(3.2, -0.5, z + 0.6), b: P(3.2, 0.5, z + 0.6), largura: 0.5, cor: misturar(pele, '#5a1a1a', 0.5), contorno: false, luz: false, frente: 4 });
  partes.push({ a: P(3.4, 0, z + 1.7), largura: 0.7, cor: misturar(pele, '#000000', 0.18), contorno: false, luz: false, frente: 4 });
  partes.push({ a: P(3.3, -1.7, z - 3.2 + sobe * 0), b: P(3.3, 1.7, z - 3.2), largura: 0.55, cor: misturar(visual.camisa, '#000000', 0.35), contorno: false, luz: false, frente: 3 });
  return partes;
}

// ================================================================================================================================================================================================================================================
// lobo
// Partes do lobo (quadrúpede): as patas alternam em diagonal. visual: { pelo, barriga, olho }.

function lobo(direcao, fase, visual) {
  const p = eixos(direcao);
  const t = fase ? (fase - 1) / 8 * Math.PI * 2 : 0;
  const s = fase ? Math.sin(t) : 0;
  const sobe = fase ? Math.abs(Math.cos(t)) * 0.6 : 0;
  const escuro = misturar(visual.pelo, '#000000', 0.22);
  const partes = [];
  const pata = (frente, lado, fase01) => {
    const ergue = Math.max(0, fase01) * 1.8;
    const cima = p(frente, lado * 2.6, 7.6 + sobe);
    const meio = p(frente + fase01 * 1.6 - 0.8, lado * 2.6, 4 + ergue * 0.6);
    const pe = p(frente + fase01 * 3.4, lado * 2.6, 0.9 + ergue);
    partes.push({ a: cima, b: meio, largura: 3, cor: lado < 0 ? escuro : visual.pelo }, { a: meio, b: pe, largura: 2.4, cor: lado < 0 ? escuro : visual.pelo });
  };
  pata(5.4, -1, s);
  pata(5.4, 1, -s);
  pata(-6.2, -1, -s);
  pata(-6.2, 1, s);
  partes.push({ a: p(-6.4, 0, 9.2 + sobe), b: p(5.6, 0, 9.8 + sobe), largura: 7.6, cor: visual.pelo });
  partes.push({ a: p(-5, 0, 7.2 + sobe), b: p(4, 0, 7.6 + sobe), largura: 5.4, cor: visual.barriga, contorno: false });
  partes.push({ a: p(-7.4, 0, 10.4 + sobe), b: p(-12.6, 0, 12.4 + sobe - s * 1.2), largura: 3, cor: visual.pelo });
  partes.push({ a: p(6.4, 0, 10.6 + sobe), b: p(9.4, 0, 12.4 + sobe), largura: 5.8, cor: visual.pelo });
  partes.push({ a: p(10.4, 0, 12.8 + sobe), largura: 6.8, cor: visual.pelo });
  partes.push({ a: p(12, 0, 11.6 + sobe), b: p(15, 0, 11 + sobe), largura: 3.2, cor: misturar(visual.pelo, '#ffffff', 0.12) });
  partes.push({ a: p(16.2, 0, 11.2 + sobe), largura: 1.6, cor: '#17110f', contorno: false, luz: false, frente: 2 });
  for (const lado of [-1, 1]) {
    partes.push({ a: p(9.4, lado * 2.2, 15 + sobe), b: p(9, lado * 2.6, 17.6 + sobe), largura: 2.2, cor: escuro });
    partes.push({ a: p(12.6, lado * 1.7, 13.2 + sobe), largura: 1.3, cor: visual.olho, contorno: false, luz: false, frente: 2 });
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
  const visualCaido = { ...visual, pele: cor(visual.pele), camisa: cor(visual.camisa), calca: cor(visual.calca), cabelo: cor(visual.cabelo), sapato: cor(visual.sapato) };
  partes.push(...humano('leste', 0, visualCaido, ([x, y, zz]) => [11 - zz * 0.86, y, 2.4 + x * 0.55]));
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
  ctx.scale(nitidez, nitidez);
  Object.keys(DIRECOES).forEach((direcao, linha) => {
    for (let fase = 0; fase < 9; fase++) pintar(ctx, [fase * 64 + 52, linha * 64 + 54], modelo(direcao, fase, visual));
  });
  for (let estagio = 0; estagio < 3; estagio++) pintar(ctx, [estagio * 64 + 46, 4 * 64 + 50], caido(modelo === lobo ? 'lobo' : 'humano', estagio, visual));
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
// Polígono 3D cheio com contorno.

function face(ctx, origem, pontos, cor) {
  ctx.beginPath();
  pontos.map(ponto => projetar(origem, ponto)).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = cor;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 1;
  ctx.strokeStyle = CONTORNO;
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
    ctx.lineWidth = 1;
    ctx.strokeStyle = CONTORNO;
    ctx.stroke();
  };
  for (let z = 0; z <= 15; z += 0.5) circulo(z, CONTORNO, false, raio(z) + 0.9);
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

const CRIATURAS = { humano, lobo };
const OBJETOS = { caixote, barril, poste };

// ================================================================================================================================================================================================================================================
// desenharFolha
// A folha (canvas) do desenho de uma receita, escala vezes maior que o tamanho do jogo; null se o modelo não existe.

export function desenharFolha(desenho, escala = 1) {
  if (!desenho) return null;
  if (CRIATURAS[desenho.modelo]) return folhaDeCriatura(CRIATURAS[desenho.modelo], desenho.visual || {}, escala);
  return OBJETOS[desenho.modelo] ? OBJETOS[desenho.modelo](escala, desenho.argumento) : null;
}
