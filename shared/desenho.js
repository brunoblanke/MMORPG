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
// direita, um reflexo discreto em cima à esquerda; luz = false tira o reflexo e recuo muda a largura da sombra.

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
  const recuo = parte.recuo ?? Math.min(1.3, tamanho * 0.15);
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
// VISTA / LUZ
// Sólido facetado: anéis (polígonos 3D com o mesmo número de pontos) ligados em faces, mais as duas tampas. VISTA =
// a direção da câmera (face com normal pra ela aparece), LUZ = de onde vem a luz.

const VISTA = [CAMERA, CAMERA, 1];
const LUZ = (() => {
  const l = [-0.55, 0.3, 1];
  const n = Math.hypot(...l);
  return l.map(v => v / n);
})();

// ================================================================================================================================================================================================================================================
// normalDe
// Normal unitária de um polígono 3D (método de Newell).

function normalDe(pontos) {
  let n = [0, 0, 0];
  for (let i = 0; i < pontos.length; i++) {
    const p = pontos[i];
    const q = pontos[(i + 1) % pontos.length];
    n = [n[0] + (p[1] - q[1]) * (p[2] + q[2]), n[1] + (p[2] - q[2]) * (p[0] + q[0]), n[2] + (p[0] - q[0]) * (p[1] + q[1])];
  }
  const tamanho = Math.hypot(...n) || 1;
  return n.map(v => v / tamanho);
}

// ================================================================================================================================================================================================================================================
// facetas
// As faces do sólido de anéis, cada uma com a normal virada pra fora.

function facetas(aneis) {
  const todos = aneis.flat();
  const meio = [0, 1, 2].map(i => todos.reduce((soma, p) => soma + p[i], 0) / todos.length);
  const faces = [aneis[0], aneis[aneis.length - 1]];
  for (let k = 0; k < aneis.length - 1; k++) {
    const n = aneis[k].length;
    for (let i = 0; i < n; i++) faces.push([aneis[k][i], aneis[k][(i + 1) % n], aneis[k + 1][(i + 1) % n], aneis[k + 1][i]]);
  }
  return faces.map(face => {
    let normal = normalDe(face);
    const centro = [0, 1, 2].map(i => face.reduce((soma, p) => soma + p[i], 0) / face.length);
    if (normal.reduce((soma, v, i) => soma + v * (centro[i] - meio[i]), 0) < 0) normal = normal.map(v => -v);
    return { face, normal };
  });
}

// ================================================================================================================================================================================================================================================
// tomDaFace
// A cor chapada de uma face pela direção dela: virada pra luz (em cima à esquerda) clareia, de costas escurece.

function tomDaFace(cor, normal) {
  const luz = normal.reduce((soma, v, i) => soma + v * LUZ[i], 0);
  if (luz > 0.6) return misturar(cor, '#fff4e0', 0.2);
  if (luz > -0.05) return cor;
  return sombra(cor);
}

// ================================================================================================================================================================================================================================================
// pintarSolido
// Pinta só as faces viradas pra câmera, cada uma numa cor chapada (tomDaFace), com um traço da mesma cor pra fechar
// as emendas.

function pintarSolido(ctx, origem, parte) {
  const visiveis = facetas(parte.solido).filter(({ normal }) => normal.reduce((soma, v, i) => soma + v * VISTA[i], 0) > 0.001);
  visiveis.sort((a, b) => a.normal.reduce((s, v, i) => s + v * VISTA[i], 0) - b.normal.reduce((s, v, i) => s + v * VISTA[i], 0));
  ctx.save();
  ctx.lineJoin = 'round';
  for (const { face, normal } of visiveis) {
    const cor = parte.chapado ? parte.cor : tomDaFace(parte.cor, normal);
    ctx.beginPath();
    face.map(p => projetar(origem, p)).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = cor;
    ctx.fill();
    ctx.lineWidth = 0.35;
    ctx.strokeStyle = cor;
    ctx.stroke();
  }
  ctx.restore();
}

// ================================================================================================================================================================================================================================================
// pintarPlaca
// Polígono 3D chapado (fenda do elmo, brasão, metade do escudo): só aparece com o lado parte.fora virado pra câmera.

