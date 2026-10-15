// js/views/entity-overlay.js

import { displayName } from '../../shared/assets.js';
import { drawTibiaText, healthColor } from './tibia-text.js';

// Nome no estilo do Tibia (negrito, contorno preto), verde (player com
// caveira: branco, vermelho ou preto, pela caveira), e barra
// com o mesmo visual da janela de battle (css/inventory.css): 3px, cantos
// arredondados, na cor da vida (healthColor: verde/amarela/vermelha).
const HP_BAR_HEIGHT = 3;
const HP_BAR_BACK = '#12151b';
export const NAME_COLOR = '#5fe35f';
const CORPSE_NAME_COLOR = '#a0a0a0';
const SKULL_NAMES = { white: { color: '#ffffff', outline: '#000000' }, red: { color: '#ff3b3b', outline: '#000000' }, black: { color: '#000000', outline: '#ffffff' } };
const STATUS_ICON_SIZE = 10;
const ICON_SHAPES = {
  skull: '<path d="M10 2.2C5.8 2.2 3 5 3 8.7c0 2.2 1 3.6 2.4 4.4V16h2.2v-1.7h1.2V16h2.4v-1.7h1.2V16h2.2v-2.9c1.4-.8 2.4-2.2 2.4-4.4C17 5 14.2 2.2 10 2.2z"/><circle cx="7.1" cy="9" r="1.9" fill="#000" stroke="none"/><circle cx="12.9" cy="9" r="1.9" fill="#000" stroke="none"/><path d="M10 11.2l-.9 1.8h1.8z" fill="#000" stroke="none"/>',
  shield: '<path d="M10 2l7 2.6v5.2c0 3.9-2.8 6.6-7 8.2-4.2-1.6-7-4.3-7-8.2V4.6z"/>',
  swords: '<path d="M2 1.5l12.8 12.8M18 1.5L5.2 14.3M11.6 16.8l4.6-4.6M3.8 12.2l4.6 4.6M15.4 15.4l2.9 2.9M4.6 15.4l-2.9 2.9" fill="none"/>'
};
const statusIcons = {};

// ================================================================================================================================================================================================================================================
// roundRect

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x, y, width, height, radius);
  else ctx.rect(x, y, width, height);
  ctx.fill();
}

// ================================================================================================================================================================================================================================================
// getEntityName

function getEntityName(entity, isPlayer, isEnemy, isCorpse) {
  if (isCorpse) return entity.name || displayName(entity.creature);
  if (isPlayer || entity.isNpc) return entity.name || 'Player';
  if (isEnemy) return displayName(entity.creature);
  return '';
}

// ================================================================================================================================================================================================================================================
// getStatusIcon
// Ícone de status (caveira, escudo da party, espadas do combate): branco com contorno preto, como o nome, pronto pro canvas.

function getStatusIcon(name) {
  if (!statusIcons[name]) {
    const shapes = ICON_SHAPES[name];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="-1.5 -1.5 23 23" stroke-linejoin="round" stroke-linecap="round"><g fill="#000" stroke="#000" stroke-width="3.6">${shapes}</g><g fill="#fff" stroke="#fff" stroke-width="1.4">${shapes}</g></svg>`;
    const image = new Image();
    image.src = 'data:image/svg+xml;base64,' + btoa(svg);
    statusIcons[name] = image;
  }
  return statusIcons[name];
}

// ================================================================================================================================================================================================================================================
// drawStatusIcons
// Os ícones de status em coluna no topo do sqm, encostados na borda direita, por fora dele: caveira em cima (por enquanto sempre; depois só PK), escudo no meio (na party do jogador) e espadas embaixo (jogador em combate).

function drawStatusIcons(ctx, left, top, size, names) {
  names.forEach((name, i) => {
    const icon = getStatusIcon(name);
    if (icon.complete) ctx.drawImage(icon, left + size, top + i * STATUS_ICON_SIZE, STATUS_ICON_SIZE, STATUS_ICON_SIZE);
  });
}

// ================================================================================================================================================================================================================================================
// drawEntityOverlay

export function drawEntityOverlay(ctx, entity, base, stackOffsetX, stackOffsetY, size, devMode, isSelf = false, inParty = false) {
  if (!entity) return;
  if (entity.floorType) return;

  const isPlayer = entity && entity.isPlayer === true;
  const isEnemy = entity && entity.type === 'enemy';
  const isCorpse = entity && entity.isCorpse === true;
  const isNpc = entity && entity.isNpc === true;

  if (!isPlayer && !isEnemy && !isCorpse && !isNpc) return;

  const name = getEntityName(entity, isPlayer, isEnemy, isCorpse);

  const hasHp = entity.currentHp !== undefined && entity.maxHp !== undefined;
  const fraction = hasHp ? Math.max(0, Math.min(1, entity.currentHp / entity.maxHp)) : 1;
  const barColor = healthColor(fraction);
  const centerX = base.x + size / 2 - stackOffsetX;
  const barX = base.x - stackOffsetX;
  const barY = base.y - 15 - stackOffsetY;

  const skull = isPlayer ? SKULL_NAMES[entity.skull] : null;
  drawTibiaText(ctx, name, centerX, barY - 3, skull ? skull.color : (isCorpse ? CORPSE_NAME_COLOR : NAME_COLOR), skull ? skull.outline : undefined);
  if (isPlayer) {
    const icons = ['skull'];
    if (inParty) icons.push('shield');
    if (isSelf && entity.inCombat) icons.push('swords');
    drawStatusIcons(ctx, barX, base.y - stackOffsetY, size, icons);
  }

  if (hasHp && !isCorpse) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    roundRect(ctx, barX - 1, barY - 1, size + 2, HP_BAR_HEIGHT + 2, 2);
    ctx.fillStyle = HP_BAR_BACK;
    roundRect(ctx, barX, barY, size, HP_BAR_HEIGHT, 2);
    ctx.fillStyle = barColor;
    if (fraction > 0) roundRect(ctx, barX, barY, Math.max(2, size * fraction), HP_BAR_HEIGHT, 2);
    ctx.restore();
  }

  if (devMode && entity.lvl !== undefined) {
    const statsX = base.x + size / 2 - stackOffsetX;
    const statsY = base.y + size + 12 - stackOffsetY;
    ctx.save();
    ctx.font = "10px Arial";
    ctx.textAlign = "center";
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(`LV ${entity.lvl} / HP ${Math.floor(entity.currentHp)}/${entity.maxHp} / XP ${entity.xp || 0}`, statsX, statsY);
    ctx.fillText(`SPD ${entity.spd} / ATK ${entity.atk} / DEF ${entity.def}`, statsX, statsY + 12);
    ctx.restore();
  }
}
