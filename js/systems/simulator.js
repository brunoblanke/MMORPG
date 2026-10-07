// js/systems/simulator.js

import { Enemy } from '../models/enemy.js';
import { creaturePowers, getAsset } from '../../shared/assets.js';
import { EFFECTS } from '../../shared/effects.js';
import { findSpell, RUNES, WANDS, AREAS, circleArea } from '../../shared/spells.js';
import { newItem } from '../../shared/items.js';
import { AROUND, ringArea, lineTiles } from './creature-powers.js';

// Simulador (simulador.html): o player testa, sem gastar mana, runa nem
// munição, as magias das criaturas, as magias, runas, munições, wands e rods
// do jogo, nos bonecos de treino (criaturas paradas, que não atacam, com vida
// de sobra). Tudo passa pelas mesmas funções do jogo; o comando `simulate`
// escolhe o quê. A mira é o sqm sob o mouse (x, y), ou o boneco mais perto.

export const DUMMY_SPOTS = [[4, 0], [6, 0], [6, -2], [6, 2], [8, 0]];
export const DUMMY_HP = 1000000;
const LAUNCHERS = ['itens/distancia/crossbow', 'itens/distancia/bow'];

export class SimulatorController {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(sim) {
    this.sim = sim;
    this.dummyCount = 0;
  }

  // ================================================================================================================================================================================================================================================
  // dummies
  // Os bonecos de treino vivos.

  dummies() {
    return this.sim.enemies.filter(enemy => enemy.dummy && enemy.isAlive());
  }

  // ================================================================================================================================================================================================================================================
  // update
  // A cada tick: vida dos bonecos cheia (e a do player, mana e comida).

  update() {
    for (const dummy of this.dummies()) {
      if (dummy.currentHp < DUMMY_HP) dummy.currentHp = DUMMY_HP;
    }
  }

  // ================================================================================================================================================================================================================================================
  // message

  message(player, text) {
    this.sim.emit({ type: 'message', playerId: player.id, text, kind: 'warn' });
  }

  // ================================================================================================================================================================================================================================================
  // setTarget
  // Troca os bonecos pela criatura (o tipo, ex.: criaturas/dragoes/dragon), nos mesmos lugares
  // à frente do spawn. Devolve quantos nasceram.

  setTarget(player, creature) {
    if (!getAsset(creature)) return 0;
    const world = this.sim.world;
    for (const old of this.sim.enemies.filter(enemy => enemy.dummy)) {
      world.removeCreature(old);
      this.sim.enemies.splice(this.sim.enemies.indexOf(old), 1);
    }
    const z = player.spawnZ || 0;
    let created = 0;
    for (const [dx, dy] of DUMMY_SPOTS) {
      const x = player.spawnX + dx;
      const y = player.spawnY + dy;
      const step = world.getPassableStep(x, y, z);
      if (step === null || world.isBlocked(x, y, z)) continue;
      this.dummyCount++;
      const dummy = new Enemy({ id: `dummy${this.dummyCount}`, lvl: 50, creature, type: 'enemy', x, y, z, step, height: 1 });
      dummy.dummy = true;
      dummy.hp = dummy.maxHp = dummy.currentHp = DUMMY_HP;
      this.sim.enemies.push(dummy);
      world.addCreature(dummy);
      created++;
    }
    return created;
  }

  // ================================================================================================================================================================================================================================================
  // aimOf
  // O sqm mirado { x, y, z } e o boneco nele (ou o mais perto do player).

