// js/net/protocol.js

import { Player } from '../models/player.js';
import { Enemy } from '../models/enemy.js';
import { PLAYER_GENDERS, DEFAULT_GENDER } from '../../shared/catalog.js';

// Mensagens entre navegador e servidor (JSON pelo WebSocket, em /ws):
//
//   navegador → servidor
//     { type: 'join', name, gender }               entrar com o nome e o gênero ('male' | 'female')
//     { type: 'command', command }                 comando do jogador (player-control.js)
//   servidor → navegador
//     { type: 'joinError', error }                 nome recusado (pode tentar de novo)
//     { type: 'welcome', playerId }                entrou: quem você é
//     { type: 'state', time, state, events }       a cada tick: estado + eventos
//
// O estado leva só o que muda: jogadores, inimigos, cadáveres e itens
// móveis. O mapa (pisos, paredes…) cada lado gera do mesmo data/map.json.

export const PLAYER_FIELDS = ['name', 'gender', 'x', 'y', 'z', 'step', 'direction', 'lvl', 'xp', 'nextLevelXp', 'hp', 'maxHp', 'currentHp', 'spd', 'atk', 'def', 'isTarget', 'spawnX', 'spawnY', 'spawnZ'];
export const ENEMY_FIELDS = ['creature', 'color', 'lvl', 'x', 'y', 'z', 'step', 'direction', 'hp', 'maxHp', 'currentHp', 'spd', 'atk', 'def', 'patrolCenterX', 'patrolCenterY', 'patrolRadius', 'detectionRadius'];
export const CORPSE_FIELDS = ['id', 'ownerId', 'name', 'x', 'y', 'z', 'step', 'color', 'type', 'lvl', 'creature', 'isPlayer', 'deathTime', 'decayTime', 'hasVolume', 'blocksMovement', 'movable', 'isCorpse', 'corpseCreature', 'corpseIsPlayer'];

export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 20;

// ================================================================================================================================================================================================================================================
// validateName
// Nome do personagem: espaços extras removidos, de NAME_MIN_LENGTH a
// NAME_MAX_LENGTH caracteres, só letras, números, espaço, _ e -.
// Devolve { name } ou { error }.

export function validateName(raw) {
  const name = String(raw ?? '').trim().replace(/\s+/g, ' ');
  if (name.length < NAME_MIN_LENGTH) return { error: `O nome precisa ter pelo menos ${NAME_MIN_LENGTH} letras.` };
  if (name.length > NAME_MAX_LENGTH) return { error: `O nome pode ter no máximo ${NAME_MAX_LENGTH} letras.` };
  if (!/^[\p{L}\p{N} _-]+$/u.test(name)) return { error: 'Use só letras, números, espaço, _ ou -.' };
  return { name };
}

// ================================================================================================================================================================================================================================================
// normalizeGender
// Gênero do personagem; qualquer valor desconhecido vira o padrão.

export function normalizeGender(gender) {
  return PLAYER_GENDERS.includes(gender) ? gender : DEFAULT_GENDER;
}

// ================================================================================================================================================================================================================================================
// pick

function pick(source, fields) {
  const out = {};
  for (const field of fields) out[field] = source[field];
  return out;
}

// ================================================================================================================================================================================================================================================
// isSyncedItem
// Itens que podem mudar de lugar (arrastados). Pisos, bordas e paredes fixas não.

export function isSyncedItem(obj) {
  return obj.movable === true && !obj.floorType && !obj.isBorder && !obj.stairDirection;
}

// ================================================================================================================================================================================================================================================
// serializeState
// Estado da simulação pra um jogador: o que todos veem mais o que é só dele
// (alvo, seguir, caminho do clique).

export function serializeState(sim, playerId) {
  const me = sim.getPlayer(playerId);
  return {
    players: sim.players.map(p => ({ id: p.id, ...pick(p, PLAYER_FIELDS) })),
    enemies: sim.enemies.map(e => ({ id: e.id, ...pick(e, ENEMY_FIELDS), state: e.ai.state })),
    corpses: sim.deadBodies.map(c => pick(c, CORPSE_FIELDS)),
    items: sim.objects.filter(isSyncedItem).map(o => ({ id: o.id, x: o.x, y: o.y, z: o.z, step: o.step })),
    you: me ? {
      target: me.target ? me.target.id : null,
      autoFollow: me.autoFollow,
      walk: { target: me.walk.target, path: me.walk.path.map(s => ({ x: s.x, y: s.y, z: s.z })) }
    } : null
  };
}

// ================================================================================================================================================================================================================================================
// placeCreature
// Põe a criatura na posição recebida. Um passo de 1 sqm anima como no jogo
// local; salto maior (escada, buraco, respawn) aparece direto.

