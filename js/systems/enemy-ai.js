// js/systems/enemy-ai.js

import { calculateMoveDelay, distance, getAdjacentPositions, isPositionAdjacentTo, randFloat } from '../utils/helpers.js';
import { getLevel } from '../core/geometry.js';
import { AI_STATE } from '../models/enemy.js';
import { CONFIG } from '../config.js';
import { creatureBehavior } from '../../shared/assets.js';
import { hasHarmfulField } from '../core/pathfinding.js';

// Sem caminho até o player parado no mesmo sqm: tenta de novo só depois disso (ms).
const CHASE_STUCK_RETRY_MS = 8000;
// Espalha as novas tentativas no tempo, pra não caírem todas no mesmo instante.
const CHASE_RETRY_JITTER_MS = 1000;
// Sqm reservado por quem está parado há mais que isso (preso atrás de outro)
// deixa de valer pros outros.
const SLOT_STALE_MS = 1500;

// Máquina de estados de cada inimigo (enemy.ai):
//
//   patrol ──(vê o player e tem rota)──▶ chase
//   chase ──(perdeu o player de vista ou ficou sem rota)──▶ patrol
//   qualquer um ──(vê o player com a vida no limite de fuga)──▶ flee
//   pacífico (comportamento 'pacifico', ex.: deer) ──(vê o player)──▶ flee
//   flee ──(perdeu o player de vista)──▶ patrol
// Mago (comportamento 'mago'), vendo o player, fica em chase mas não cola:
// mantém entre mageKeepDistance e mageRange sqm e ataca de longe (combat.js).
//
// patrol: anda até um sqm sorteado da área e, ao chegar, já sorteia o próximo (a pausa
// entre passeios, ai.resumeAt, é CONFIG.patrolPauseMin/Max: 0 = nunca para).
// chase: vai pra um sqm livre colado no player (ai.slot), ataca dali e de
// tempos em tempos troca de lado (ai.sidestepAt). Sem rota até o player
// (parede, casa fechada), volta a patrulhar na hora e só tenta de novo em
// ai.retryAt (ou mais tarde, se o player não saiu do lugar: ai.blocked).
// O caminho seguido, em qualquer estado, fica em enemy.route.

export class EnemyAI {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(movementController) {
    this.movement = movementController;
    this.now = 0;
  }

  // ================================================================================================================================================================================================================================================
  // update
  // Vendo o player (mesmo andar, no raio de detecção, fora da zona segura)
  // persegue; senão patrulha.

  update(enemy, player, enemies, timestamp, searchBounds = null) {
    this.now = timestamp;
    const seesPlayer = !!player && !this.movement.world.isInSafeZone(player) &&
      getLevel(enemy) === getLevel(player) && enemy.isInDetectionRange(player.x, player.y);

    if (seesPlayer && this.shouldFlee(enemy)) {
      this.flee(enemy, player, enemies, timestamp);
      return;
    }
    if (enemy.ai.state === AI_STATE.FLEE) {
      this.enterPatrol(enemy, timestamp);
    }
    if (seesPlayer && creatureBehavior(enemy.creature) === 'mago') {
      this.keepDistance(enemy, player, enemies, timestamp, searchBounds);
      return;
    }

    if (enemy.ai.state === AI_STATE.CHASE) {
      this.updateChase(enemy, player, enemies, timestamp, searchBounds, seesPlayer);
    } else {
      this.updatePatrol(enemy, player, enemies, timestamp, searchBounds, seesPlayer);
    }
  }

  // ================================================================================================================================================================================================================================================
  // shouldFlee
  // Criatura 'pacifico' sempre; 'foge' (gerador → Criaturas) com a vida em
  // até fleeHealth.

  shouldFlee(enemy) {
    const behavior = creatureBehavior(enemy.creature);
    if (behavior === 'pacifico') return true;
    if (behavior !== 'foge') return false;
    return enemy.currentHp > 0 && enemy.currentHp <= enemy.maxHp * CONFIG.fleeHealth;
  }

  // ================================================================================================================================================================================================================================================
  // flee
  // Fugindo: não ataca e, a cada passo, se afasta do player (stepAway).