  aimOf(player, command) {
    const z = player.z || 0;
    const dummies = this.dummies();
    const nearest = [...dummies].sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y))[0] || null;
    if (Number.isInteger(command.x) && Number.isInteger(command.y)) {
      const dummy = dummies.find(d => d.x === command.x && d.y === command.y) || null;
      return { x: command.x, y: command.y, z, dummy: dummy || nearest };
    }
    return nearest ? { x: nearest.x, y: nearest.y, z, dummy: nearest } : { x: player.x + 3, y: player.y, z, dummy: null };
  }

  // ================================================================================================================================================================================================================================================
  // refill
  // Vida, mana e esperas do player de volta ao máximo.

  refill(player) {
    player.currentHp = player.hp;
    player.mana = player.maxMana;
    player.spellReadyAt = 0;
    player.useReadyAt = 0;
    player.lastAttackTime = -1e9;
  }

  // ================================================================================================================================================================================================================================================
  // run
  // Comando simulate: { kind: 'target' | 'creature' | 'spell' | 'rune' | 'ammo' | 'wand', id, index, x, y }.

  run(player, command) {
    if (!command || typeof command !== 'object' || typeof command.id !== 'string') return;
    if (command.kind === 'target') return this.setTarget(player, command.id);
    if (!player.isAlive()) return;
    this.refill(player);
    const aim = this.aimOf(player, command);
    const previous = player.target;
    player.target = aim.dummy;
    const now = this.sim.time || 0;
    if (command.kind === 'creature') this.creatureSpell(player, command.id, Math.floor(Number(command.index)) || 0, aim, now);
    else if (command.kind === 'spell') this.playerSpell(player, command.id);
    else if (command.kind === 'rune') this.rune(player, command.id, aim, now);
    else if (command.kind === 'ammo' || command.kind === 'wand') this.shoot(player, command, aim, now);
    player.target = previous;
    player.lastAttackTime = -1e9;
  }

  // ================================================================================================================================================================================================================================================
  // playerSpell
  // A magia dita (a vocação vira a primeira que pode usá-la).

  playerSpell(player, words) {
    const spell = findSpell(words);
    if (!spell) return;
    player.vocation = spell.vocations[0];
    if (player.lvl < spell.lvl) player.lvl = spell.lvl;
    if (spell.kind === 'heal') player.currentHp = Math.max(1, Math.floor(player.hp / 2));
    this.sim.spells.cast(player, words);
  }

  // ================================================================================================================================================================================================================================================
  // rune
  // A runa no sqm mirado (a de cura, em quem usa).

  rune(player, type, aim, now) {
    const rune = RUNES[type];
    if (!rune) return;
    const healing = rune.kind === 'heal' || rune.kind === 'cure';
    const target = healing ? { x: player.x, y: player.y, z: aim.z } : rune.kind === 'attack' && aim.dummy ? { x: aim.dummy.x, y: aim.dummy.y, z: aim.z } : { x: aim.x, y: aim.y, z: aim.z };
    if (healing) player.currentHp = Math.max(1, Math.floor(player.hp / 2));
    const problem = this.sim.spells.runeEffect(player, rune, target, now);
    if (problem) this.message(player, problem);
  }

  // ================================================================================================================================================================================================================================================
  // shoot
  // Tiro de munição (com a besta ou o arco) ou de wand/rod, no boneco mirado.

  shoot(player, command, aim, now) {
    const target = aim.dummy;
    if (!target) return this.message(player, 'Sem boneco de treino.');
    const saved = { arma: player.equip.arma, municao: player.equip.municao, vocation: player.vocation };
    if (command.kind === 'wand') {
      const wand = WANDS[command.id];
      if (!wand) return;
      player.vocation = wand.vocations[0];
      if (player.lvl < wand.lvl) player.lvl = wand.lvl;
      player.equip.arma = newItem(this.sim.inventory.nextUid(), command.id);
    } else {
      const launcher = LAUNCHERS.find(type => getAsset(type));
      if (!launcher) return this.message(player, 'Não existe arco nem besta no gerador.');
      player.equip.arma = newItem(this.sim.inventory.nextUid(), launcher);
      player.equip.municao = newItem(this.sim.inventory.nextUid(), command.id, 100);
    }
    const ranged = this.sim.combat.rangedWeapon(player);
    if (ranged && !ranged.error) {
      if (this.sim.combat.canShoot(player, target, ranged)) this.sim.combat.shoot(player, target, ranged, now);
      else this.message(player, 'Longe demais ou sem linha livre.');
    } else if (ranged) this.message(player, ranged.error);
    player.equip.arma = saved.arma;
    player.equip.municao = saved.municao;
    player.vocation = saved.vocation;
  }

  // ================================================================================================================================================================================================================================================
  // areaTiles
  // Os sqms que a magia da criatura (attack) alcança lançada pelo player, mirando em aim.

  areaTiles(player, attack, aim) {
    const powers = this.sim.powers;
    const z = player.z || 0;
    const at = { x: aim.x, y: aim.y, z };
    const around = (center, area) => powers.visibleTiles(center, area);
    const self = attack.center === 'self';
    switch (attack.shape) {
      case 'wave': return powers.waveTiles(player, aim, attack);
      case 'beam': return powers.beamTiles(player, aim, attack);
      case 'sweep': return powers.sweepTiles(player, aim);
      case 'around': return around(player, AROUND);
      case 'ball': return around(self ? player : at, circleArea(attack.radius));
      case 'ring': return around(self ? player : at, ringArea(attack.radius));
      case 'cross': return around(at, AREAS.cross);
      case 'field': return around(at, attack.radius > 0 ? circleArea(attack.radius) : AREAS.single);
      default: return around(at, AREAS.single);
    }
  }

  // ================================================================================================================================================================================================================================================
  // chainTiles
  // A corrente: do player ao boneco mirado e daí pro mais perto, até attack.jumps. { tiles, victims }.

  chainTiles(player, attack, aim) {
    const victims = aim.dummy ? [aim.dummy] : [];
    const tiles = victims.length ? lineTiles(player, victims[0]) : [];
    while (victims.length && victims.length < attack.jumps) {
      const from = victims[victims.length - 1];
      const next = this.dummies().filter(d => !victims.includes(d) && Math.max(Math.abs(d.x - from.x), Math.abs(d.y - from.y)) <= attack.jumpRange)
        .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))[0];
      if (!next) break;
      tiles.push(...lineTiles(from, next));
      victims.push(next);
    }
    return { tiles, victims };
  }

  // ================================================================================================================================================================================================================================================
  // creatureSpell
  // A magia número index da criatura, lançada pelo player: o efeito e o dano nos bonecos da área.

  creatureSpell(player, creature, index, aim, now) {
    const attack = creaturePowers(creature).attacks[index];
    if (!attack) return;
    const z = player.z || 0;
    const powers = this.sim.powers;
    const spells = this.sim.spells;
    if (attack.shape === 'heal') {
      player.currentHp = Math.max(1, Math.floor(player.hp / 2));
      spells.heal(player, powers.roll(attack));
      spells.showEffect(player.x, player.y, 'heal', undefined, z);
      return;
    }
    if (attack.shape === 'reflect') return spells.showEffect(player.x, player.y, 'poff', undefined, z);
    const chain = attack.shape === 'chain' ? this.chainTiles(player, attack, aim) : null;
    const tiles = chain ? chain.tiles : this.areaTiles(player, attack, aim);
    const aimed = ['shot', 'ball', 'ring', 'cross', 'field', 'slow'].includes(attack.shape) && !(attack.center === 'self' && attack.shape !== 'shot');
    const kind = attack.element || (attack.field && attack.field.split('/').pop().split('-')[0]);
    if (aimed) this.sim.emit({ type: 'missile', fromX: player.x, fromY: player.y, toX: aim.x, toY: aim.y, z, kind });
    if (attack.shape === 'field') {
      for (const [x, y] of tiles) this.sim.conditions.placeField(attack.field, x, y, z, player);
      return;
    }
    if (attack.shape === 'slow') return this.sim.emit({ type: 'effect', x: player.x, y: player.y, z, tiles, effect: 'poff' });
    const keys = new Set(tiles.map(([x, y]) => `${x},${y}`));
    const victims = chain ? chain.victims : this.dummies().filter(d => keys.has(`${d.x},${d.y}`));
    for (const victim of victims) spells.hurt(player, victim, powers.roll(attack), now, attack.element);
    const effect = chain ? 'energy' : attack.element;
    if (EFFECTS[effect]) this.sim.emit({ type: 'effect', x: player.x, y: player.y, z, tiles, effect });
  }
}