function pintarPlaca(ctx, origem, parte) {
  if (parte.fora && parte.fora.reduce((soma, v, i) => soma + v * VISTA[i], 0) <= 0.001) return;
  ctx.beginPath();
  parte.placa.map(p => projetar(origem, p)).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.fillStyle = parte.cor;
  ctx.fill();
  ctx.lineWidth = 0.3;
  ctx.strokeStyle = parte.cor;
  ctx.stroke();
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
    if (parte.secoes || parte.solido || parte.placa) {
      const cs = parte.secoes ? parte.secoes.map(s => s.c) : parte.solido ? parte.solido.flat() : parte.placa;
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
    if (parte.solido) {
      pintarSolido(ctx, origem, parte);
      return;
    }
    if (parte.placa) {
      pintarPlaca(ctx, origem, parte);
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
// nome do estilo). metal = placas, borda = frisos e detalhes, tecido = capa, tabardo e pluma (null = sem).

const ALTURA_CORPO = 1;
const GROSSURA = 1;

const ESTILOS = {
  crown: { metal: '#c3c9d3', borda: '#d8a838', tecido: '#2c55b4' },
  prata: { metal: '#c8cdd4', borda: '#9198a2', tecido: null }
};

// ================================================================================================================================================================================================================================================
// roupasDoTronco
// O que vai por cima do tronco do humano, pelo visual: musculoso (peito nu com peitoral e barriga marcados), casaco
// (aberto, até os joelhos), avental (de couro com rebites), medalhao (corrente e medalha) e bandoleira (tira em
// diagonal com fivela).

function roupasDoTronco({ P, anel, bola, visual, sobe, s, escurecer, partes, deitar, pele }) {
  const fora = (() => {
    const a = P(0, 0, 0);
    const b = P(1, 0, 0);
    return [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  })();
  const placa = (pontos, cor, frente) => partes.push({ placa: pontos.map(([f, l, z]) => P(f, l, z + sobe)), cor, fora, frente });
  const traco = (a, b, largura, cor, frente) => partes.push({ a: P(a[0], a[1], a[2] + sobe), b: P(b[0], b[1], b[2] + sobe), largura, cor, contorno: false, luz: false, frente });
  if (visual.musculoso && !deitar) {
    const linha = escurecer(pele, 0.22);
    for (const lado of [-1, 1]) traco([3.1, lado * 3, 19.8], [3.3, lado * 0.4, 19.1], 0.5, linha, 1.8);
    traco([3.3, 0, 19], [3.25, 0, 14.4], 0.4, linha, 1.8);
    for (const z of [17.4, 15.9]) traco([3.25, -1.3, z], [3.25, 1.3, z], 0.35, linha, 1.8);
  }
  if (visual.casaco) {
    for (const lado of [-1, 1]) {
      partes.push({ secoes: [anel(-0.4 + s * 0.3, lado * 3.5, 7, 1.9, 3.7), anel(-0.3, lado * 3.2, 14 + sobe, 1.6, 3.1), anel(-0.3, lado * 3.3, 21.8 + sobe, 1.8, 2.8)], cor: lado > 0 ? visual.casaco : escurecer(visual.casaco, 0.1), recuo: 1.6, frente: 0.7 });
    }
  }
  if (visual.avental) {
    placa([[3.35, -2.8, 13.2], [3.35, 2.8, 13.2], [3.6, 3, 7.4], [3.6, -3, 7.4]], visual.avental, 1.7);
    if (!deitar) for (const [l, z] of [[-2.3, 12.4], [0, 12.6], [2.3, 12.4], [-2.5, 10], [2.5, 10], [-2.5, 8], [0, 7.9], [2.5, 8]]) traco([3.7, l, z], [3.7, l, z], 0.6, escurecer(visual.avental, 0.35), 1.8);
  }
  if (visual.medalhao && !deitar) {
    for (const lado of [-1, 1]) traco([2.5, lado * 2, 22.6], [3.4, 0, 18.4], 0.5, visual.medalhao, 2);
    partes.push({ secoes: [bola(P(3.5, 0, 17.6 + sobe), 1.25)], cor: visual.medalhao, luz: false, frente: 2.1 });
    partes.push({ secoes: [bola(P(3.7, 0, 17.6 + sobe), 0.7)], cor: misturar(visual.medalhao, '#e0601c', 0.5), luz: false, frente: 2.2 });
  }
  if (visual.bandoleira && !deitar) {
    placa([[3.05, -3.6, 22.4], [3.05, -2, 22.8], [3.35, 3.8, 13.6], [3.35, 2.2, 13]], visual.bandoleira, 1.9);
    placa([[3.3, -0.7, 18.9], [3.3, 0.9, 18.6], [3.3, 0.9, 17.2], [3.3, -0.7, 17.5]], visual.fivela || '#9aa0a8', 2);
  }
}

// ================================================================================================================================================================================================================================================
// adornosDaCabeca
// Barba e bigode, capuz (pontudo, com o rosto na abertura), capuz fechado (de carrasco: cobre o rosto, com os furos
// dos olhos), capinha (sobre os ombros, barra recortada), coroa (faixa de pontas) e morion (elmo de aba).

function adornosDaCabeca({ P, anel, bola, menos, visual, sobe, escurecer, partes, deitar, pele }, z) {
  const fora = menos(P(1, 0, 0), P(0, 0, 0));
  const elipse = (f, z0, rl, rz) => ({ c: P(f, 0, z0), a: menos(P(f, rl, z0), P(f, 0, z0)), b: [0, 0, rz] });
  if (visual.barba) {
    partes.push({ secoes: [bola(P(2.4, 0, z - 1.5), 2.3), bola(P(2.9, 0, z - 3.2), 1.6), bola(P(1.4, -2.3, z - 0.3), 1.2), bola(P(1.4, 2.3, z - 0.3), 1.2)], cor: visual.barba, recuo: 0.8, frente: 4.2 });
  }
  if ((visual.bigode || visual.barba) && !deitar && !visual.capuzFechado) {
    const cor = visual.bigode || escurecer(visual.barba, 0.12);
    partes.push({ a: P(3.9, -1.5, z - 0.1), b: P(3.9, 1.5, z - 0.1), largura: 0.95, cor, contorno: false, luz: false, frente: 4.4 });
    if (visual.bigode) for (const lado of [-1, 1]) partes.push({ a: P(3.9, lado * 1.5, z - 0.1), b: P(3.6, lado * 2.6, z - 1.1), largura: 0.7, cor, contorno: false, luz: false, frente: 4.4 });
  }
  if (visual.capinha) {
    const cor = visual.capinha;
    partes.push({ secoes: [anel(0, 0, 17.6 + sobe, 5.6, 3.9), anel(0, 0, 22 + sobe, 5.1, 3.2), anel(0, 0, 24.8 + sobe, 3, 2.6)], cor, recuo: 1.6, frente: 1.2 });
    for (let l = -4.4; l <= 4.5; l += 1.6) partes.push({ placa: [[3.85, l - 0.85, 18], [3.85, l + 0.85, 18], [3.8, l + 0.1, 16.3 + (Math.abs(l * 7) % 3) * 0.3]].map(([f, ll, zz]) => P(f, ll, zz + sobe)), cor, fora, frente: 1.3 });
  }
  if (visual.capuz) {
    partes.push({ secoes: [bola(P(-0.3, 0, z + 1.8), 4.7), bola(P(-1.3, 0, z + 5.4), 3.3), bola(P(-3.8, 0, z + 8.6), 0.6)], cor: visual.capuz, recuo: 1.4, frente: 2 });
    partes.push({ secoes: [elipse(2.6, z + 0.9, 3.1, 3.5)], cor: escurecer(visual.capuz, 0.55), luz: false, frente: 2.2 });
    partes.push({ secoes: [elipse(3.1, z + 0.5, 2.5, 2.9)], cor: pele, luz: false, frente: 2.4 });
  }
  if (visual.capuzFechado) {
    partes.push({ secoes: [bola(P(0.4, 0, z + 1.4), 4.6), bola(P(-0.6, 0, z + 5.6), 3.4), bola(P(0.9, 0, z + 9.2), 0.8)], cor: visual.capuzFechado, recuo: 1.4, frente: 2.6 });
    if (!deitar) for (const lado of [-1, 1]) partes.push({ a: P(4.6, lado * 0.6, z + 1.3), b: P(4.5, lado * 2, z + 1.9), largura: 1, cor: '#0a080a', contorno: false, luz: false, frente: 4 });
  }
  if (visual.coroa) {
    const centro = P(0.2, 0, 0);
    const metade = (de, cor, frente) => {
      const pontos = [];
      for (let i = 0; i <= 12; i++) {
        const a = (de + 180 * i / 12) * Math.PI / 180;
        pontos.push([centro[0] + Math.cos(a) * 3, centro[1] + Math.sin(a) * 3, z + 4.2]);
      }
      for (let i = 12; i >= 0; i--) {
        const a = (de + 180 * i / 12) * Math.PI / 180;
        pontos.push([centro[0] + Math.cos(a) * 3.3, centro[1] + Math.sin(a) * 3.3, z + (i % 3 === 0 ? 7.8 : 5.8)]);
      }
      partes.push({ placa: pontos, cor, frente });
    };
    metade(135, misturar(visual.coroa, '#7a4a10', 0.4), 1);
    metade(-45, visual.coroa, 5);
  }
  if (visual.morion) {
    partes.push({ camadas: [
      { secoes: [anel(0.3, 0, z + 3.9, 6.4, 4.6), anel(0.3, 0, z + 4.4, 6, 4.3)], cor: escurecer(visual.morion, 0.08), luz: false },
      { secoes: [anel(0, 0, z + 4, 3.5, 3.5), bola(P(-0.3, 0, z + 6.2), 2.6), bola(P(-0.6, 0, z + 7.8), 1.2)], cor: visual.morion, recuo: 1 }
    ], frente: 5 });
  }
}

// ================================================================================================================================================================================================================================================
// armaNaMao
// A arma (visual.arma: { tipo: 'machado' | 'espada', cabo, lamina }) de pé na mão direita, apoiada no chão: machado
// com a lâmina em cima, espada com a ponta pra baixo. Desenhada por cima do corpo quando a mão está do lado da câmera.

function armaNaMao({ P, partes, direcao, visual }, [f, l, zMao]) {
  const arma = visual.arma;
  const frente = direcao === 'sul' || direcao === 'leste' ? 30 : 0;
  const quina = (pontos, grossura) => [pontos.map(([df, dz]) => P(f + 0.4 + df, l + 0.6 - grossura, dz)), pontos.map(([df, dz]) => P(f + 0.4 + df, l + 0.6 + grossura, dz))];
  if (arma.tipo === 'machado') {
    partes.push({ camadas: [
      { a: P(f + 0.4, l + 0.6, 0.4), b: P(f + 0.4, l + 0.6, 27), largura: 1, cor: arma.cabo, contorno: false },
      { solido: quina([[0, 26], [3.4, 28.4], [4.6, 23.4], [3.4, 18.2], [0, 20.4]], 0.3), cor: arma.lamina, chapado: true },
      { solido: quina([[3.4, 28.4], [4.6, 23.4], [3.4, 18.2], [4, 18.6], [5.2, 23.4], [4, 28]], 0.32), cor: misturar(arma.lamina, '#ffffff', 0.35), chapado: true }
    ], frente });
    return;
  }
  const lamina = (z, w) => [[w, 0], [0, 0.35], [-w, 0], [0, -0.35]].map(([df, dl]) => P(f + 0.4 + df, l + 0.6 + dl, z));
  partes.push({ camadas: [
    { solido: [lamina(0.4, 0.1), lamina(2.4, 1.15), lamina(zMao - 1.6, 1.15)], cor: arma.lamina, chapado: true },
    { a: P(f + 0.4, l + 0.6, zMao - 1.2), b: P(f + 0.4, l + 0.6, zMao + 2.4), largura: 0.9, cor: arma.cabo, contorno: false },
    { a: P(f + 0.4 - 2.2, l + 0.6, zMao - 1.4), b: P(f + 0.4 + 2.2, l + 0.6, zMao - 1.4), largura: 0.9, cor: arma.guarda || arma.cabo, contorno: false }
  ], frente });
}

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
  const eixo = eixos(direcao);
  const corpo = visual.corpo || {};
  const largo = corpo.largura ?? 1;
  const grosso = corpo.grossura ?? largo;
  const barriga = corpo.barriga ?? 0;
  const base = (f, l, z) => eixo(f * (1 + barriga * Math.max(0, 1 - ((z - 15) / 6.5) ** 2) / 3), l * largo, z);
  const P = deitar ? (f, l, z) => deitar(base(f, l, z * ALTURA_CORPO)) : (f, l, z) => base(f, l, z * ALTURA_CORPO);
  const menos = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const anel = (f, l, z, rl, rf) => {
    const c = P(f, l, z);
    return { c, a: menos(P(f, l + rl, z), c), b: menos(P(f + rf, l, z), c) };
  };
  const bola = (ponto, r) => ({ c: ponto, r: r * GROSSURA * (deitar || ponto[2] < 23.5 ? grosso : 1) });
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
  if (visual.musculoso) {
  } else if (visual.golaAberta) {
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
    if (peito.tecido) {
      partes.push({ a: P(3, 0, 21 + sobe), b: P(3.4, 0, 9.4 + sobe), largura: 3.4, cor: peito.tecido, frente: 1.9 });
      partes.push({ a: P(3.55, 0, 19.6 + sobe), b: P(3.6, 0, 16.4 + sobe), largura: 0.8, cor: peito.borda, contorno: false, luz: false, frente: 2.2 });
      partes.push({ a: P(3.55, -1.1, 18.4 + sobe), b: P(3.55, 1.1, 18.4 + sobe), largura: 0.8, cor: peito.borda, contorno: false, luz: false, frente: 2.2 });
    } else partes.push({ a: P(3.2, 0, 21.6 + sobe), b: P(3.3, 0, 13.4 + sobe), largura: 0.5, cor: peito.borda, contorno: false, luz: false, frente: 2.2 });
  }
  const c = { P, anel, bola, menos, visual, sobe, s, escurecer, partes, deitar, pele, direcao };
  roupasDoTronco(c);
  partes.push({ secoes: [bola(P(0.2, 0, 23 + sobe), 1.3), bola(P(0.3, 0, 24.8 + sobe), 1.3)], cor: pele, frente: 0.1 });
  const maos = {};
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
    maos[lado] = [passo * 3.6 + 0.7, lado * 4.9, 11.6 + sobe + Math.max(0, passo) * 1.1];
    partes.push({ secoes: [bola(mao, 1.35)], cor: visual.luvas || pele, luz: false, frente: 0.06 });
    if (visual.luvas) partes.push({ secoes: [bola(pulso, 1.55), bola(P(passo * 2.6, lado * 4.95, 14.8 + sobe), 1.45)], cor: visual.luvas, frente: 0.07 });
    if (visual.bracadeiras) partes.push({ secoes: [bola(P(passo * 2.5 + 0.1, lado * 4.95, 13.6 + sobe + Math.max(0, passo) * 0.6), 1.5), bola(P(passo * 2.1 - 0.1, lado * 4.95, 15.2 + sobe), 1.55)], cor: visual.bracadeiras, frente: 0.08 });
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
  if (visual.arma) armaNaMao(c, maos[1]);
  const z = 26.4 + sobe;
  partes.push({ secoes: [bola(P(0.3, 0, z + 1.6), 3.9), bola(P(1, 0, z - 0.2), 2.85)], cor: pele, frente: 0.4 });
  if (!visual.capuz && !visual.capuzFechado) for (const lado of [-1, 1]) partes.push({ secoes: [bola(P(0.1, lado * 3.9, z + 1.4), 0.95)], cor: pele, frente: 0.5 });
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
  const coberto = visual.capuz || visual.capuzFechado || visual.morion;
  if (!coberto) partes.push(...cabelo(P, anel, bola, visual, z, escurecer));
  adornosDaCabeca(c, z);
  if (deitar || visual.capuzFechado) return partes;
  for (const lado of [-1, 1]) {
    partes.push({ a: P(3.6, lado * 1.45, z + 1.6), b: P(3.6, lado * 1.45, z + 2.1), largura: 0.95, cor: '#1c1a22', contorno: false, luz: false, frente: 4 });
    partes.push({ a: P(3.4, lado * 0.9, z + 3.1), b: P(3.35, lado * 2.1, z + 3.2), largura: 0.5, cor: escurecer(visual.cabelo, 0.35), contorno: false, luz: false, frente: 4 });
  }
  partes.push({ a: P(3.95, 0, z + 0.9), largura: 0.7, cor: escurecer(pele, 0.14), contorno: false, luz: false, frente: 4 });
  partes.push({ a: P(3.8, -0.6, z - 0.4), b: P(3.8, 0.6, z - 0.4), largura: 0.45, cor: misturar(pele, '#5a1a1a', 0.5), contorno: false, luz: false, frente: 4 });
  return partes;
}

// ================================================================================================================================================================================================================================================
// faixaRecortada
// Polígono da metade de um anel virada pra câmera (de centro, entre as alturas z0 e z1, raios r0 e r1) com a borda de
// cima recortada em pontas de altura dente (barra de pele, franja).

function faixaRecortada(centro, z0, z1, r0, r1, dente) {
  const ponto = (i, r, z) => {
    const a = (-45 + 180 * i / 12) * Math.PI / 180;
    return [centro[0] + Math.cos(a) * r, centro[1] + Math.sin(a) * r, z];
  };
  const baixo = Array.from({ length: 13 }, (_, i) => ponto(i, r0, z0));
  const cima = Array.from({ length: 13 }, (_, i) => ponto(12 - i, r1, z1 + ((12 - i) % 2 ? dente : 0)));
  return [...baixo, ...cima];
}

// ================================================================================================================================================================================================================================================
// mago
// Figura de manto comprido (monge encapuzado, feiticeiro de chapéu): o manto alarga até a barra, com dobras escuras
// em ponta, e o resto vem do visual: { pele, tunica, manto (capa aberta por cima, cor), capuz + capinha (capuz pontudo
// e capinha de barra recortada), simbolo (cruz no peito), chapeu + faixa + fivela, barba (comprida = até a cintura),
// cajado }. deitar = o cadáver.

function mago(direcao, fase, visual, deitar = null) {
  const eixo = eixos(direcao);
  const largo = visual.largura ?? 1;
  const base = (f, l, z) => eixo(f * (z < 24 ? largo : 1), l * (z < 24 ? largo : 1), z);
  const P = deitar ? (f, l, z) => deitar(base(f, l, z)) : base;
  const menos = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const anel = (f, l, z, rl, rf) => {
    const c = P(f, l, z);
    return { c, a: menos(P(f, l + rl, z), c), b: menos(P(f + rf, l, z), c) };
  };
  const bola = (ponto, r) => ({ c: ponto, r });
  const fora = menos(P(1, 0, 0), P(0, 0, 0));
  const t = fase ? (fase - 1) / 8 * Math.PI * 2 : 0;
  const s = fase ? Math.sin(t) : 0;
  const sobe = fase ? Math.abs(Math.cos(t)) * 0.6 : 0;
  const escurecer = (cor, f = 0.28) => misturar(cor, '#000000', f);
  const deFrente = !deitar && (direcao === 'sul' || direcao === 'leste');
  const partes = [];
  const placa = (pontos, cor, frente) => partes.push({ placa: pontos.map(([f, l, z]) => P(f, l, z)), cor, fora, frente });
  const zz = (z) => z + sobe;
  partes.push({ secoes: [anel(s * 0.6, 0, 0.4, 5.4, 4.4), anel(0, 0, zz(13), 4, 2.9), anel(0, 0, zz(20.6), 4.5, 2.8), anel(0, 0, zz(22.6), 2.8, 2.1)], cor: visual.tunica, recuo: 2.4 });
  for (const [l, alto] of [[-2.6, 9], [0.4, 12], [2.9, 7.5]]) placa([[4.5, l - 1.1, 0.6], [4.5, l + 1.1, 0.6], [3.4, l + 0.2, alto]], escurecer(visual.tunica, 0.22), 0.6);
  if (visual.cinto) partes.push({ secoes: [anel(0, 0, zz(11.6), 4.15, 3.05), anel(0, 0, zz(12.6), 4.1, 3)], cor: visual.cinto, luz: false, frente: 0.8 });
  if (visual.manto) {
    for (const lado of [-1, 1]) {
      partes.push({ secoes: [anel(-0.6 + s * 0.4, lado * 3.4, 0.2, 2.6, 4.2), anel(-0.6, lado * 2.9, zz(21), 2.2, 2.8), anel(-0.4, lado * 2.4, zz(24.4), 1.4, 2.2)], cor: lado > 0 ? visual.manto : escurecer(visual.manto, 0.12), recuo: 2, frente: 0.9 });
      if (visual.rasgado) for (const [df, alto] of [[1.6, 7], [0.2, 11], [-1.4, 6]]) placa([[df + 2.4, lado * 3.6 - 0.9, 0.4], [df + 2.4, lado * 3.6 + 0.9, 0.4], [df + 1.8, lado * 3.2, alto]], escurecer(visual.manto, 0.25), 1);
    }
  }
  if (visual.barraPelo) {
    for (const [z0, z1, r0, r1] of [[0.4, 2.4, 5.8, 5.6], [8.2, 9.8, 4.9, 4.7]]) partes.push({ placa: faixaRecortada(P(0, 0, 0), z0, z1, r0 * largo, r1 * largo, 1.1), cor: visual.barraPelo, frente: 1.05 });
  }
  if (visual.capinha) {
    const ate = visual.capinhaAte ?? 14;
    partes.push({ secoes: [anel(0, 0, zz(ate), 5.7, 4), anel(0, 0, zz(21.6), 5, 3.1), anel(0, 0, zz(24.8), 3, 2.6)], cor: visual.capinha, recuo: 1.8, frente: 1 });
    for (let l = -4.5; l <= 4.6; l += 1.5) placa([[3.95, l - 0.85, zz(ate + 0.6)], [3.95, l + 0.85, zz(ate + 0.6)], [3.9, l + 0.15, zz(ate - 2.2 + (Math.abs(l * 7) % 3) * 0.4)]], visual.capinha, 1.1);
  }
  if (visual.simbolo && !deitar) {
    placa([[4, -0.45, zz(21)], [4, 0.45, zz(21)], [4, 0.45, zz(16.4)], [4, -0.45, zz(16.4)]], visual.simbolo, 1.6);
    placa([[4, -1.7, zz(19.6)], [4, 1.7, zz(19.6)], [4, 1.7, zz(18.8)], [4, -1.7, zz(18.8)]], visual.simbolo, 1.6);
  }
  const z = zz(26.6);
  if (visual.capuz) {
    partes.push({ secoes: [bola(P(0, 0, z + 0.4), 4.4), bola(P(-1, 0, z + 4.4), 3), bola(P(-2.6, 0, z + 9.6), 0.5)], cor: visual.capuz, recuo: 1.6, frente: 1.4 });
    partes.push({ secoes: [{ c: P(2.4, 0, z + 0.2), a: menos(P(2.4, 2.9, z + 0.2), P(2.4, 0, z + 0.2)), b: [0, 0, 3.4] }], cor: escurecer(visual.capuz, 0.6), luz: false, frente: 0.5 });
  }
  if (visual.cabelo && !visual.capuz) partes.push({ secoes: [bola(P(-0.6, 0, z + 1.8), 3), bola(P(-0.2, 0, z + 2.6), 2.9)], cor: visual.cabelo, frente: 1.2 });
  partes.push({ secoes: [bola(P(1.4, 0, z + 0.6), 2.6), bola(P(1.7, 0, z - 1.2), 2.1)], cor: visual.pele, luz: false, frente: visual.capuz ? 3 : 1.5 });
  if (visual.capuz && !deitar) partes.push({ secoes: [{ c: P(2.4, 0, z + 3.1), a: menos(P(2.4, 2.8, z + 3.1), P(2.4, 0, z + 3.1)), b: [0, 0, 0.8] }], cor: escurecer(visual.capuz, 0.6), luz: false, frente: 3.2 });
  if (visual.barba) {
    const ponta = visual.barbaComprida ? [P(3, 0.4, zz(12.5)), 0.5] : [P(2.9, 0, z - 4.6), 1.1];
    const [alto, grossa] = visual.barbaComprida ? [1.6, 1] : [2.4, 0.7];
    partes.push({ secoes: [bola(P(2.3, 0, z - alto), 2.4 * grossa), bola(P(2.7, 0, z - 3.6), 2 * grossa), bola(...ponta)], cor: visual.barba, recuo: 0.8, frente: 3.4 });
    if (!deitar) partes.push({ a: P(3.6, -1.3, z - 0.4), b: P(3.6, 1.3, z - 0.4), largura: 0.9, cor: escurecer(visual.barba, 0.15), contorno: false, luz: false, frente: 3.6 });
  }
  if (!deitar) {
    for (const lado of [-1, 1]) partes.push({ a: P(3.5, lado * 1.2, z + 1.2), b: P(3.5, lado * 1.2, z + 1.5), largura: visual.capuz ? 0.6 : 0.9, cor: '#1c1a22', contorno: false, luz: false, frente: 3.7 });
    if (!visual.capuz) partes.push({ secoes: [bola(P(3.4, 0.2, z + 0.3), 0.85), bola(P(3.9, 0.3, z - 0.5), 0.6)], cor: escurecer(visual.pele, 0.08), luz: false, frente: 3.8 });
  }
  if (visual.chapeu) {
    const centro = P(0.2, 0, 0);
    const faixa = (z0, z1, r0, r1) => {
      const volta = (zz, r, de, ate) => Array.from({ length: 13 }, (_, i) => {
        const a = (de + (ate - de) * i / 12) * Math.PI / 180;
        return [centro[0] + Math.cos(a) * r, centro[1] + Math.sin(a) * r, zz];
      });
      return [...volta(z0, r0, -45, 135), ...volta(z1, r1, 135, -45)];
    };
    const camadas = [
      { secoes: [anel(0.4, 0, z + 3.8, 6.6, 4.8), anel(0.4, 0, z + 4.3, 6.3, 4.5)], cor: escurecer(visual.chapeu, 0.1), luz: false },
      { secoes: [anel(0.2, 0, z + 4, 3.4, 3.4), bola(P(-0.6, 0, z + 8.6), 2), bola(P(-2.8, 0.8, z + 12.4), 0.9), bola(P(-5.2, 1.4, z + 13), 0.35)], cor: visual.chapeu, recuo: 1.2 },
      { placa: faixa(z + 4.3, z + 6, 3.45, 3.05), cor: visual.faixa }
    ];
    if (visual.fivela && !deitar) {
      camadas.push({ placa: [[3.45, -1.1, z + 6.1], [3.45, 1.1, z + 6.1], [3.45, 1.1, z + 4.2], [3.45, -1.1, z + 4.2]].map(([f, l, zz]) => P(f, l, zz)), cor: visual.fivela, fora });
      camadas.push({ placa: [[3.5, -0.45, z + 5.5], [3.5, 0.45, z + 5.5], [3.5, 0.45, z + 4.8], [3.5, -0.45, z + 4.8]].map(([f, l, zz]) => P(f, l, zz)), cor: visual.faixa, fora });
    }
    partes.push({ camadas, frente: 4 });
  }
  if (visual.coroa) adornosDaCabeca({ P, anel, bola, menos, visual: { coroa: visual.coroa }, sobe, escurecer, partes, deitar, pele: visual.pele }, z - 2.2);
  if (visual.espada) {
    const f = 5.6;
    const lamina = (zl, w) => [[0, w], [0.35, 0], [0, -w], [-0.35, 0]].map(([df, dl]) => P(f + df, dl, zl));
    partes.push({ camadas: [
      { solido: [lamina(0.6, 0.1), lamina(3, 1.4), lamina(zz(15.6), 1.4)], cor: visual.espada.lamina, chapado: true },
      { a: P(f, 0, zz(15.4)), b: P(f, 0, zz(20.4)), largura: 1, cor: visual.espada.cabo, contorno: false },
      { a: P(f, -3, zz(15.6)), b: P(f, 3, zz(15.6)), largura: 1, cor: visual.espada.cabo, contorno: false },
      ...[-1, 1].map(lado => ({ secoes: [bola(P(f + 0.3, lado * 1.2, zz(18.6)), 1.3)], cor: visual.luvas || visual.pele, luz: false }))
    ], frente: deFrente ? 30 : 0 });
  }
  if (visual.cajado) {
    const [f, l] = [2.6 + s * 0.8, 5.6];
    partes.push({ camadas: [
      { a: P(f, l, 0.2), b: P(f, l, z + 4), largura: 1, cor: visual.cajado, contorno: false },
      { a: P(f, l, z + 4), b: P(f, l + 2.6, z + 4.4), largura: 1, cor: visual.cajado, contorno: false },
      { a: P(f, l + 2.6, z + 4.4), b: P(f, l + 2.8, z + 2.6), largura: 0.9, cor: visual.cajado, contorno: false },
      { secoes: [bola(P(f - 0.2, l - 0.4, zz(18.4)), 1.3), bola(P(f - 0.2, l - 0.4, zz(16.8)), 1.2)], cor: visual.pele, luz: false }
    ], frente: deFrente ? 30 : 0 });
  }
  return partes;
}

// ================================================================================================================================================================================================================================================
// guerreiro
// Cavaleiro de armadura de placas em sólidos facetados (estilo ilustração chapada): elmo-balde com chifres e fenda em
// cruz, ombreiras, peitoral, saiote de placas, joelheiras, grevas e sapatos de ferro, escudo pipa e espada de pé.
// visual: { metal, escuro, fenda, escudo, escudoBorda, brasao, lamina, guarda, cabo }. deitar = o cadáver.

function guerreiro(direcao, fase, visual, deitar = null) {
  const base = eixos(direcao);
  const P = deitar ? (f, l, z) => deitar(base(f, l, z)) : base;
  const dir = (f, l, z) => {
    const a = P(0, 0, 0);
    const b = P(f, l, z);
    return [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  };
  const anel = (f, l, z, w, d, c = Math.min(w, d) * 0.45) => [[d, -w + c], [d, w - c], [d - c, w], [-d + c, w], [-d, w - c], [-d, -w + c], [-d + c, -w], [d - c, -w]].map(([df, dl]) => P(f + df, l + dl, z));
  const t = fase ? (fase - 1) / 8 * Math.PI * 2 : 0;
  const s = fase ? Math.sin(t) : 0;
  const sobe = fase ? Math.abs(Math.cos(t)) * 0.8 : 0;
  const metal = visual.metal;
  const claro = misturar(metal, '#ffffff', 0.18);
  const escuro = visual.escuro;
  const partes = [];
  const solido = (aneis, cor, frente = 0) => partes.push({ solido: aneis, cor, frente });
  const perna = (lado, passo) => {
    const ergue = Math.max(0, passo) * 2;
    const l = lado * 2.1;
    const joelho = [passo * 2.4 + 0.7, 7.4 + ergue * 0.6 + sobe * 0.5];
    const tornozelo = [passo * 4.2, 2 + ergue];
    solido([anel(0, l, 13.4 + sobe, 2.2, 2.4), anel(joelho[0], l, joelho[1] + 1, 1.8, 2)], metal);
    solido([anel(joelho[0], l, joelho[1] + 0.2, 1.7, 1.9), anel(tornozelo[0], l, tornozelo[1] + 0.6, 1.5, 1.7)], metal);
    solido([anel(joelho[0] + 0.5, l, joelho[1] - 1, 1.6, 1.4, 0.9), anel(joelho[0] + 0.7, l, joelho[1] + 0.6, 2, 2.2, 1.2), anel(joelho[0] + 0.5, l, joelho[1] + 2, 1.5, 1.4, 0.9)], claro, 0.2);
    solido([anel(tornozelo[0] + 0.8, l, ergue * 0.9, 1.6, 2.5, 0.8), anel(tornozelo[0] + 0.3, l, tornozelo[1] + 0.4, 1.5, 1.7, 0.7)], escuro, 0.1);
  };
  perna(-1, s);
  perna(1, -s);
  solido([anel(0, 0, 9.8 + sobe, 4.3, 3.3, 1.3), anel(0, 0, 11.7 + sobe, 4, 3, 1.2)], metal, 0.3);
  solido([anel(0, 0, 11.6 + sobe, 4, 3, 1.2), anel(0, 0, 13.7 + sobe, 3.7, 2.7, 1.1)], claro, 0.3);
  solido([anel(0, 0, 13.6 + sobe, 3.6, 2.5, 1.1), anel(0, 0, 18.5 + sobe, 4.3, 3, 1.3), anel(0, 0, 21.5 + sobe, 4.6, 2.9, 1.3), anel(0, 0, 22.9 + sobe, 2.8, 2.1, 0.9)], metal, 0.4);
  if (!deitar) {
    const z = 19 + sobe;
    partes.push({ placa: [P(3.02, -0.7, z + 0.9), P(3.02, 0.7, z + 0.9), P(3.02, 0.7, z - 0.2), P(3.02, 0, z - 1.1), P(3.02, -0.7, z - 0.2)], cor: visual.brasao, fora: dir(1, 0, 0), frente: 1 });
  }
  const braco = (lado, passo) => {
    const l = lado * 4.9;
    const cotovelo = [passo * 1.5 - 0.4, 16.8 + sobe];
    const pulso = [passo * 3.4 + 0.5, 12.8 + sobe + Math.max(0, passo) * 1.1];
    solido([anel(0, lado * 4.6, 21.4 + sobe, 1.5, 1.5), anel(cotovelo[0], l, cotovelo[1], 1.35, 1.35)], escuro);
    solido([anel(cotovelo[0], l, cotovelo[1] + 0.4, 1.45, 1.45), anel(pulso[0], l, pulso[1] + 0.6, 1.3, 1.3)], metal, 0.1);
    solido([anel(pulso[0] + 0.2, l, pulso[1] + 0.8, 1.55, 1.7, 0.6), anel(pulso[0] + 0.3, l, pulso[1] - 2.2, 1.3, 1.5, 0.6)], escuro, 0.15);
    solido([anel(0, lado * 4.5, 23.5 + sobe, 1.6, 2.2, 0.9), anel(0, lado * 5.1, 22.2 + sobe, 2.4, 2.9, 1.1), anel(0, lado * 5.5, 19.8 + sobe, 2.2, 2.7, 1.1)], claro, 0.8);
    return pulso;
  };
  const maoEsquerda = braco(-1, -s);
  const maoDireita = braco(1, 0.6 + s * 0.2);
  const ze = maoEsquerda[1];
  const fe = maoEsquerda[0];
  if (visual.escudo) {
    const kite = [[-3.2, 9.5], [0, 10.6], [3.2, 9.5], [3.4, 3.6], [0, -6.2], [-3.4, 3.6]];
    const lado = (l) => kite.map(([df, dz]) => P(fe + df, l, ze + dz));
    partes.push({ solido: [lado(-6.6), lado(-7.4)], cor: visual.escudoBorda, chapado: true, frente: 0.4 });
    const meia = (pontos, cor) => partes.push({ placa: pontos.map(([df, dz]) => P(fe + df, -7.5, ze + dz)), cor, fora: dir(0, -1, 0), frente: 0.5 });
    meia([[-2.7, 8.9], [0, 9.8], [0, -4.9], [-2.9, 3.7]], visual.escudo);
    meia([[0, 9.8], [2.7, 8.9], [2.9, 3.7], [0, -4.9]], misturar(visual.escudo, '#c75a10', 0.35));
  }
  const [fd, zd] = maoDireita;
  const ld = 3.4;
  const lamina = (z, w, d) => [[w, 0], [0, d], [-w, 0], [0, -d]].map(([df, dl]) => P(fd + 2.2 + df, ld + dl, z));
  partes.push({ camadas: [
    { solido: [anel(fd + 2.2, ld, zd - 3.4, 0.5, 0.5, 0.2), anel(fd + 2.2, ld, zd + 0.6, 0.45, 0.45, 0.2)], cor: visual.cabo },
    { solido: [anel(fd + 2.2, ld, zd - 4.6, 0.85, 0.85, 0.4), anel(fd + 2.2, ld, zd - 3.3, 0.85, 0.85, 0.4)], cor: visual.guarda },
    { solido: [lamina(zd + 1.6, 1.25, 0.4), lamina(zd + 16, 1.25, 0.4), lamina(zd + 18.4, 0.1, 0.1)], cor: visual.lamina, chapado: true },
    { solido: [anel(fd + 2.2, ld, zd + 0.6, 0.7, 2.8, 0.3), anel(fd + 2.2, ld, zd + 1.6, 0.7, 2.8, 0.3)], cor: visual.guarda }
  ], frente: direcao === 'sul' || direcao === 'leste' ? 30 : 0 });
  const z = 24 + sobe;
  solido([anel(0.2, 0, z, 3.3, 3.4, 0.9), anel(0.2, 0, z + 6.2, 3.5, 3.6, 1.1), anel(0.2, 0, z + 7.4, 2.7, 2.8, 1.3)], metal, 1.6);
  if (visual.chifre) {
    for (const l of [-1, 1]) {
      const chifre = (dl, dz, r) => anel(0, l * dl, z + dz, r, r, r * 0.4);
      solido([chifre(3.1, 4.8, 0.8), chifre(4.7, 6.2, 0.75), chifre(5, 8.6, 0.6), chifre(5, 9.4, 0.3)], visual.chifre, 1.7);
    }
  }
  if (visual.espinhos) {
    const ponta = (f, l, zz, r, alto) => solido([anel(f, l, zz, r, r, r * 0.4), anel(f, l, zz + alto, 0.12, 0.12, 0.05)], visual.espinhos, 1.8);
    for (const l of [-1, 1]) {
      ponta(-0.6, l * 2.9, z + 7.2, 0.9, 2.4);
      ponta(1.6, l * 2.9, z + 7.2, 0.9, 2.4);
      ponta(0, l * 6.4, 22.4 + sobe, 1.1, 2.6);
    }
  }
  if (!deitar) {
    const fora = dir(1, 0, 0);
    const fenda = (pontos) => partes.push({ placa: pontos.map(([dl, dz]) => P(3.67, dl, z + dz)), cor: visual.fenda, fora, frente: 2 });
    if (visual.grade) {
      fenda([[-1.8, 5.2], [1.8, 5.2], [1.8, 1.6], [-1.8, 1.6]]);
      for (let dl = -1.2; dl <= 1.3; dl += 0.8) for (let dz = 2.1; dz <= 4.8; dz += 0.8) partes.push({ placa: [[dl - 0.2, dz + 0.2], [dl + 0.2, dz + 0.2], [dl + 0.2, dz - 0.2], [dl - 0.2, dz - 0.2]].map(([a, b]) => P(3.7, a, z + b)), cor: visual.grade, fora, frente: 2.1 });
    } else {
      fenda([[-2.6, 4.3], [2.6, 4.3], [2.6, 3.5], [-2.6, 3.5]]);
      fenda([[-0.42, 5.8], [0.42, 5.8], [0.42, 1.2], [-0.42, 1.2]]);
    }
  }
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
// forma: 'humano', 'guerreiro', 'mago' ou 'lobo'.

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
  if (forma === 'mago') {
    const visualCaido = Object.fromEntries(Object.entries(visual).map(([k, v]) => [k, typeof v === 'string' ? podre(v) : v]));
    partes.push(...mago('leste', 0, visualCaido, ([x, y, zz]) => [12 - zz * 0.8, y, 2.4 + x * 0.55]));
    return partes;
  }
  if (forma === 'guerreiro') {
    const visualCaido = Object.fromEntries(Object.entries(visual).map(([k, v]) => [k, typeof v === 'string' ? podre(v) : v]));
    partes.push(...guerreiro('leste', 0, visualCaido, ([x, y, zz]) => [12 - zz * 0.8, y, 2.4 + x * 0.55]));
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
  for (let estagio = 0; estagio < 3; estagio++) quadro(estagio * 64, 4 * 64, caido(modelo === lobo ? 'lobo' : modelo === guerreiro ? 'guerreiro' : modelo === mago ? 'mago' : 'humano', estagio, visual), [46, 50]);
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

const CRIATURAS = { humano, lobo, guerreiro, mago };
const OBJETOS = { caixote, barril, poste, arvore, arbusto, capim, parede };

// ================================================================================================================================================================================================================================================
// desenharFolha
// A folha (canvas) do desenho de uma receita, escala vezes maior que o tamanho do jogo; null se o modelo não existe.

export function desenharFolha(desenho, escala = 1) {
  if (!desenho) return null;
  if (CRIATURAS[desenho.modelo]) return folhaDeCriatura(CRIATURAS[desenho.modelo], desenho.visual || {}, escala);
  return OBJETOS[desenho.modelo] ? OBJETOS[desenho.modelo](escala, desenho.argumento) : null;
}