  flee(enemy, player, enemies, timestamp) {
    if (enemy.ai.state !== AI_STATE.FLEE) {
      enemy.ai.state = AI_STATE.FLEE;
      enemy.ai.slot = null;
      enemy.ai.sidestepAt = null;
      enemy.route = { path: null, x: null, y: null };
      console.log(`🏃 Inimigo ${enemy.id} fugindo com ${enemy.currentHp}/${enemy.maxHp} de vida`);
    }
    this.stepAway(enemy, player, enemies, timestamp);
  }

  // ================================================================================================================================================================================================================================================
  // stepAway
  // Um passo pro sqm vizinho livre que mais afasta do player. Encurralado
  // (nenhum sqm afasta), fica parado. false se não andou.

  stepAway(enemy, player, enemies, timestamp) {
    if (timestamp - enemy.lastMoveTime < calculateMoveDelay(enemy.spd)) return false;
    let best = null;
    let bestDist = distance(enemy.x, enemy.y, player.x, player.y);
    for (const pos of getAdjacentPositions(enemy.x, enemy.y)) {
      const dx = pos.x - enemy.x;
      const dy = pos.y - enemy.y;
      const landing = this.movement.resolveStep(enemy, dx, dy, { sameFloor: true });
      if (!landing || this.isOccupiedByOther(enemy, enemies, landing.x, landing.y)) continue;
      const d = distance(landing.x, landing.y, player.x, player.y);
      if (d > bestDist) { bestDist = d; best = { dx, dy }; }
    }
    return best ? this.movement.moveEntity(enemy, best.dx, best.dy, timestamp) : false;
  }

  // ================================================================================================================================================================================================================================================
  // keepDistance
  // Mago vendo o player: perto demais (menos de mageKeepDistance sqm), se
  // afasta; longe demais (mais de mageRange) ou sem linha livre, chega mais
  // perto; na faixa, fica parado atacando (combat.js).

  keepDistance(enemy, player, enemies, timestamp, searchBounds) {
    enemy.ai.state = AI_STATE.CHASE;
    enemy.ai.slot = null;
    enemy.ai.sidestepAt = null;
    const range = Math.max(Math.abs(enemy.x - player.x), Math.abs(enemy.y - player.y));
    if (range < CONFIG.mageKeepDistance) {
      this.stepAway(enemy, player, enemies, timestamp);
      return;
    }
    if (range > CONFIG.mageRange || !this.movement.hasLineOfSight(enemy, player)) {
      this.movement.moveTowardsPosition(enemy, player.x, player.y, timestamp, player, searchBounds, enemies);
      return;
    }
    enemy.route = { path: null, x: null, y: null };
  }

  // ================================================================================================================================================================================================================================================
  // updatePatrol

  updatePatrol(enemy, player, enemies, timestamp, searchBounds, seesPlayer) {
    if (seesPlayer && this.canRetryChase(enemy, player, timestamp)) {
      const patrolRoute = enemy.route;
      enemy.ai.state = AI_STATE.CHASE;
      enemy.route = { path: null, x: null, y: null };
      if (this.chasePlayer(enemy, player, enemies, timestamp, searchBounds)) {
        console.log(`👁️ Inimigo ${enemy.id} detectou o player`);
        return;
      }
      enemy.ai.state = AI_STATE.PATROL;
      enemy.route = patrolRoute;
      this.giveUpChase(enemy, player, timestamp);
    }
    this.patrol(enemy, enemies, timestamp);
  }

  // ================================================================================================================================================================================================================================================
  // updateChase

  updateChase(enemy, player, enemies, timestamp, searchBounds, seesPlayer) {
    if (seesPlayer) {
      if (this.chasePlayer(enemy, player, enemies, timestamp, searchBounds)) return;
      this.giveUpChase(enemy, player, timestamp);
      this.enterPatrol(enemy, timestamp, { pause: false });
    } else {
      this.enterPatrol(enemy, timestamp);
    }
    this.patrol(enemy, enemies, timestamp);
  }

  // ================================================================================================================================================================================================================================================
  // giveUpChase
  // Sem rota até o player: só tenta de novo depois de chaseRetryDelay (mais um
// tanto sorteado, CHASE_RETRY_JITTER_MS) — e,
  // se o player continuar no mesmo sqm, só depois de CHASE_STUCK_RETRY_MS
  // (canRetryChase).

