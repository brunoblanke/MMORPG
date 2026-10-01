// js/views/entity-overlay.js

import { displayName } from '../../shared/assets.js';
import { drawTibiaText, healthColor } from './tibia-text.js';

// Visual do Tibia: nome em negrito com contorno preto, na cor da vida, e
// barra de HP_BAR_WIDTH × HP_BAR_HEIGHT com borda preta logo abaixo.
const HP_BAR_WIDTH = 27;
const HP_BAR_HEIGHT = 4;
const CORPSE_NAME_COLOR = '#a0a0a0';

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
  const barX = Math.round(centerX - HP_BAR_WIDTH / 2);
  const barY = Math.round(base.y - 14 - stackOffsetY);

  drawTibiaText(ctx, name, centerX, barY - 2, color);

  if (hasHp && !isCorpse) {
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.fillRect(barX - 1, barY - 1, HP_BAR_WIDTH + 2, HP_BAR_HEIGHT + 2);
    ctx.fillStyle = color;
    ctx.fillRect(barX, barY, Math.round(HP_BAR_WIDTH * fraction), HP_BAR_HEIGHT);
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
