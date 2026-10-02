// /editor/js/view/canvas-renderer.js


import { GRID, TILE } from '../config.js';
import { STACK_OFFSET, ANIMATION_CYCLE_MS } from '../../../shared/constants.js';
import { pickFrameRect } from '../../../shared/sprite-sheet.js';
import { PLAYER_SPRITES, DEFAULT_GENDER } from '../../../shared/catalog.js';
import { getAsset, spriteFrame, pieceType, interiorVariant, displayName, isItemType } from '../../../shared/assets.js';
import { getStairTopKeys, getRopeTopKeys } from '../model/borders.js';
import { state } from '../model/state.js';
import { restackItems } from '../../../shared/map-format.js';
import { loadImage, setImageUpdateCallback } from './image-cache.js';
import { stackFrame } from '../../../shared/items.js';
import { brushCells, brushSize } from '../model/brush.js';

export const canvas = document.getElementById('canvas');
export const ctx = canvas.getContext('2d');
canvas.width = GRID * TILE;
canvas.height = GRID * TILE;

export const canvasWrap = document.querySelector('.canvas-wrap');

let renderScheduled = false;

// ================================================================================================================================================================================================================================================
// scheduleRender

export function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => { renderScheduled = false; draw(); });
}

setImageUpdateCallback(scheduleRender);

// ================================================================================================================================================================================================================================================
// drawCharacter
//
// Desenha o 1º frame (parado, virado pro sul) de uma criatura/player,
// ancorado no canto inferior direito do tile como no jogo, e devolve onde
// o nome deve ir: mesma altura que o jogo usa (entity-overlay.js), 20px
// acima do topo do tile, qualquer que seja o tamanho do sprite. Sem sprite
// carregado, desenha um bloco com a cor de fallback.

function drawCharacter(file, frameSize, fallbackColor, px, py) {
  const drawX = px + TILE - frameSize;
  const drawY = py + TILE - frameSize;
  const entry = file ? loadImage(file) : null;
  if (entry && entry.status === 'ok') {
    ctx.drawImage(entry.img, 0, 0, frameSize, frameSize, drawX, drawY, frameSize, frameSize);
  } else {
    ctx.fillStyle = fallbackColor;
    ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
  }
  return { x: px + TILE / 2, y: py - 20 };
}

// ================================================================================================================================================================================================================================================
// drawLabel

function drawLabel(text, x, y) {
  ctx.save();
  ctx.font = 'bold 10px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#000';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#00FF00';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ================================================================================================================================================================================================================================================
// drawPiece
// Peça de uma folha do gerador ancorada no canto de baixo à direita do sqm
// (com a animação, se tiver quadros). Item de pilha não anima: usa o quadro
// da quantidade (count), como no jogo. Sem imagem, um bloco da cor dada.

function drawPiece(type, px, py, fallback = null, target = ctx, count = 1) {
  const frame = spriteFrame(type);
  const entry = frame && loadImage(frame.url);
  const drawX = px + TILE - (frame ? frame.size : TILE);
  const drawY = py + TILE - (frame ? frame.size : TILE);
  if (entry && entry.status === 'ok') {
    const asset = getAsset(type);
    const duration = ANIMATION_CYCLE_MS / frame.frames;
    const rect = asset && (asset.pilha || asset.respingo)
      ? { sx: Math.min(asset.pilha ? stackFrame(count) : 0, frame.frames - 1) * frame.size, sy: 0 }
      : pickFrameRect(['idle'], frame.size, frame.size, frame.frames, 'idle', performance.now(), duration);
    target.drawImage(entry.img, frame.x + rect.sx, frame.y + rect.sy, frame.size, frame.size, drawX, drawY, frame.size, frame.size);
  } else if (fallback) {
    target.fillStyle = fallback;
    target.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
  }
}

// ================================================================================================================================================================================================================================================
// drawFloorTile

function drawFloorTile(type, x, y, z, px, py) {
  const variations = (getAsset(type) || {}).variacoes || 4;
  drawPiece(pieceType(type, interiorVariant(x, y, z, variations)), px, py, '#3c3826');
}

// ================================================================================================================================================================================================================================================
// drawBorderPiece

export function drawBorderPiece(piece, px, py, target = ctx) {
  drawPiece(pieceType(piece.type, piece.variant), px, py, null, target);
}

// ================================================================================================================================================================================================================================================
// drawStairTop
// Topo de escada: vão sem piso que leva de volta pro pé da escada.

function drawStairTop(px, py) {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
  ctx.strokeStyle = '#4CAF50';
  ctx.setLineDash([4, 3]);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px + 2.5, py + 2.5, TILE - 5, TILE - 5);
  ctx.setLineDash([]);
  ctx.fillStyle = '#4CAF50';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('↓', px + TILE / 2, py + TILE / 2 + 1);
  ctx.restore();
}

