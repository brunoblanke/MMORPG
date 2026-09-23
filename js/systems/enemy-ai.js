// js/systems/enemy-ai.js

import { calculateMoveDelay, distance, getAdjacentPositions, isPositionAdjacentTo, randFloat } from '../utils/helpers.js';
import { getLevel } from '../core/geometry.js';
import { AI_STATE } from '../models/enemy.js';
import { CONFIG } from '../config.js';

// Máquina de estados de cada inimigo (enemy.ai):
//
//   patrol ──(vê o player e tem rota)──▶ chase
//   chase ──(perdeu o player de vista ou ficou sem rota)──▶ patrol
//
// patrol: parado (ai.resumeAt) → anda até um sqm sorteado da área → para.
// chase: vai pra um sqm livre colado no player (ai.slot), ataca dali e de
// tempos em tempos troca de lado (ai.sidestepAt). Sem rota até o player
// (parede, casa fechada), volta a patrulhar e só tenta de novo em ai.retryAt.
// O caminho seguido, em qualquer estado, fica em enemy.route.

export class EnemyAI {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(movementController) {
    this.movement = movementController;
  }

  // ================================================================================================================================================================================================================================================
  // update
  // Vendo o player (mesmo andar, no raio de detecção, fora da zona segura)
  // persegue; senão patrulha.

  update(enemy, player, enemies, timestamp, searchBounds = null) {
    const seesPlayer = !!player && !this.movement.world.isInSafeZone(player) &&
      getLevel(enemy) === getLevel(player) && enemy.isInDetectionRange(player.x, player.y);

    if (enemy.ai.state === AI_STATE.CHASE) {
      this.updateChase(enemy, player, enemies, timestamp, searchBounds, seesPlayer);
    } else {
      this.updatePatrol(enemy, player, enemies, timestamp, searchBounds, seesPlayer);
    }
  }

  // ================================================================================================================================================================================================================================================
  // updatePatrol

  updatePatrol(enemy, player, enemies, timestamp, searchBounds, seesPlayer) {
    if (seesPlayer && timestamp >= enemy.ai.retryAt) {
      const patrolRoute = enemy.route;
      enemy.ai.state = AI_STATE.CHASE;
      enemy.route = { path: null, x: null, y: null };
      if (this.chasePlayer(enemy, player, enemies, timestamp, searchBounds)) {
        console.log(`👁️ Inimigo ${enemy.id} detectou o player`);
        return;
      }
      enemy.ai.state = AI_STATE.PATROL;
      enemy.route = patrolRoute;
      this.giveUpChase(enemy, timestamp);
    }
    this.patrol(enemy, enemies, timestamp);
  }

  // ================================================================================================================================================================================================================================================
  // updateChase

  updateChase(enemy, player, enemies, timestamp, searchBounds, seesPlayer) {
    if (seesPlayer) {
      if (this.chasePlayer(enemy, player, enemies, timestamp, searchBounds)) return;
      this.giveUpChase(enemy, timestamp);
    }
    this.enterPatrol(enemy, timestamp);
    this.patrol(enemy, enemies, timestamp);
  }

  // ================================================================================================================================================================================================================================================
  // giveUpChase
  // Sem rota até o player: só tenta de novo depois de chaseRetryDelay.

  giveUpChase(enemy, timestamp) {
    enemy.ai.retryAt = timestamp + CONFIG.chaseRetryDelay;
    console.log(`🚧 Inimigo ${enemy.id} não tem rota até o player: volta a patrulhar`);
  }

  // ================================================================================================================================================================================================================================================
  // enterPatrol
  // Sai da perseguição: a área de patrulha passa a ser em volta de onde parou.

  enterPatrol(enemy, timestamp) {
    enemy.ai.state = AI_STATE.PATROL;
    enemy.ai.slot = null;
    enemy.ai.sidestepAt = null;
    enemy.updatePatrolCenter();
    this.pausePatrol(enemy, timestamp);
  }

  // ================================================================================================================================================================================================================================================
  // isOccupiedByOther

  isOccupiedByOther(enemy, enemies, x, y) {
    return enemies.some(e => e !== enemy && e.x === x && e.y === y);
  }

  // ================================================================================================================================================================================================================================================
  // otherSlots
  // Sqms colados no player que os outros inimigos em perseguição escolheram.

