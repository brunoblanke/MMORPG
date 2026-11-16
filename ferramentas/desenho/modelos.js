// ferramentas/desenho/modelos.js

// Sprites desenhadas por código, em vetor (Canvas 2D), na câmera do Tibia: o chão é visto de cima (x pra leste, y pra
// sul) e a altura z "deita" na diagonal, pra cima e pra esquerda (CAMERA px por unidade de altura), então a cabeça de
// quem está em pé fica em cima à esquerda dos pés. Cada modelo é um esqueleto 3D (juntas x, y, z) com poses por fase
// (0 parado, 1 a 8 um passo completo); as partes são cápsulas e bolas com contorno, pintadas das mais ao fundo pras
// mais à frente. Roda no navegador (ferramentas/desenhar-sprites.js abre a página e grava os PNG).

const CAMERA = 0.74;
const CONTORNO = '#1c1612';
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
// pintar
// Pinta as partes na ordem da câmera (as mais ao norte/oeste e mais baixas primeiro). Parte: { a, b, largura, cor }
// (cápsula de a até b; sem b é uma bola de diâmetro largura); luz = false tira o brilho.

function pintar(ctx, origem, partes) {
  const fundo = (parte) => {
    const m = parte.b ? [0, 1, 2].map(i => (parte.a[i] + parte.b[i]) / 2) : parte.a;
    return m[0] + m[1] + m[2] * 0.6 + (parte.frente || 0);
  };
  ctx.lineCap = 'round';
  for (const parte of [...partes].sort((p, q) => fundo(p) - fundo(q))) {
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
// Partes do humano na direção e fase. visual: { pele, cabelo, camisa, calca, sapato, feminino }.

function humano(direcao, fase, visual) {
  const p = eixos(direcao);
  const t = fase ? (fase - 1) / 8 * Math.PI * 2 : 0;
  const s = fase ? Math.sin(t) : 0;
  const sobe = fase ? Math.abs(Math.cos(t)) * 0.9 : 0;
  const partes = [];
  const perna = (lado, fase01) => {
    const ergue = Math.max(0, fase01) * 2.2;
    const quadril = p(0, lado * 2.3, 11.5 + sobe);
    const pe = p(fase01 * 4.6, lado * 2.3, 1.2 + ergue);
    const joelho = p(fase01 * 2.6 + 1.1, lado * 2.3, 6.4 + ergue * 0.6 + sobe);
    const cor = visual.feminino ? visual.pele : visual.calca;
    partes.push({ a: quadril, b: joelho, largura: 3.6, cor }, { a: joelho, b: pe, largura: 3.1, cor });
    partes.push({ a: pe, b: p(fase01 * 4.6 + 1.6, lado * 2.3, 0.9 + ergue), largura: 3.3, cor: visual.sapato, luz: false });
  };
  perna(-1, s);
  perna(1, -s);
  const braco = (lado, fase01) => {
    const ombro = p(0, lado * 4.6, 20.4 + sobe);
    const cotovelo = p(fase01 * 1.6 - 0.6, lado * 5.4, 15.6 + sobe);
    const mao = p(fase01 * 4 + 0.8, lado * 5.2, 11.4 + sobe + Math.max(0, fase01) * 1.2);
    partes.push({ a: ombro, b: cotovelo, largura: 3.1, cor: visual.camisa }, { a: cotovelo, b: mao, largura: 2.7, cor: visual.camisa });
    partes.push({ a: mao, largura: 2.7, cor: visual.pele, luz: false });
  };
  braco(-1, -s);
  braco(1, s);
  partes.push({ a: p(0, 0, 12.5 + sobe), b: p(0, 0, 20 + sobe), largura: 8.4, cor: visual.camisa });
  if (visual.feminino) partes.push({ a: p(0, 0, 8.6 + sobe), b: p(0, 0, 12.4 + sobe), largura: 9.4, cor: visual.calca });
  else partes.push({ a: p(0, -2.2, 11.6 + sobe), b: p(0, 2.2, 11.6 + sobe), largura: 4.4, cor: visual.calca });
  const cabeca = p(0.5, 0, 26.2 + sobe);
  partes.push({ a: cabeca, largura: 9.2, cor: visual.pele });
  partes.push({ a: p(-1.5, 0, 27.6 + sobe), largura: 9.4, cor: visual.cabelo });
  if (visual.feminino) partes.push({ a: p(-3.2, 0, 26 + sobe), b: p(-3.6, 0, 19.5 + sobe), largura: 6.4, cor: visual.cabelo });
  for (const lado of [-1, 1]) partes.push({ a: p(4.4, lado * 1.7, 26 + sobe), largura: 1.3, cor: '#1c1a22', contorno: false, luz: false, frente: 2 });
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
  const perna = visual.feminino ? visual.pele : visual.calca;
  partes.push({ a: [-4.6, 0, 3], b: [3.4, 0, 3], largura: 8.2, cor: podre(visual.camisa) });
  partes.push({ a: [4, -2.2, 2.2], b: [12.4, -3.2, 1.6], largura: 3.4, cor: podre(perna) }, { a: [4, 2.2, 2.2], b: [12, 3.8, 1.6], largura: 3.4, cor: podre(perna) });
  partes.push({ a: [-3.6, -4.4, 2.4], b: [-7.4, -8.2, 1.6], largura: 2.9, cor: podre(visual.camisa) }, { a: [-3.6, 4.4, 2.4], b: [0.6, 8.6, 1.6], largura: 2.9, cor: podre(visual.camisa) });
  partes.push({ a: [-9.6, 0, 3.4], largura: 9, cor: podre(visual.pele) }, { a: [-11, -0.8, 4.6], largura: 8.8, cor: podre(visual.cabelo) });
  return partes;
}

// ================================================================================================================================================================================================================================================
// folhaDeCriatura
// A folha do jogo: 9 quadros de 64 px por direção (sul, norte, leste, oeste) e a linha do cadáver (fresco,
// apodrecendo, ossos). modelo: humano ou lobo.

function folhaDeCriatura(modelo, visual) {
  const canvas = document.createElement('canvas');
  canvas.width = 64 * 9;
  canvas.height = 64 * 5;
  const ctx = canvas.getContext('2d');
  Object.keys(DIRECOES).forEach((direcao, linha) => {
    for (let fase = 0; fase < 9; fase++) pintar(ctx, [fase * 64 + 52, linha * 64 + 54], modelo(direcao, fase, visual));
  });
  for (let estagio = 0; estagio < 3; estagio++) pintar(ctx, [estagio * 64 + 46, 4 * 64 + 50], caido(modelo === lobo ? 'lobo' : 'humano', estagio, visual));
  return canvas;
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

function caixote() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
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

function barril() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 32;
  const ctx = canvas.getContext('2d');
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

function poste(aceso) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
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