  giveUpChase(enemy, player, timestamp) {
    enemy.ai.retryAt = timestamp + CONFIG.chaseRetryDelay + randFloat(0, CHASE_RETRY_JITTER_MS);
    enemy.ai.blocked = { x: player.x, y: player.y, until: timestamp + CHASE_STUCK_RETRY_MS };
    console.log(`🚧 Inimigo ${enemy.id} não tem rota até o player: volta a patrulhar`);
  }

  // ================================================================================================================================================================================================================================================
  // canRetryChase

  canRetryChase(enemy, player, timestamp) {
    if (timestamp < enemy.ai.retryAt) return false;
    const blocked = enemy.ai.blocked;
    return !blocked || blocked.x !== player.x || blocked.y !== player.y || timestamp >= blocked.until;
  }

  // ================================================================================================================================================================================================================================================
  // enterPatrol
  // Sai da perseguição: a área de patrulha passa a ser em volta de onde parou.
  // Perdeu o player de vista, para um pouco; sem caminho até ele (pause:
  // false), já sai andando.

  enterPatrol(enemy, timestamp, { pause = true } = {}) {
    enemy.ai.state = AI_STATE.PATROL;
    enemy.ai.slot = null;
    enemy.ai.sidestepAt = null;
    enemy.updatePatrolCenter();
    if (pause) this.pausePatrol(enemy, timestamp);
    else {
      enemy.route.path = null;
      enemy.ai.resumeAt = timestamp;
    }
  }

  // ================================================================================================================================================================================================================================================
  // isOccupiedByOther

  isOccupiedByOther(enemy, enemies, x, y) {
    return enemies.some(e => e !== enemy && e.x === x && e.y === y);
  }

  // ================================================================================================================================================================================================================================================
  // otherSlots
  // Sqms colados no player que os outros inimigos em perseguição escolheram
  // e ainda valem: o outro já está nele, ou andou (ou escolheu o sqm) há
  // menos de SLOT_STALE_MS e está tão perto do sqm quanto este inimigo
  // (empate: o de id menor). Quem ficou preso no caminho, ou está mais
  // longe, não segura o sqm.

  otherSlots(enemy, enemies) {
    const gap = (e, slot) => Math.max(Math.abs(e.x - slot.x), Math.abs(e.y - slot.y));
    return enemies.filter(e => {
      const slot = e.ai.slot;
      if (e === enemy || e.ai.state !== AI_STATE.CHASE || !slot) return false;
      if (e.x === slot.x && e.y === slot.y) return true;
      if (this.now - Math.max(e.lastMoveTime || 0, e.ai.slotAt || 0) > SLOT_STALE_MS) return false;
      const mine = gap(enemy, slot);
      const theirs = gap(e, slot);
      return theirs < mine || (theirs === mine && e.id < enemy.id);
    }).map(e => e.ai.slot);
  }

  // ================================================================================================================================================================================================================================================
  // isReservedByOther

  isReservedByOther(enemy, enemies, x, y) {
    return this.otherSlots(enemy, enemies).some(slot => slot.x === x && slot.y === y);
  }

  // ================================================================================================================================================================================================================================================
  // distanceToOtherAttackers
  // Distância de (x, y) até o atacante mais próximo (outros inimigos
  // perseguindo, pelo sqm que escolheram). Sem outros atacantes: Infinity.

  distanceToOtherAttackers(enemy, enemies, x, y) {
    let nearest = Infinity;
    for (const other of enemies) {
      if (other === enemy || other.ai.state !== AI_STATE.CHASE) continue;
      const spot = other.ai.slot || other;
      nearest = Math.min(nearest, distance(x, y, spot.x, spot.y));
    }
    return nearest;
  }

  // ================================================================================================================================================================================================================================================
  // moveAroundPlayer
  // Colado no player, de tempos em tempos: passa pra um sqm vizinho (também
  // colado no player e livre). Prefere o que fica mais longe dos outros
  // atacantes (abre o cerco); se nenhum melhora, sorteia um dos livres. Sem
  // sqm livre em volta, fica onde está.

