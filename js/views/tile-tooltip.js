// js/views/tile-tooltip.js

import { getEntityLevel } from '../core/geometry.js';
import { displayName } from '../../shared/assets.js';

// Modo dev: o que está no sqm sob o mouse, numa caixa ao lado do cursor (no
// visual das janelas do jogo): por andar, de cima pra baixo na pilha, com
// posição, ordem e se tem volume, bloqueia e dá pra mover.

// ================================================================================================================================================================================================================================================
// getTooltipLine

function getTooltipLine(obj) {
  let label = obj.id || 'unknown';
  if (obj.isPlayer) label = 'PLAYER';
  if (obj.type === 'enemy') label = `ENEMY_${obj.id}`;

  if (obj.isCorpse) {
    if (obj.isPlayer) {
      label = 'PLAYER_CORPSE';
    } else {
      label = `${displayName(obj.creature)} (Morto)`;
    }
  }

  // z mostrado = andar em que a coisa está de fato (3 volumes = +1 andar).
  const z = getEntityLevel(obj);
  const order = obj.order || 0;

  let props = '';
  if (obj.hasVolume) props += ' vol';
  if (obj.blocksMovement) props += ' bloq';
  if (obj.movable === true) props += ' mov';
  if (obj.movable === false) props += ' fix';

  return `${label} | x:${obj.x} y:${obj.y} z:${z} ord:${order}${props}`;
}

// ================================================================================================================================================================================================================================================
// drawRoundedRect

function drawRoundedRect(ctx, x, y, w, h, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

// ================================================================================================================================================================================================================================================
// drawTileTooltip

export function drawTileTooltip(ctx, camera, gameState, inputController) {
  if (!gameState || !inputController) return;
  const mouseX = inputController.mouseX;
  const mouseY = inputController.mouseY;
  if (mouseX === undefined || mouseY === undefined || isNaN(mouseX) || isNaN(mouseY)) return;

  const gridPos = camera.screenToGrid(mouseX, mouseY);
  const tileX = gridPos.x;
  const tileY = gridPos.y;

  const objectsOnTile = gameState.world.getObjectsAt(tileX, tileY);
  const enemiesOnTile = gameState.enemies.filter(enemy => enemy.x === tileX && enemy.y === tileY);
  const playerOnTile = (gameState.players || [gameState.player]).filter(p => p.x === tileX && p.y === tileY);
  const corpsesOnTile = gameState.deadBodies.filter(corpse => corpse.x === tileX && corpse.y === tileY);

  const allOnTile = [...objectsOnTile, ...enemiesOnTile, ...playerOnTile, ...corpsesOnTile];
  if (allOnTile.length === 0) return;

  // Igual à pilha do sqm: andar de cima primeiro e, dentro de cada andar, o
  // que está em cima no topo da lista (o piso por último).
  allOnTile.sort((a, b) => {
    const levelA = getEntityLevel(a);
    const levelB = getEntityLevel(b);
    if (levelA !== levelB) return levelB - levelA;
    const stepA = a.step || 0;
    const stepB = b.step || 0;
    if (stepA !== stepB) return stepB - stepA;
    return (b.order || 0) - (a.order || 0);
  });

  // Linhas com um título "Andar N" antes dos itens de cada andar.
  const rows = [];
  let currentLevel = null;
  for (const obj of allOnTile) {
    const level = getEntityLevel(obj);
    if (level !== currentLevel) {
      rows.push({ text: `Andar ${level}`, isTitle: true });
      currentLevel = level;
    }
    rows.push({ text: getTooltipLine(obj), isTitle: false });
  }

  const tooltipX = Math.min(mouseX + 15, ctx.canvas.width - 20);
  const tooltipY = Math.min(mouseY + 15, ctx.canvas.height - 20);

  ctx.save();

  const fontSize = 11;
  const lineGap = 6;
  const lineHeight = fontSize + lineGap;
  const padding = 8;
  const titleFont = `600 ${fontSize}px 'IBM Plex Mono', ui-monospace, monospace`;
  const lineFont = `${fontSize}px 'IBM Plex Mono', ui-monospace, monospace`;
  const boxWidth = Math.max(...rows.map(row => {
    ctx.font = row.isTitle ? titleFont : lineFont;
    return ctx.measureText(row.text).width;
  })) + padding * 2;
  // O espaço entre linhas só existe ENTRE elas; a última não leva sobra embaixo.
  const boxHeight = rows.length * fontSize + (rows.length - 1) * lineGap + padding * 2;

  drawRoundedRect(ctx, tooltipX + 0.5, tooltipY + 0.5, boxWidth, boxHeight, 8);

  ctx.fillStyle = "rgba(22, 25, 32, 0.92)";
  ctx.fill();
  ctx.strokeStyle = "#2a2f3a";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  rows.forEach((row, i) => {
    ctx.font = row.isTitle ? titleFont : lineFont;
    ctx.fillStyle = row.isTitle ? "#5eead4" : "#e7e9ee";
    ctx.fillText(row.text, tooltipX + padding, tooltipY + padding + i * lineHeight);
  });

  ctx.restore();
}
