// js/views/entity-overlay.js

import { displayName } from '../../shared/assets.js';
import { drawTibiaText, healthColor } from './tibia-text.js';

// Nome no estilo do Tibia (negrito, contorno preto), sempre verde (player
// com caveira: a caveira branca em cima do nome), e barra
// com o mesmo visual da janela de battle (css/inventory.css): 3px, cantos
// arredondados, na cor da vida (healthColor: verde/amarela/vermelha).
const HP_BAR_HEIGHT = 3;
const HP_BAR_BACK = '#12151b';
const NAME_COLOR = '#5fe35f';
const CORPSE_NAME_COLOR = '#a0a0a0';
const SKULL_COLOR = '#ffffff';

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
// drawEntityOverlay

export function drawEntityOverlay(ctx, entity, base, stackOffsetX, stackOffsetY, size, devMode) {
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

  drawTibiaText(ctx, name, centerX, barY - 3, isCorpse ? CORPSE_NAME_COLOR : NAME_COLOR);
  if (isPlayer && entity.skull) drawTibiaText(ctx, '☠', centerX, barY - 16, SKULL_COLOR);

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