  moveAroundPlayer(enemy, playerX, playerY, enemies, timestamp) {
    const floor = enemy.z || 0;
    const freePositions = [];
    for (const pos of getAdjacentPositions(playerX, playerY)) {
      if (!this.movement.isInsideMap(pos.x, pos.y)) continue;
      if (this.movement.isBlocked(pos.x, pos.y, floor, enemy)) continue;
      if (pos.x === enemy.x && pos.y === enemy.y) continue;
      const isSingleStep = Math.abs(pos.x - enemy.x) <= 1 && Math.abs(pos.y - enemy.y) <= 1;
      if (!isSingleStep) continue;
      const occupied = this.isOccupiedByOther(enemy, enemies, pos.x, pos.y) ||
        this.isReservedByOther(enemy, enemies, pos.x, pos.y);
      if (occupied) continue;
      if (this.movement.world.getTransitionAt(pos.x, pos.y, floor)) continue;
      const dx = pos.x - enemy.x;
      const dy = pos.y - enemy.y;
      const landing = this.movement.resolveStep(enemy, dx, dy, { sameFloor: true });
      if (landing) freePositions.push({ ...landing, dx, dy });
    }
    if (freePositions.length === 0) return;

    let best = null;
    let bestSpread = this.distanceToOtherAttackers(enemy, enemies, enemy.x, enemy.y);
    for (const pos of freePositions) {
      const spread = this.distanceToOtherAttackers(enemy, enemies, pos.x, pos.y);
      if (spread > bestSpread + 0.1) {
        best = pos;
        bestSpread = spread;
      }
    }
    if (!best) best = freePositions[Math.floor(Math.random() * freePositions.length)];

    this.movement.stepAlongPath(enemy, best, timestamp);
    enemy.ai.slot = { x: best.x, y: best.y };
  }

  // ================================================================================================================================================================================================================================================
  // getSurroundCandidates
  // Sqms livres colados no player, do melhor pro pior pra fechar o cerco: o
  // que o inimigo já tinha escolhido vem primeiro (não fica trocando); os
  // outros, perto do inimigo e longe dos outros atacantes (espalham em volta).
  // Sqm ocupado, já reservado por outro inimigo ou em zona segura fica de fora.

  getSurroundCandidates(enemy, playerX, playerY, enemies) {
    const floor = enemy.z || 0;
    const others = enemies
      .filter(e => e !== enemy && e.ai.state === AI_STATE.CHASE)
      .map(e => e.ai.slot || { x: e.x, y: e.y });

    const candidates = [];
    for (const pos of getAdjacentPositions(playerX, playerY)) {
      if (!this.movement.isInsideMap(pos.x, pos.y)) continue;
      if (this.movement.isBlocked(pos.x, pos.y, floor, enemy)) continue;
      if (this.isReservedByOther(enemy, enemies, pos.x, pos.y)) continue;
      if (this.movement.world.isSafe(pos.x, pos.y, floor)) continue;
      if (this.movement.getPassableStep(pos.x, pos.y, floor) === null) continue;
      if (this.movement.world.getTransitionAt(pos.x, pos.y, floor)) continue;

      const slot = enemy.ai.slot;
      const isCurrent = slot && slot.x === pos.x && slot.y === pos.y;
      const nearestOther = others.length ? Math.min(...others.map(o => distance(pos.x, pos.y, o.x, o.y))) : 0;
      const score = isCurrent ? -Infinity : distance(enemy.x, enemy.y, pos.x, pos.y) - CONFIG.chaseSpreadWeight * nearestOther;
      candidates.push({ x: pos.x, y: pos.y, score });
    }
    return candidates.sort((a, b) => a.score - b.score);
  }

  // ================================================================================================================================================================================================================================================
  // isHeadingToSlot
  // O inimigo tem um sqm do cerco escolhido (ai.slot), diferente de onde
  // está, ainda colado no player e livre?

  isHeadingToSlot(enemy, playerX, playerY, enemies) {
    const slot = enemy.ai.slot;
    if (!slot || (slot.x === enemy.x && slot.y === enemy.y)) return false;
    if (!isPositionAdjacentTo(slot.x, slot.y, playerX, playerY)) return false;
    return !this.movement.isBlocked(slot.x, slot.y, enemy.z || 0, enemy) &&
      !this.movement.world.isSafe(slot.x, slot.y, enemy.z || 0) &&
      !this.isReservedByOther(enemy, enemies, slot.x, slot.y);
  }