function placeCreature(world, entity, data, renderNow) {
  const fromX = entity.x;
  const fromY = entity.y;
  const fromZ = entity.z || 0;
  const fromStep = entity.step || 0;
  const moved = fromX !== data.x || fromY !== data.y || fromZ !== data.z || fromStep !== data.step;
  if (!moved) return;

  world.moveEntityTile(entity, fromX, fromY, fromZ, data.x, data.y, data.z);
  entity.x = data.x;
  entity.y = data.y;
  entity.z = data.z;
  entity.step = data.step;

  const isStep = Math.abs(data.x - fromX) <= 1 && Math.abs(data.y - fromY) <= 1 && Math.abs(data.z - fromZ) <= 1;
  if (isStep) {
    entity.isMoving = true;
    entity.moveStartX = fromX;
    entity.moveStartY = fromY;
    entity.moveStartZ = fromZ;
    entity.moveStartStep = fromStep;
    entity.moveStartTime = renderNow;
  } else {
    entity.isMoving = false;
    entity.renderX = entity.x;
    entity.renderY = entity.y;
    entity.renderZ = entity.z;
    entity.renderStep = entity.step;
  }
}

// ================================================================================================================================================================================================================================================
// syncCreatures
// Deixa `list` igual aos dados recebidos: cria quem entrou, tira quem saiu e
// atualiza os campos e a posição de quem já estava.

function syncCreatures(world, list, incoming, fields, create, renderNow) {
  const byId = new Map(list.map(entity => [entity.id, entity]));
  const next = [];

  for (const data of incoming) {
    let entity = byId.get(data.id);
    if (entity) {
      byId.delete(data.id);
      placeCreature(world, entity, data, renderNow);
    } else {
      entity = create(data);
      world.addCreature(entity);
    }
    for (const field of fields) {
      if (field !== 'x' && field !== 'y' && field !== 'z' && field !== 'step') entity[field] = data[field];
    }
    next.push(entity);
  }

  for (const gone of byId.values()) world.removeCreature(gone);
  return next;
}

// ================================================================================================================================================================================================================================================
// syncCorpses
// deathTime chega no relógio do servidor; vira o relógio da tela (renderNow),
// que é o que o desenho do cadáver usa.

function syncCorpses(world, current, incoming, serverTime, renderNow) {
  const byId = new Map(current.map(c => [c.id, c]));
  const next = [];

  for (const data of incoming) {
    let corpse = byId.get(data.id);
    const localDeath = renderNow - (serverTime - data.deathTime);
    if (corpse) {
      byId.delete(data.id);
      if (corpse.x !== data.x || corpse.y !== data.y || corpse.z !== data.z) {
        world.moveEntityTile(corpse, corpse.x, corpse.y, corpse.z, data.x, data.y, data.z);
        corpse.x = data.x;
        corpse.y = data.y;
        corpse.z = data.z;
      }
      corpse.step = data.step;
    } else {
      corpse = { ...data, deathTime: localDeath, decayTime: localDeath + (data.decayTime - data.deathTime) };
      world.addToTile(corpse, corpse.x, corpse.y, corpse.z);
    }
    next.push(corpse);
  }

  for (const gone of byId.values()) world.removeFromTile(gone, gone.x, gone.y, gone.z);
  return next;
}

// ================================================================================================================================================================================================================================================
// applyState
// Aplica no espelho local (mirror = { world, objectsById, players, enemies,
// deadBodies }) o estado recebido do servidor. renderNow é o relógio da tela.

export function applyState(mirror, message, playerId, renderNow) {
  const { state, time } = message;
  const { world } = mirror;

  mirror.players = syncCreatures(world, mirror.players, state.players, PLAYER_FIELDS,
    (data) => new Player({ id: data.id, x: data.x, y: data.y, z: data.z, step: data.step, lvl: data.lvl, gender: data.gender }), renderNow);

  mirror.enemies = syncCreatures(world, mirror.enemies, state.enemies, ENEMY_FIELDS,
    (data) => new Enemy({ id: data.id, type: 'enemy', x: data.x, y: data.y, z: data.z, step: data.step, lvl: data.lvl, creature: data.creature, color: data.color }), renderNow);
  for (let i = 0; i < state.enemies.length; i++) {
    mirror.enemies[i].ai.state = state.enemies[i].state;
  }

  mirror.deadBodies = syncCorpses(world, mirror.deadBodies, state.corpses, time, renderNow);

  for (const data of state.items) {
    const obj = mirror.objectsById.get(data.id);
    if (!obj) continue;
    if (obj.x !== data.x || obj.y !== data.y || obj.z !== data.z) world.moveObject(obj, data.x, data.y, data.z);
    obj.step = data.step;
  }

  const me = mirror.players.find(p => p.id === playerId);
  if (me && state.you) {
    me.target = state.you.target ? mirror.enemies.find(e => e.id === state.you.target) || null : null;
    me.autoFollow = state.you.autoFollow;
    me.walk = state.you.walk;
  }
}
