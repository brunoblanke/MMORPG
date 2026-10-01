// js/views/entity-overlay.js

import { displayName } from '../../shared/assets.js';
import { drawTibiaText, healthColor } from './tibia-text.js';

// Nome no estilo do Tibia (negrito, contorno preto, na cor da vida) e barra
// com o mesmo visual da janela de battle (css/inventory.css): 3px, cantos
// arredondados, verde/amarela/vermelha.
const HP_BAR_HEIGHT = 3;
const HP_BAR_BACK = '#12151b';
const HP_HIGH = '#22c55e';
const HP_MID = '#eab308';
const HP_LOW = '#ef4444';
const CORPSE_NAME_COLOR = '#a0a0a0';

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
  if (isPlayer) return entity.name || 'Player';
  if (isEnemy) return displayName(entity.creature);
  return '';
}

// ================================================================================================================================================================================================================================================
// drawEntityOverlay

export function drawEntityOverlay(ctx, entity, base, stackOffsetX, stackOffsetY, size, devMode) {
  if (!entity) return;
  if (entity.floorType) return;

  const isPlayer = entity && entity.isPlayer === true;
  const isEnemy = entity && entity.type === 'enemy';
  const isCorpse = entity && entity.isCorpse === true;

  if (!isPlayer && !isEnemy && !isCorpse) return;

  const name = getEntityName(entity, isPlayer, isEnemy, isCorpse);

  const hasHp = entity.currentHp !== undefined && entity.maxHp !== undefined;
  const fraction = hasHp ? Math.max(0, Math.min(1, entity.currentHp / entity.maxHp)) : 1;
  const color = isCorpse || !hasHp ? CORPSE_NAME_COLOR : healthColor(fraction);
  const centerX = base.x + size / 2 - stackOffsetX;
  const barX = base.x - stackOffsetX;
  const barY = base.y - 15 - stackOffsetY;

  drawTibiaText(ctx, name, centerX, barY - 3, color);

  if (hasHp && !isCorpse) {
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    roundRect(ctx, barX - 1, barY - 1, size + 2, HP_BAR_HEIGHT + 2, 2);
    ctx.fillStyle = HP_BAR_BACK;
    roundRect(ctx, barX, barY, size, HP_BAR_HEIGHT, 2);
    ctx.fillStyle = fraction <= 0.25 ? HP_LOW : fraction <= 0.5 ? HP_MID : HP_HIGH;
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