  // ================================================================================================================================================================================================================================================
  // isNextStepTaken
  // O próximo passo do caminho está com outro inimigo? Então espera; a cada
  // chaseRerouteDelay tenta um desvio contornando os inimigos (se achar, troca
  // o caminho e segue por ele). O desvio só vale enquanto o alvo for o mesmo:
  // ensureRoute não recalcula um caminho que ainda leva ao alvo.

  isNextStepTaken(enemy, enemies, nextStep, target, timestamp, searchBounds) {
    if (!this.isOccupiedByOther(enemy, enemies, nextStep.x, nextStep.y)) return false;
    if (timestamp < enemy.ai.rerouteAt) return true;

    enemy.ai.rerouteAt = timestamp + CONFIG.chaseRerouteDelay;
    if (this.movement.getPassableStep(target.x, target.y, enemy.z || 0, enemy.step || 0) === null) return true;
    const detour = this.movement.findPathWithFallback(enemy, target, searchBounds, { chase: true });
    if (detour.length === 0) return true;

    enemy.route.path = detour;
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // engagePlayer
  // Colado no player: ataca dali e troca de lado de tempos em tempos
  // (intervalo fixo, igual pra todo lvl).

  engagePlayer(enemy, player, enemies, timestamp) {
    enemy.route.path = null;
    enemy.ai.slot = { x: enemy.x, y: enemy.y };
    if (enemy.ai.sidestepAt === null) {
      enemy.ai.sidestepAt = timestamp + randFloat(CONFIG.combatSidestepIntervalMin, CONFIG.combatSidestepIntervalMax);
    }
    if (timestamp >= enemy.ai.sidestepAt && timestamp - enemy.lastMoveTime >= calculateMoveDelay(enemy.spd)) {
      this.moveAroundPlayer(enemy, player.x, player.y, enemies, timestamp);
      enemy.ai.sidestepAt = timestamp + randFloat(CONFIG.combatSidestepIntervalMin, CONFIG.combatSidestepIntervalMax);
    }
  }

  // ================================================================================================================================================================================================================================================
  // chasePlayer
  // Vai atacar o player num sqm livre colado nele (getSurroundCandidates).
  // Colado no player, ataca dali — a não ser que esteja só de passagem, a
  // caminho do sqm que escolheu (e que ainda está livre).
  // Devolve false se não há rota até nenhum desses sqms. Se todos os sqms
  // estão tomados por outros inimigos, espera onde está.
  // A rota ignora os outros inimigos (eles saem do lugar; parede não). No
  // caminho, se um deles está no próximo sqm, espera — e de tempos em tempos
  // procura um desvio em volta deles.

  chasePlayer(enemy, player, enemies, timestamp, searchBounds = null) {
    const isAdjacent = isPositionAdjacentTo(enemy.x, enemy.y, player.x, player.y);
    if (isAdjacent && !this.isHeadingToSlot(enemy, player.x, player.y, enemies)) {
      this.engagePlayer(enemy, player, enemies, timestamp);
      return true;
    }
    enemy.ai.sidestepAt = null;

    const candidates = this.getSurroundCandidates(enemy, player.x, player.y, enemies);
    if (candidates.length === 0) {
      const takenByOthers = getAdjacentPositions(player.x, player.y).some(pos =>
        this.isOccupiedByOther(enemy, enemies, pos.x, pos.y) || this.isReservedByOther(enemy, enemies, pos.x, pos.y));
      enemy.ai.slot = null;
      enemy.route.path = null;
      return takenByOthers;
    }

    const first = candidates[0];
    const keepsRoute = this.movement.withEnemiesPassable(() => {
      const route = enemy.route;
      const onIt = route.path && route.path.length && route.x === first.x && route.y === first.y;
      return onIt && this.movement.ensureRoute(enemy, first, searchBounds, { chase: true });
    });
    const target = keepsRoute ? first : this.movement.withEnemiesPassable(() => this.movement.routeToAny(enemy, candidates, searchBounds));
    if (!target) {
      enemy.ai.slot = null;
      return false;
    }
    const slot = enemy.ai.slot;
    if (!slot || slot.x !== target.x || slot.y !== target.y) enemy.ai.slotAt = timestamp;
    enemy.ai.slot = { x: target.x, y: target.y };
    this.movement.followRoute(enemy, timestamp, (nextStep) =>
      this.isNextStepTaken(enemy, enemies, nextStep, target, timestamp, searchBounds));
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // patrol
  // Passeio natural: escolhe um sqm na área de patrulha → anda até lá no mesmo
  // passo da perseguição → escolhe o próximo (com CONFIG.patrolPauseMin/Max > 0,
  // para um tempo antes).
  // O lvl só entra na velocidade do passo (spd); pausas são iguais pra todos.

  patrol(enemy, enemies, timestamp) {
    if (enemy.route.path && enemy.route.path.length > 0) {
      this.walkPatrolPath(enemy, enemies, timestamp);
      return;
    }

    if (enemy.ai.resumeAt === null) {
      this.pausePatrol(enemy, timestamp);
      return;
    }
    if (timestamp < enemy.ai.resumeAt) return;

    if (!this.pickPatrolPath(enemy, enemies)) this.pausePatrol(enemy, timestamp, { retry: true });
  }

  // ================================================================================================================================================================================================================================================
  // pausePatrol

  pausePatrol(enemy, timestamp, { retry = false } = {}) {
    enemy.route.path = null;
    const pause = randFloat(CONFIG.patrolPauseMin, CONFIG.patrolPauseMax);
    enemy.ai.resumeAt = timestamp + (retry ? Math.max(pause, CONFIG.patrolRetryMs) : pause);
  }

  // ================================================================================================================================================================================================================================================
  // pickPatrolPath
  // Sorteia um destino entre os sqms da área de patrulha onde dá pra parar
  // (sem escada/buraco, fora da zona segura, livre, com chão) e põe o caminho
  // até ele em enemy.route. Num corredor estreito, só os sqms do corredor
  // entram no sorteio. false se nenhum deles tiver caminho.

  pickPatrolPath(enemy, enemies) {
    const floor = enemy.z || 0;
    const radius = Math.floor(enemy.patrolRadius);
    const bounds = {
      minX: enemy.patrolCenterX - radius - 1, maxX: enemy.patrolCenterX + radius + 2,
      minY: enemy.patrolCenterY - radius - 1, maxY: enemy.patrolCenterY + radius + 2
    };
    const spots = [];
    for (let x = enemy.patrolCenterX - radius; x <= enemy.patrolCenterX + radius; x++) {
      for (let y = enemy.patrolCenterY - radius; y <= enemy.patrolCenterY + radius; y++) {
        if (x === enemy.x && y === enemy.y) continue;
        if (!this.movement.isInsideMap(x, y) || !enemy.isInPatrolZone(x, y)) continue;
        if (this.movement.isBlocked(x, y, floor, enemy) || this.isOccupiedByOther(enemy, enemies, x, y)) continue;
        if (this.movement.world.getTransitionAt(x, y, floor) || this.movement.world.isSafe(x, y, floor) || hasHarmfulField(this.movement.world, x, y, floor)) continue;
        if (this.movement.getPassableStep(x, y, floor, enemy.step || 0) === null) continue;
        spots.push({ x, y });
      }
    }

    for (let attempt = 0; attempt < 8 && spots.length; attempt++) {
      const { x, y } = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
      const path = this.movement.findPath(enemy, { x, y, z: floor }, { sameFloor: true, bounds });
      if (path.length > 0) {
        enemy.route = { path, x, y };
        return true;
      }
    }
    return false;
  }

  // ================================================================================================================================================================================================================================================
  // walkPatrolPath

  walkPatrolPath(enemy, enemies, timestamp) {
    if (timestamp - enemy.lastMoveTime < calculateMoveDelay(enemy.spd)) return;

    const next = enemy.route.path[0];
    const blocked = this.isOccupiedByOther(enemy, enemies, next.x, next.y) ||
      !this.movement.stepAlongPath(enemy, next, timestamp);
    if (blocked) {
      this.pausePatrol(enemy, timestamp, { retry: true });
      return;
    }

    enemy.route.path.shift();
    if (enemy.route.path.length === 0) this.pausePatrol(enemy, timestamp);
  }
}
