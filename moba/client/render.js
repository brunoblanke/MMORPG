// moba/client/render.js

import { ARENA, HEROES } from './engine/config.js';
import { WALLS, SPAWNS } from './engine/map.js';
import { EFFECTS, MISSILES, effectUrl, missileUrl, missileDirection } from '/shared/effects.js';
import { SHEETS, FLOOR, image, ready, directionOf } from './assets.js';

export const TILE = 32;
export const ZOOM = 1.5;
const TEAM_COLOR = { blue: '#4aa3ff', red: '#ff5a5a' };
const ELEMENT_COLOR = { fire: '#ff9a3c', energy: '#c07bff', earth: '#8bd650', ice: '#7dd3fc', physical: '#ffffff', death: '#b0b0b0', holy: '#ffe58a' };
const MISSILE_MS = 260;
const TEXT_MS = 900;
const memory = new Map();

// ================================================================================================================================================================================================================================================
// toScreen
// A posição do mundo (tiles) na tela, com a câmera (em px do mundo) no centro.

export function toScreen(scene, x, y) {
  return { x: (x * TILE - scene.camera.x) * ZOOM + scene.width / 2, y: (y * TILE - scene.camera.y) * ZOOM + scene.height / 2 };
}

// ================================================================================================================================================================================================================================================
// toWorld
// A posição da tela em tiles do mundo.

export function toWorld(scene, sx, sy) {
  return { x: ((sx - scene.width / 2) / ZOOM + scene.camera.x) / TILE, y: ((sy - scene.height / 2) / ZOOM + scene.camera.y) / TILE };
}

// ================================================================================================================================================================================================================================================
// drawFloor
// A grama do campo, tile a tile (só o que aparece na tela).

