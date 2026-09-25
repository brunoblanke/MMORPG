// js/views/entity-overlay.js

import { displayName } from '../../shared/assets.js';

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

  const textX = base.x + size / 2 - stackOffsetX;
  const textY = base.y - 20 - stackOffsetY;

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.font = "bold 10px Arial";
  // Mesmo estilo do editor (drawLabel em editor/js/view/canvas-renderer.js): contorno preto.
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#000";
  ctx.strokeText(name, textX, textY);
  ctx.fillStyle = "#00FF00";
  ctx.fillText(name, textX, textY);
  ctx.restore();

  if (entity.currentHp !== undefined && entity.maxHp !== undefined) {
    const barWidth = size;
    const barHeight = 4;
    const barX = base.x - stackOffsetX;
    const barY = base.y - 14 - stackOffsetY;

    ctx.fillStyle = "#8B0000";
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const hpPercent = entity.currentHp / entity.maxHp;
    ctx.fillStyle = hpPercent > 0.5 ? "#00FF00" : hpPercent > 0.25 ? "#FFFF00" : "#FF0000";
    ctx.fillRect(barX, barY, barWidth * hpPercent, barHeight);

    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
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
