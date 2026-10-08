// js/views/entity-overlay.js

import { displayName } from '../../shared/assets.js';
import { drawTibiaText, healthColor } from './tibia-text.js';
import { FOLLOW_ICONS } from './inventory-ui/icons.js';

// Nome no estilo do Tibia (negrito, contorno preto), verde (player com
// caveira: branco, vermelho ou preto, pela caveira), e barra
// com o mesmo visual da janela de battle (css/inventory.css): 3px, cantos
// arredondados, na cor da vida (healthColor: verde/amarela/vermelha).
const HP_BAR_HEIGHT = 3;
const HP_BAR_BACK = '#12151b';
export const NAME_COLOR = '#5fe35f';
const CORPSE_NAME_COLOR = '#a0a0a0';
const SKULL_NAMES = { white: { color: '#ffffff', outline: '#000000' }, red: { color: '#ff3b3b', outline: '#000000' }, black: { color: '#000000', outline: '#ffffff' } };
const COMBAT_ICON_COLOR = '#5fe35f';
const COMBAT_ICON_SIZE = 10;
let combatIcon = null;

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
// getCombatIcon
// O ícone do auto ataque (espadas cruzadas das janelas), em verde, pronto
// pro canvas.

function getCombatIcon() {
  if (!combatIcon) {
    const svg = FOLLOW_ICONS.attack.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"').replace(/currentColor/g, COMBAT_ICON_COLOR);
    combatIcon = new Image();
    combatIcon.src = 'data:image/svg+xml;base64,' + btoa(svg);
  }
  return combatIcon;
}

// ================================================================================================================================================================================================================================================
// drawCombatIcon
// Player em combate (não sai do jogo): o ícone no topo do sqm, encostado na
// borda direita, por fora dele.

function drawCombatIcon(ctx, left, top, size) {
  const icon = getCombatIcon();
  if (!icon.complete) return;
  ctx.drawImage(icon, left + size, top, COMBAT_ICON_SIZE, COMBAT_ICON_SIZE);
}

// ================================================================================================================================================================================================================================================
// drawEntityOverlay

export function drawEntityOverlay(ctx, entity, base, stackOffsetX, stackOffsetY, size, devMode, isSelf = false) {
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
  if (isPlayer && isSelf && entity.inCombat) drawCombatIcon(ctx, barX, base.y - stackOffsetY, size);

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
