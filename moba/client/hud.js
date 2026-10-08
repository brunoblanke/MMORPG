// moba/client/hud.js

import { ARENA, HEROES, BUFFS } from './engine/config.js';
import { WALLS } from './engine/map.js';
import { xpToLevel } from './engine/units.js';

const KEYS = ['Q', 'W', 'E', 'R'];
const TEAM_COLOR = { blue: '#4aa3ff', red: '#ff5a5a' };
export const MINIMAP = { width: 240, height: 120, left: 12, bottom: 12 };

// ================================================================================================================================================================================================================================================
// clock
// O tempo da partida em m:ss.

function clock(seconds) {
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
}

// ================================================================================================================================================================================================================================================
// drawTop
// O topo: o tempo e os abates de cada time; no fim, o vencedor.

function drawTop(ctx, scene) {
  const state = scene.state;
  const kills = (team) => state.heroes.filter(hero => hero.team === team).reduce((sum, hero) => sum + hero.kills, 0);
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px Verdana, sans-serif';
  ctx.fillStyle = TEAM_COLOR.blue;
  ctx.fillText(String(kills('blue')), scene.width / 2 - 70, 34);
  ctx.fillStyle = '#fff';
  ctx.fillText(clock(state.time), scene.width / 2, 34);
  ctx.fillStyle = TEAM_COLOR.red;
  ctx.fillText(String(kills('red')), scene.width / 2 + 70, 34);
  if (state.over) {
    ctx.font = 'bold 42px Verdana, sans-serif';
    ctx.fillStyle = TEAM_COLOR[state.winner];
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 5;
    const text = `${state.winner === 'blue' ? 'AZUL' : 'VERMELHO'} VENCEU`;
    ctx.strokeText(text, scene.width / 2, scene.height / 2 - 40);
    ctx.fillText(text, scene.width / 2, scene.height / 2 - 40);
  }
}

// ================================================================================================================================================================================================================================================
// drawAbilities
// Os 3 poderes (Q, W e E) embaixo no meio: nome, mana e a espera que falta; mais vida, mana, nível e ouro.

function drawAbilities(ctx, scene, me) {
  const abilities = HEROES[me.vocation].abilities;
  const boxWidth = 112;
  const left = scene.width / 2 - (abilities.length * (boxWidth + 8)) / 2;
  const top = scene.height - 116;
  abilities.forEach((ability, slot) => {
    const x = left + slot * (boxWidth + 8);
    const wait = me.cooldowns[slot];
    const noMana = me.mana < ability.mana;
    const locked = !!ability.unlock && me.level < ability.unlock;
    ctx.fillStyle = 'rgba(20, 22, 28, 0.9)';
    ctx.fillRect(x, top, boxWidth, 56);
    ctx.strokeStyle = locked || wait > 0 || noMana ? '#444' : ability.unlock ? '#ff9cf0' : '#ccff33';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, top, boxWidth, 56);
    ctx.textAlign = 'center';
    ctx.font = 'bold 20px Verdana, sans-serif';
    ctx.fillStyle = wait > 0 ? '#777' : '#fff';
    ctx.fillText(KEYS[slot], x + boxWidth / 2, top + 24);
    ctx.font = '10px Verdana, sans-serif';
    ctx.fillStyle = noMana ? '#f87171' : '#9db8ff';
    ctx.fillText(`${ability.name} · ${ability.mana}`, x + boxWidth / 2, top + 46);
    if (locked) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.fillRect(x, top, boxWidth, 56);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px Verdana, sans-serif';
      ctx.fillText(`Nível ${ability.unlock}`, x + boxWidth / 2, top + 36);
    } else if (wait > 0) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(x, top, boxWidth, 56);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 22px Verdana, sans-serif';
      ctx.fillText(wait.toFixed(1), x + boxWidth / 2, top + 36);
    }
  });
  const barWidth = abilities.length * (boxWidth + 8) - 8;
  const fill = (y, fraction, color, text) => {
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(left, y, barWidth, 14);
    ctx.fillStyle = color;
    ctx.fillRect(left, y, barWidth * Math.max(0, Math.min(1, fraction)), 14);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px Verdana, sans-serif';
    ctx.fillText(text, left + barWidth / 2, y + 11);
  };
  fill(top + 62, me.hp / me.maxHp, '#22c55e', `${me.hp} / ${me.maxHp}`);
  fill(top + 78, me.mana / me.maxMana, '#3b82f6', `${me.mana} / ${me.maxMana}`);
  fill(top + 94, me.level >= 15 ? 1 : me.xp / xpToLevel(me.level), '#a855f7', me.level >= 15 ? 'nível máximo' : `XP ${me.xp} / ${xpToLevel(me.level)}`);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px Verdana, sans-serif';
  ctx.fillText(`${HEROES[me.vocation].name} · nível ${me.level} · ouro ${me.gold} · ${me.kills}/${me.deaths}`, left, top - 24);
  ctx.font = '12px Verdana, sans-serif';
  ctx.fillStyle = '#c8cbd4';
  ctx.fillText(`ATK +${me.bonus.attack} · PODER +${me.bonus.power}% · ARM ${me.bonus.armor} · RM ${me.bonus.magicResist}`, left, top - 8);
  let buffX = left + barWidth;
  ctx.textAlign = 'right';
  for (const buff of me.buffs) {
    ctx.fillStyle = buff.id === 'dragon' ? '#ff9a3c' : '#c07bff';
    ctx.fillText(`${BUFFS[buff.id].name} ${clock(buff.left)}`, buffX, top - 8);
    buffX -= 170;
  }
}

