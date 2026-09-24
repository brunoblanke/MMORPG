// /editor/js/view/canvas-renderer.js


import { GRID, TILE } from '../config.js';
import { STACK_OFFSET, ANIMATION_CYCLE_MS } from '../../../shared/constants.js';
import { pickFrameRect } from '../../../shared/sprite-sheet.js';
import { FLOOR1_FILES, FLOOR2_FILES, OBJECT_DEFS, ITEM_CATALOG, PLAYER_SPRITE } from '../model/catalog.js';
import { pickWeightedInteriorVariant } from '../../../shared/floor-variant.js';
import { getStairTopKeys } from '../model/borders.js';
import { state } from '../model/state.js';
import { restackItems } from '../../../shared/map-format.js';
import { loadImage, setImageUpdateCallback } from './image-cache.js';
import { getCreatureType, hasCreatureType } from '../../../shared/catalog.js';
import { getTibiaItem, parseTibiaType, tibiaFrameRect } from '../../../shared/tibia-registry.js';

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
  const entry = loadImage(file);
  if (entry.status === 'ok') {
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
// drawTibiaItem
// Item/chão do Tibia na variação do sqm (x, y, z), ancorado no canto de baixo
// à direita do sqm como no jogo, erguido pela altura da pilha (step).

function drawTibiaItem(type, x, y, z, px, py, step = 0) {
  const def = getTibiaItem(type);
  const entry = def ? loadImage(def.file) : null;
  const lift = step * STACK_OFFSET;
  if (!entry || entry.status !== 'ok') {
    ctx.fillStyle = '#6b5a8a';
    ctx.fillRect(px + 6 - lift, py + 6 - lift, TILE - 12, TILE - 12);
    return;
  }
  const frame = tibiaFrameRect(def, x, y, z, performance.now());
  ctx.drawImage(entry.img, frame.sx, frame.sy, frame.sw, frame.sh,
    px + TILE - frame.sw - lift, py + TILE - frame.sh - lift, frame.sw, frame.sh);
}

// ================================================================================================================================================================================================================================================
// drawFloorTile

function drawFloorTile(type, variant, px, py, x, y, z) {
  if (parseTibiaType(type)) {
    drawTibiaItem(type, x, y, z, px, py);
    return;
  }
  const files = type === 'Floor2' ? FLOOR2_FILES : FLOOR1_FILES;
  const entry = loadImage(files[variant]);
  if (entry.status === 'ok') {
    ctx.drawImage(entry.img, px, py, TILE, TILE);
  } else {
    ctx.fillStyle = type === 'Floor2' ? '#2f4a44' : '#3c3826';
    ctx.fillRect(px, py, TILE, TILE);
  }
}

// ================================================================================================================================================================================================================================================
// drawBorderPiece

export function drawBorderPiece(piece, px, py, target = ctx) {
  const files = piece.type === 'Floor2' ? FLOOR2_FILES : FLOOR1_FILES;
  const entry = loadImage(files[piece.variant]);
  if (entry.status === 'ok') target.drawImage(entry.img, px, py, TILE, TILE);
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
  // Topo de escada nunca tem piso (o jogo remove).
  const isVoid = (key) => stairTops.has(key);

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const key = `${x},${y}`;
      const cell = layer[key];
      const px = x * TILE;
      const py = y * TILE;

      // Pisos da célula (baixo e cima) e, por cima, as bordas gravadas nela.
      if (!isVoid(key)) {
        for (const k of ['floor', 'floorTop']) {
          if (cell[k]) drawFloorTile(cell[k].type, pickWeightedInteriorVariant(x, y, z), px, py, x, y, z);
        }
      }
      if (state.showBorders) {
        for (const piece of cell.borders) drawBorderPiece(piece, px, py);
      }

      if (stairTops.has(key)) drawStairTop(px, py);

      if (cell.hole) {
        const entry = loadImage(OBJECT_DEFS['Hole'].file);
        if (entry.status === 'ok') {
          ctx.drawImage(entry.img, px, py, TILE, TILE);
        } else {
          ctx.fillStyle = '#000';
          ctx.fillRect(px + 3, py + 3, TILE - 6, TILE - 6);
        }
      }

      if (cell.safe) drawSafeTile(px, py);

      // Mantém os steps coerentes com a pilha atual (reordenar/remover no painel).
      restackItems(cell.objects);
      cell.objects.forEach(obj => {
        if (parseTibiaType(obj.type)) {
          drawTibiaItem(obj.type, x, y, z, px, py, obj.step || 0);
          return;
        }
        if (ITEM_CATALOG[obj.type]) {
          const def = ITEM_CATALOG[obj.type];
          const entry = loadImage(def.file);
          const stepOffset = (obj.step || 0) * STACK_OFFSET;
          const drawX = px - stepOffset;
          const drawY = py - stepOffset;
          if (entry.status === 'ok') {
            const duration = def.frames > 1 ? ANIMATION_CYCLE_MS / def.frames : 100;
            const frame = pickFrameRect(['idle'], TILE, TILE, def.frames, 'idle', performance.now(), duration);
            ctx.drawImage(entry.img, frame.sx, frame.sy, frame.sw, frame.sh, drawX, drawY, TILE, TILE);
          } else {
            ctx.fillStyle = '#7a6a4a';
            ctx.fillRect(drawX + 6, drawY + 6, TILE - 12, TILE - 12);
          }
          return;
        }

        const def = OBJECT_DEFS[obj.type];
        const entry = loadImage(def.file);
        const drawX = px + TILE - def.frameW;
        const drawY = py + TILE - def.frameH;
        if (entry.status === 'ok') {
          const duration = def.frames > 1 ? ANIMATION_CYCLE_MS / def.frames : 100;
          const frame = pickFrameRect(['idle'], def.frameW, def.frameH, def.frames, 'idle', performance.now(), duration);
          ctx.drawImage(entry.img, frame.sx, frame.sy, frame.sw, frame.sh, drawX, drawY, def.frameW, def.frameH);
        } else {
          ctx.fillStyle = obj.type === 'Stairs' ? '#4CAF50' : '#8a5a3a';
          ctx.fillRect(drawX + 4, drawY + 4, def.frameW - 8, def.frameH - 8);
        }
      });

      if (cell.enemy) {
        const typeName = hasCreatureType(cell.enemy.type) ? cell.enemy.type : 'Cave Rat';
        const typeDef = getCreatureType(typeName);
        const at = drawCharacter(typeDef.file, typeDef.spriteSize, typeDef.color, px, py);
        labels.push({ text: `${typeName} ${cell.enemy.lvl}`, ...at });
      }

      if (cell.spawn) {
        const at = drawCharacter(PLAYER_SPRITE.file, PLAYER_SPRITE.frameSize, '#f5c518', px, py);
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