function drawLayer(layer, alpha, z) {
  ctx.globalAlpha = alpha;
  const labels = [];
  const stairTops = getStairTopKeys(z);
  const ropeTops = getRopeTopKeys(z);
  // Topo de escada nunca tem piso (o jogo remove).
  const isVoid = (key) => stairTops.has(key) && !(layer[key] && layer[key].hole);

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const key = `${x},${y}`;
      const cell = layer[key];
      const px = x * TILE;
      const py = y * TILE;

      // Pisos da célula (baixo e cima) e, por cima, as bordas gravadas nela.
      if (!isVoid(key)) {
        for (const k of ['floor', 'floorTop']) {
          if (cell[k]) drawFloorTile(cell[k].type, x, y, z, px, py);
        }
      }
      if (state.showBorders) {
        for (const piece of cell.borders) drawBorderPiece(piece, px, py);
      }

      if (stairTops.has(key) || ropeTops.has(key)) drawStairTop(px, py);

      if (cell.hole) drawPiece(cell.hole, px, py, '#000');

      if (cell.safe) drawSafeTile(px, py);

      // Mantém os steps coerentes com a pilha atual (reordenar/remover no painel).
      restackItems(cell.objects);
      cell.objects.forEach(obj => {
        const lift = isItemType(obj.type) ? (obj.step || 0) * STACK_OFFSET : 0;
        drawPiece(obj.type, px - lift, py - lift, '#8a5a3a', ctx, obj.count || 1);
      });

      if (cell.enemy) {
        const asset = getAsset(cell.enemy.type);
        const at = drawCharacter(asset ? asset.url : null, asset ? asset.quadro : TILE, '#c0392b', px, py);
        labels.push({ text: `${displayName(cell.enemy.type)} ${cell.enemy.lvl}`, ...at });
      }

      if (cell.npc) {
        const asset = getAsset(cell.npc.type);
        const at = drawCharacter(asset ? asset.url : null, asset ? asset.quadro : TILE, '#3fa9f5', px, py);
        labels.push({ text: displayName(cell.npc.type), ...at });
      }

      if (cell.spawn) {
        const player = getAsset(PLAYER_SPRITES[DEFAULT_GENDER]);
        const at = drawCharacter(player ? player.url : null, player ? player.quadro : TILE, '#f5c518', px, py);
        labels.push({ text: 'Player', ...at });
      }
    }
  }

  // Nomes por último, pra nenhuma parede/objeto de outra célula cobrir.
  labels.forEach(label => drawLabel(label.text, label.x, label.y));
  ctx.globalAlpha = 1;
}

// ================================================================================================================================================================================================================================================
// drawSafeTile
// Zona segura: verde translúcido com contorno, por baixo dos objetos.

function drawSafeTile(px, py) {
  ctx.save();
  ctx.fillStyle = 'rgba(46, 204, 113, 0.28)';
  ctx.fillRect(px, py, TILE, TILE);
  ctx.strokeStyle = 'rgba(46, 204, 113, 0.85)';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 1.5, py + 1.5, TILE - 3, TILE - 3);
  ctx.restore();
}

// ================================================================================================================================================================================================================================================
// draw

export function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (state.ghost && state.layers[state.activeZ - 1]) {
    drawLayer(state.layers[state.activeZ - 1], 0.28, state.activeZ - 1);
  }

  drawLayer(state.layers[state.activeZ], 1, state.activeZ);

  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= GRID; i++) {
    ctx.beginPath();
    ctx.moveTo(i * TILE + 0.5, 0);
    ctx.lineTo(i * TILE + 0.5, canvas.height);
    ctx.stroke();
  }
  for (let i = 0; i <= GRID; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * TILE + 0.5);
    ctx.lineTo(canvas.width, i * TILE + 0.5);
    ctx.stroke();
  }
  drawBrush();
  drawSelection();
}

// ================================================================================================================================================================================================================================================
// drawBrush
// Contorno do pincel sob o mouse; maior que 1 sqm, com o tamanho no canto.

function drawBrush() {
  const hover = state.hoverCell;
  if (!hover) return;
  const cells = state.tool === 'select' ? [hover] : brushCells(hover.x, hover.y);
  if (!cells.length) return;
  const minX = Math.min(...cells.map(c => c.x));
  const minY = Math.min(...cells.map(c => c.y));
  const maxX = Math.max(...cells.map(c => c.x));
  const maxY = Math.max(...cells.map(c => c.y));
  ctx.save();
  ctx.strokeStyle = 'rgba(94, 234, 212, 0.9)';
  ctx.lineWidth = 2;
  ctx.strokeRect(minX * TILE + 1, minY * TILE + 1, (maxX - minX + 1) * TILE - 2, (maxY - minY + 1) * TILE - 2);
  const size = state.tool === 'select' ? 1 : brushSize();
  if (size > 1) {
    const label = `${size}×${size}`;
    ctx.font = '600 11px sans-serif';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(minX * TILE + 2, minY * TILE + 2, ctx.measureText(label).width + 8, 15);
    ctx.fillStyle = '#5eead4';
    ctx.fillText(label, minX * TILE + 6, minY * TILE + 13);
  }
  ctx.restore();
}

// ================================================================================================================================================================================================================================================
// drawSelection
// Contorno amarelo no sqm escolhido com a ferramenta Selecionar e no sqm do
// campo x, y, z (no andar deles).

function drawSelection() {
  ctx.save();
  ctx.strokeStyle = '#f5c518';
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  for (const cell of [state.selected, state.focus]) {
    if (cell && cell.z === state.activeZ) ctx.strokeRect(cell.x * TILE + 1, cell.y * TILE + 1, TILE - 2, TILE - 2);
  }
  ctx.restore();
}

// ================================================================================================================================================================================================================================================
// cellFromEvent

export function cellFromEvent(evt) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const px = (evt.clientX - rect.left) * scaleX;
  const py = (evt.clientY - rect.top) * scaleY;
  const x = Math.floor(px / TILE);
  const y = Math.floor(py / TILE);
  if (x < 0 || y < 0 || x >= GRID || y >= GRID) return null;
  return { x, y };
}