// ================================================================================================================================================================================================================================================
// drawMinimap
// O mapa pequeno no canto de baixo à esquerda: pedras, estruturas, neutros (bosses em rosa; apagado quando mortos, com o tempo), minions e heróis.

function drawMinimap(ctx, scene) {
  const x0 = MINIMAP.left;
  const y0 = scene.height - MINIMAP.height - MINIMAP.bottom;
  const scale = MINIMAP.width / ARENA.width;
  ctx.fillStyle = 'rgba(20, 32, 20, 0.88)';
  ctx.fillRect(x0 - 2, y0 - 2, MINIMAP.width + 4, MINIMAP.height + 4);
  ctx.fillStyle = 'rgba(120, 100, 70, 0.55)';
  ctx.fillRect(x0, y0 + (ARENA.height / 2 - 3.5) * scale, MINIMAP.width, 7 * scale);
  ctx.fillStyle = '#5b5f68';
  for (const wall of WALLS) ctx.fillRect(x0 + wall.x * scale, y0 + wall.y * scale, wall.w * scale, wall.h * scale);
  const dot = (x, y, size, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(x0 + x * scale - size / 2, y0 + y * scale - size / 2, size, size);
  };
  for (const neutral of scene.state.neutrals) {
    if (neutral.alive) dot(neutral.x, neutral.y, neutral.boss ? 8 : 3, neutral.boss ? '#ff4fd8' : '#e0a030');
    else if (neutral.boss) {
      dot(neutral.x, neutral.y, 8, '#555');
      ctx.fillStyle = '#fff';
      ctx.font = '9px Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(neutral.respawnIn), x0 + neutral.x * scale, y0 + neutral.y * scale + 3);
    }
  }
  for (const structure of scene.state.structures) if (structure.alive) dot(structure.x, structure.y, structure.structure === 'nexus' ? 8 : 6, TEAM_COLOR[structure.team]);
  for (const minion of scene.state.minions) dot(minion.x, minion.y, 2, TEAM_COLOR[minion.team]);
  for (const hero of scene.state.heroes) if (hero.alive) dot(hero.x, hero.y, hero.id === scene.myId ? 7 : 5, hero.id === scene.myId ? '#ccff33' : TEAM_COLOR[hero.team]);
}

// ================================================================================================================================================================================================================================================
// drawDead
// O aviso de morte com o tempo pra renascer.

function drawDead(ctx, scene, me) {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, scene.width, scene.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px Verdana, sans-serif';
  ctx.fillText(`Você morreu — renasce em ${Math.ceil(me.respawnIn)} s`, scene.width / 2, scene.height / 2);
}

// ================================================================================================================================================================================================================================================
// drawHud
// Tudo da interface por cima da cena.

export function drawHud(ctx, scene) {
  if (!scene.state) return;
  drawTop(ctx, scene);
  drawMinimap(ctx, scene);
  const me = scene.state.heroes.find(hero => hero.id === scene.myId);
  if (!me) return;
  if (!me.alive) drawDead(ctx, scene, me);
  drawAbilities(ctx, scene, me);
}