  otherSlots(enemy, enemies) {
    return enemies.filter(e => e !== enemy && e.ai.state === AI_STATE.CHASE && e.ai.slot).map(e => e.ai.slot);
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
  // colado no player) que fique mais longe dos outros atacantes — abre o
  // cerco. Se nenhum melhora, fica onde está.

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
      const dx = pos.x - enemy.x;
      const dy = pos.y - enemy.y;
      const landing = this.movement.resolveStep(enemy, dx, dy, { sameFloor: true });
      if (landing) freePositions.push({ ...landing, dx, dy });
    }

    let best = null;
    let bestSpread = this.distanceToOtherAttackers(enemy, enemies, enemy.x, enemy.y);
    for (const pos of freePositions) {
      const spread = this.distanceToOtherAttackers(enemy, enemies, pos.x, pos.y);
      if (spread > bestSpread + 0.1) {
        best = pos;
        bestSpread = spread;
      }
    }
    if (best) {
      this.movement.stepAlongPath(enemy, best, timestamp);
      enemy.ai.slot = { x: best.x, y: best.y };
    }
  }

  // ================================================================================================================================================================================================================================================
  // getSurroundCandidates
  // Sqms livres colados no player, do melhor pro pior pra fechar o cerco: o
  // que o inimigo já tinha escolhido vem primeiro (não fica trocando); os
  // outros, perto do inimigo e longe dos outros atacantes (espalham em volta).
  // Sqm ocupado ou já reservado por outro inimigo fica de fora.

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
    const detour = this.movement.findPathWithFallback(enemy, target, searchBounds);
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

    for (const target of candidates) {
      if (this.movement.withEnemiesPassable(() => this.movement.ensureRoute(enemy, target, searchBounds))) {
        enemy.ai.slot = { x: target.x, y: target.y };
        this.movement.followRoute(enemy, timestamp, (nextStep) =>
          this.isNextStepTaken(enemy, enemies, nextStep, target, timestamp, searchBounds));
        return true;
      }
    }

    enemy.ai.slot = null;
    return false;
  }

  // ================================================================================================================================================================================================================================================
  // patrol
  // Passeio natural: parado um tempo → escolhe um sqm na área de patrulha →
  // anda até lá num passo mais calmo que o da perseguição → para de novo.
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

    if (!this.pickPatrolPath(enemy, enemies)) this.pausePatrol(enemy, timestamp);
  }

  // ================================================================================================================================================================================================================================================
  // pausePatrol

  pausePatrol(enemy, timestamp) {
    enemy.route.path = null;
    enemy.ai.resumeAt = timestamp + randFloat(CONFIG.patrolPauseMin, CONFIG.patrolPauseMax);
  }

  // ================================================================================================================================================================================================================================================
  // pickPatrolPath
  // Sorteia um destino dentro da área de patrulha (sem escada/buraco, livre,
  // com chão) e põe o caminho até ele em enemy.route. false se nenhum sorteio servir.

  pickPatrolPath(enemy, enemies) {
    const floor = enemy.z || 0;
    const radius = Math.floor(enemy.patrolRadius);
    const bounds = {
      minX: enemy.patrolCenterX - radius - 1, maxX: enemy.patrolCenterX + radius + 2,
      minY: enemy.patrolCenterY - radius - 1, maxY: enemy.patrolCenterY + radius + 2
    };

    for (let attempt = 0; attempt < 8; attempt++) {
      const x = enemy.patrolCenterX + Math.round(randFloat(-radius, radius));
      const y = enemy.patrolCenterY + Math.round(randFloat(-radius, radius));
      if (x === enemy.x && y === enemy.y) continue;
      if (!this.movement.isInsideMap(x, y) || !enemy.isInPatrolZone(x, y)) continue;
      if (this.movement.isBlocked(x, y, floor, enemy) || this.isOccupiedByOther(enemy, enemies, x, y)) continue;
      if (this.movement.world.getTransitionAt(x, y, floor)) continue;
      if (this.movement.getPassableStep(x, y, floor, enemy.step || 0) === null) continue;

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
    const stepInterval = enemy.getMoveDuration() * CONFIG.patrolWalkStepFactor;
    if (timestamp - enemy.lastMoveTime < stepInterval) return;

    const next = enemy.route.path[0];
    const blocked = this.isOccupiedByOther(enemy, enemies, next.x, next.y) ||
      !this.movement.stepAlongPath(enemy, next, timestamp);
    if (blocked) {
      this.pausePatrol(enemy, timestamp);
      return;
    }

    enemy.route.path.shift();
    if (enemy.route.path.length === 0) this.pausePatrol(enemy, timestamp);
  }
}