function drawFloor(ctx, scene) {
  const grass = image(FLOOR);
  const start = toWorld(scene, 0, 0);
  const end = toWorld(scene, scene.width, scene.height);
  for (let y = Math.max(0, Math.floor(start.y)); y < Math.min(ARENA.height, Math.ceil(end.y)); y++) {
    for (let x = Math.max(0, Math.floor(start.x)); x < Math.min(ARENA.width, Math.ceil(end.x)); x++) {
      const at = toScreen(scene, x, y);
      if (ready(grass)) ctx.drawImage(grass, 0, 0, TILE, TILE, at.x, at.y, TILE * ZOOM + 1, TILE * ZOOM + 1);
      else { ctx.fillStyle = '#2f5a2f'; ctx.fillRect(at.x, at.y, TILE * ZOOM + 1, TILE * ZOOM + 1); }
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  const lane = toScreen(scene, 0, 13);
  ctx.fillStyle = 'rgba(120, 100, 70, 0.28)';
  ctx.fillRect(lane.x, lane.y, ARENA.width * TILE * ZOOM, 4 * TILE * ZOOM);
  for (const team of ['blue', 'red']) {
    const base = toScreen(scene, SPAWNS[team].x, SPAWNS[team].y);
    ctx.beginPath();
    ctx.arc(base.x, base.y, 6 * TILE * ZOOM, 0, Math.PI * 2);
    ctx.fillStyle = team === 'blue' ? 'rgba(74,163,255,0.14)' : 'rgba(255,90,90,0.14)';
    ctx.fill();
    ctx.strokeStyle = TEAM_COLOR[team];
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

// ================================================================================================================================================================================================================================================
// drawWalls
// Os pilares de pedra.

function drawWalls(ctx, scene) {
  for (const wall of WALLS) {
    const at = toScreen(scene, wall.x, wall.y);
    ctx.fillStyle = '#5b5f68';
    ctx.fillRect(at.x, at.y, wall.w * TILE * ZOOM, wall.h * TILE * ZOOM);
    ctx.strokeStyle = '#2d3036';
    ctx.lineWidth = 3;
    ctx.strokeRect(at.x, at.y, wall.w * TILE * ZOOM, wall.h * TILE * ZOOM);
  }
}

// ================================================================================================================================================================================================================================================
// bar
// Uma barra de vida (ou mana) centrada em (x, y).

function bar(ctx, x, y, width, fraction, color) {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(x - width / 2 - 1, y - 1, width + 2, 6);
  ctx.fillStyle = color;
  ctx.fillRect(x - width / 2, y, width * Math.max(0, Math.min(1, fraction)), 4);
}

// ================================================================================================================================================================================================================================================
// drawStructure
// A torre ou o nexus: base de pedra com a cor do time e a vida; protegida, com um escudo.

function drawStructure(ctx, scene, structure) {
  if (!structure.alive) return;
  const at = toScreen(scene, structure.x, structure.y);
  const radius = (structure.structure === 'nexus' ? 1.8 : 1.1) * TILE * ZOOM;
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius, 0, Math.PI * 2);
  ctx.fillStyle = '#6b6f78';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = TEAM_COLOR[structure.team];
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(at.x, at.y, radius * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = structure.structure === 'nexus' ? TEAM_COLOR[structure.team] : '#3a3d44';
  ctx.fill();
  if (structure.protected) {
    ctx.beginPath();
    ctx.arc(at.x, at.y, radius + 6, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 230, 120, 0.8)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  bar(ctx, at.x, at.y - radius - 14, radius * 1.6, structure.hp / structure.maxHp, TEAM_COLOR[structure.team]);
}

// ================================================================================================================================================================================================================================================
// walking
// O quadro de caminhada: quadro 0 parado; senão passa pelos quadros de andar, conforme o relógio.

function frameOf(unit, now, sheet) {
  const before = memory.get(unit.id);
  const moved = before && Math.hypot(unit.x - before.x, unit.y - before.y) > 0.005;
  memory.set(unit.id, { x: unit.x, y: unit.y, movedAt: moved ? now : before ? before.movedAt : 0 });
  const walking = now - memory.get(unit.id).movedAt < 160;
  return walking ? 1 + Math.floor(now / 110) % (sheet.frames - 1) : 0;
}

// ================================================================================================================================================================================================================================================
// drawUnit
// O herói ou o minion: a sprite virada pro lado em que anda (anda pro leste/oeste conforme o time, se nunca andou), anel do time e barras.

function drawUnit(ctx, scene, unit, isHero) {
  const sheet = isHero ? SHEETS.hero : SHEETS[unit.type];
  const img = image(sheet.url);
  const at = toScreen(scene, unit.x, unit.y);
  const before = memory.get(unit.id);
  const facing = isHero ? unit.facing : { x: unit.team === 'blue' ? 1 : -1, y: 0 };
  const moving = before ? { x: unit.x - before.x, y: unit.y - before.y } : null;
  const look = moving && Math.hypot(moving.x, moving.y) > 0.005 && !isHero ? moving : facing;
  ctx.beginPath();
  ctx.ellipse(at.x, at.y + 6 * ZOOM, 13 * ZOOM, 6 * ZOOM, 0, 0, Math.PI * 2);
  ctx.strokeStyle = TEAM_COLOR[unit.team];
  ctx.lineWidth = 3;
  ctx.stroke();
  if (ready(img)) {
    const frame = frameOf(unit, scene.now, sheet);
    const size = sheet.size * ZOOM;
    ctx.save();
    if (isHero && unit.slowed) ctx.globalAlpha = 0.7;
    ctx.drawImage(img, frame * sheet.size, directionOf(look) * sheet.size, sheet.size, sheet.size, at.x + 16 * ZOOM - size, at.y + 16 * ZOOM - size, size, size);
    ctx.restore();
  } else {
    ctx.fillStyle = TEAM_COLOR[unit.team];
    ctx.fillRect(at.x - 8, at.y - 8, 16, 16);
  }
  const width = (isHero ? 40 : 26) * ZOOM / 1.5;
  bar(ctx, at.x, at.y - 26 * ZOOM, width, unit.hp / unit.maxHp, unit.team === scene.myTeam ? '#4ade80' : '#ef4444');
  if (isHero) {
    if (unit.maxMana) bar(ctx, at.x, at.y - 26 * ZOOM + 6, width, unit.mana / unit.maxMana, '#60a5fa');
    ctx.font = 'bold 11px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = unit.id === scene.myId ? '#ccff33' : TEAM_COLOR[unit.team];
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    const label = `${HEROES[unit.vocation].name} ${unit.level}`;
    ctx.strokeText(label, at.x, at.y - 30 * ZOOM);
    ctx.fillText(label, at.x, at.y - 30 * ZOOM);
  }
}

// ================================================================================================================================================================================================================================================
// effectTiles
// Os pontos (em tiles) onde o efeito é desenhado: uma grade de 1 tile dentro do círculo ou do leque.

function effectTiles(event) {
  const points = [];
  const radius = Math.max(0.5, event.radius || 0.5);
  for (let dy = -Math.ceil(radius); dy <= Math.ceil(radius); dy++) {
    for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
      const distance = Math.hypot(dx, dy);
      if (event.cone) {
        if (distance < 0.5 || distance > radius) continue;
        const angle = Math.acos(Math.max(-1, Math.min(1, (dx * event.dirX + dy * event.dirY) / distance)));
        if (angle > 0.6) continue;
      } else if (distance > radius + 0.2) continue;
      points.push([event.x + dx, event.y + dy]);
    }
  }
  return points;
}

// ================================================================================================================================================================================================================================================
// drawEffects
// Os efeitos do Tibia (shared/effects.js) animados nos pontos de cada evento, e os projéteis voando.

function drawEffects(ctx, scene) {
  for (const effect of scene.effects) {
    const info = EFFECTS[effect.name];
    const img = info && image(effectUrl(effect.name));
    if (!info || !ready(img)) continue;
    const frame = Math.min(info.frames - 1, Math.floor((scene.now - effect.start) / info.ms));
    const size = info.size * ZOOM;
    for (const [x, y] of effect.tiles) {
      const at = toScreen(scene, x, y);
      ctx.drawImage(img, frame * info.size, 0, info.size, info.size, at.x + 16 * ZOOM - size, at.y + 16 * ZOOM - size, size, size);
    }
  }
  for (const missile of scene.missiles) {
    const info = MISSILES[missile.kind] || MISSILES.energy;
    const img = image(missileUrl(MISSILES[missile.kind] ? missile.kind : 'energy'));
    if (!ready(img)) continue;
    const t = Math.min(1, (scene.now - missile.start) / MISSILE_MS);
    const [column, row] = missileDirection(missile.toX - missile.fromX, missile.toY - missile.fromY);
    const at = toScreen(scene, missile.fromX + (missile.toX - missile.fromX) * t, missile.fromY + (missile.toY - missile.fromY) * t);
    const size = info.size * ZOOM;
    ctx.drawImage(img, column * info.size, row * info.size, info.size, info.size, at.x + 16 * ZOOM - size, at.y + 16 * ZOOM - size, size, size);
  }
}

// ================================================================================================================================================================================================================================================
// drawTexts
// Os números de dano (cor do elemento) e cura (verde) subindo.

function drawTexts(ctx, scene) {
  ctx.font = 'bold 14px Verdana, sans-serif';
  ctx.textAlign = 'center';
  for (const text of scene.texts) {
    const age = (scene.now - text.start) / TEXT_MS;
    const at = toScreen(scene, text.x, text.y);
    ctx.globalAlpha = 1 - age;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    const label = text.heal ? `+${text.amount}` : `${text.amount}`;
    ctx.strokeText(label, at.x, at.y - 20 - age * 32);
    ctx.fillStyle = text.heal ? '#4ade80' : ELEMENT_COLOR[text.element] || '#fff';
    ctx.fillText(label, at.x, at.y - 20 - age * 32);
  }
  ctx.globalAlpha = 1;
}

// ================================================================================================================================================================================================================================================
// pruneVisuals
// Tira da cena o que já acabou (efeitos, projéteis e números).

export function pruneVisuals(scene) {
  scene.effects = scene.effects.filter(effect => scene.now - effect.start < EFFECTS[effect.name].frames * EFFECTS[effect.name].ms);
  scene.missiles = scene.missiles.filter(missile => scene.now - missile.start < MISSILE_MS);
  scene.texts = scene.texts.filter(text => scene.now - text.start < TEXT_MS);
}

// ================================================================================================================================================================================================================================================
// render
// Um quadro da cena: chão, pilares, estruturas, unidades (de cima pra baixo), efeitos e números.

export function render(ctx, scene) {
  ctx.fillStyle = '#0b0d12';
  ctx.fillRect(0, 0, scene.width, scene.height);
  drawFloor(ctx, scene);
  drawWalls(ctx, scene);
  const state = scene.state;
  if (!state) return;
  for (const structure of state.structures) drawStructure(ctx, scene, structure);
  const units = [
    ...state.minions.map(unit => ({ unit, hero: false })),
    ...state.heroes.filter(hero => hero.alive).map(unit => ({ unit, hero: true }))
  ].sort((a, b) => a.unit.y - b.unit.y);
  for (const { unit, hero } of units) drawUnit(ctx, scene, unit, hero);
  drawEffects(ctx, scene);
  drawTexts(ctx, scene);
}

export { effectTiles };
