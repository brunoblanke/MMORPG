// js/views/loading-screen.js

import { drawTibiaText } from './tibia-text.js';
import { NAME_COLOR } from './entity-overlay.js';
import { PLAYER_SPRITES, DEFAULT_GENDER } from '../../shared/catalog.js';
import { getAsset } from '../../shared/assets.js';

const FRAME_MS = 150;
const TILE = 32;
const WIDTH = 160;
const HEIGHT = 90;
const TILE_TOP = 12;

// Tela de carregamento (markup em index.html, #loadingScreen): um player andando no
// mesmo lugar no meio da tela, no tamanho do jogo (sqm de 32 px; o quadro de 64 px fica
// ancorado embaixo à direita do sqm, então é deslocado pra centralizar o sqm) e, embaixo dele, "Carregando… N%" no formato do nome do
// player (verde, com contorno). Some quando o jogo termina de carregar e abre a janela
// de entrada.

export class LoadingScreen {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor() {
    this.root = document.getElementById('loadingScreen');
    this.canvas = document.getElementById('loadingCanvas');
    this.ctx = this.canvas.getContext('2d');
    this.canvas.width = WIDTH;
    this.canvas.height = HEIGHT;
    this.fraction = 0;
    this.sheet = null;
    this.active = true;
    this.draw = this.draw.bind(this);
    requestAnimationFrame(this.draw);
  }

  // ================================================================================================================================================================================================================================================
  // setProgress
  // Quanto já carregou (0 a 1).

  setProgress(fraction) {
    this.fraction = Math.min(Math.max(fraction, 0), 1);
  }

  // ================================================================================================================================================================================================================================================
  // setPlayer
  // O player que anda na tela: a folha do gênero (a lista de sprites do gerador já veio).

  setPlayer(gender) {
    const asset = getAsset(PLAYER_SPRITES[gender] || PLAYER_SPRITES[DEFAULT_GENDER]) || getAsset(PLAYER_SPRITES[DEFAULT_GENDER]);
    if (!asset) return;
    const image = new Image();
    image.src = asset.url;
    this.sheet = { image, size: asset.quadro || TILE, frames: asset.quadros || 1 };
  }

  // ================================================================================================================================================================================================================================================
  // hide
  // Esconde a tela (carregou).

  hide() {
    this.active = false;
    this.root.hidden = true;
  }

  // ================================================================================================================================================================================================================================================
  // draw
  // Um quadro: o player andando pra frente (os quadros de caminhada da linha sul) e o texto embaixo.

  draw(now) {
    if (!this.active) return;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.imageSmoothingEnabled = false;
    const sheet = this.sheet;
    if (sheet && sheet.image.complete && sheet.image.naturalWidth) {
      const walk = Math.max(1, sheet.frames - 1);
      const column = sheet.frames > 1 ? 1 + Math.floor(now / FRAME_MS) % walk : 0;
      ctx.drawImage(sheet.image, column * sheet.size, 0, sheet.size, sheet.size, (WIDTH + TILE) / 2 - sheet.size - 7, TILE_TOP + TILE - sheet.size, sheet.size, sheet.size);
    }
    drawTibiaText(ctx, `Carregando… ${Math.round(this.fraction * 100)}%`, WIDTH / 2, TILE_TOP + TILE + 35, NAME_COLOR);
    requestAnimationFrame(this.draw);
  }
}
