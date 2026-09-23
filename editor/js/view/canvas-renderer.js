// /editor/js/view/canvas-renderer.js


import { GRID, TILE } from '../config.js';
import { STACK_OFFSET, ANIMATION_CYCLE_MS } from '../../../shared/constants.js';
import { pickFrameRect } from '../../../shared/sprite-sheet.js';
import { FLOOR1_FILES, FLOOR2_FILES, OBJECT_DEFS, ITEM_CATALOG, CREATURE_TYPES, PLAYER_SPRITE } from '../model/catalog.js';
import { computeBorderPieces, pickWeightedInteriorVariant } from '../../../shared/floor-variant.js';
import { state } from '../model/state.js';
import { restackItems } from '../../../shared/map-format.js';
import { getStairTop } from '../../../shared/stairs.js';
import { loadImage, setImageUpdateCallback } from './image-cache.js';

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
// drawFloorTile

function drawFloorTile(type, variant, px, py) {
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
// getStairTopKeys
// Sqms do andar z que são topo de alguma escada do andar z-1 (shared/stairs.js).

function getStairTopKeys(z) {
  const keys = new Set();
  const below = state.layers[z - 1];
  if (!below) return keys;
  for (const [key, cell] of Object.entries(below)) {
    if (!cell.objects.some(o => o.type === 'Stairs')) continue;
    const [x, y] = key.split(',').map(Number);
    const top = getStairTop(x, y, z - 1);
    keys.add(`${top.x},${top.y}`);
  }
  return keys;
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
  // Topo de escada nunca tem piso (o jogo remove); buraco é item por cima do
  // chão: não impede piso, mas o sqm dele não recebe borda dos vizinhos.
  const isVoid = (key) => stairTops.has(key);

  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const key = `${x},${y}`;
      const cell = layer[key];
      const px = x * TILE;
      const py = y * TILE;

      // Pisos da célula (baixo e cima) e, por cima, as bordas dos vizinhos
      // colocados depois do piso visível daqui (computeBorderPieces).
      const cellFloor = isVoid(key) ? null : (cell.floorTop || cell.floor);
      if (!isVoid(key)) {
        for (const k of ['floor', 'floorTop']) {
          if (cell[k]) drawFloorTile(cell[k].type, pickWeightedInteriorVariant(x, y, z), px, py);
        }
      }
      if (state.showBorders && !cell.hole) {
        const pieces = computeBorderPieces(x, y, (nx, ny) => {
          const nKey = `${nx},${ny}`;
          const n = layer[nKey];
          return n && !isVoid(nKey) ? (n.floorTop || n.floor) : null;
        }, cellFloor);
        for (const piece of pieces) {
          const files = piece.type === 'Floor2' ? FLOOR2_FILES : FLOOR1_FILES;
          const entry = loadImage(files[piece.variant]);
          if (entry.status === 'ok') ctx.drawImage(entry.img, px, py, TILE, TILE);
        }
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

      // Mantém os steps coerentes com a pilha atual (reordenar/remover no painel).
      restackItems(cell.objects);
      cell.objects.forEach(obj => {
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
        const typeName = CREATURE_TYPES[cell.enemy.type] ? cell.enemy.type : 'Cave Rat';
        const typeDef = CREATURE_TYPES[typeName];
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
// draw

export function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (state.ghost && state.activeZ > 0 && state.layers[state.activeZ - 1]) {
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