// js/controllers/enemy-ai.js

import { calculateMoveDelay, distance, getAdjacentPositions, isPositionAdjacentTo, getLevel, randFloat } from '../utils/helpers.js';
import { Pathfinding } from '../utils/pathfinding.js';
import { CONFIG } from '../config.js';

export class EnemyAI {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(movementController) {
    this.movement = movementController;
  }

  // ================================================================================================================================================================================================================================================
  // isOccupiedByOther

  isOccupiedByOther(enemy, enemies, x, y) {
    return enemies.some(e => e !== enemy && e.x === x && e.y === y);
  }

  // ================================================================================================================================================================================================================================================
  // isReservedByOther
  // Sqm colado no player que outro inimigo já escolheu pra atacar (chaseTarget).

  isReservedByOther(enemy, enemies, x, y) {
    return enemies.some(e => e !== enemy && e.isChasing && e.chaseTarget &&
      e.chaseTarget.x === x && e.chaseTarget.y === y);
  }

  // ================================================================================================================================================================================================================================================
  // stepInDirection

  stepInDirection(entity, dx, dy, timestamp) {
    this.movement.faceTowards(entity, dx, dy);
    this.movement.applyStep(entity, entity.x + dx, entity.y + dy, entity.z || 0, null, timestamp);
  }

  // ================================================================================================================================================================================================================================================
  // distanceToOtherAttackers
  // Distância de (x, y) até o atacante mais próximo (outros inimigos
  // perseguindo, pelo sqm que escolheram). Sem outros atacantes: Infinity.

  distanceToOtherAttackers(enemy, enemies, x, y) {
    let nearest = Infinity;
    for (const other of enemies) {
      if (other === enemy || !other.isChasing) continue;
      const spot = other.chaseTarget || other;
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
    const entityHeight = enemy.height || 1;
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
      if (!occupied && this.movement.canMove(enemy.x, enemy.y, floor, enemy.step || 0, pos.x, pos.y, entityHeight)) {
        freePositions.push(pos);
      }
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
      this.stepInDirection(enemy, best.x - enemy.x, best.y - enemy.y, timestamp);
      enemy.chaseTarget = { x: best.x, y: best.y };
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
      .filter(e => e !== enemy && e.isChasing)
      .map(e => e.chaseTarget || { x: e.x, y: e.y });

    const candidates = [];
    for (const pos of getAdjacentPositions(playerX, playerY)) {
      if (!this.movement.isInsideMap(pos.x, pos.y)) continue;
      if (this.movement.isBlocked(pos.x, pos.y, floor, enemy)) continue;
      if (this.isReservedByOther(enemy, enemies, pos.x, pos.y)) continue;
      if (this.movement.getPassableStep(pos.x, pos.y, floor) === null) continue;
      if (this.movement.world.getTransitionAt(pos.x, pos.y, floor)) continue;

      const isCurrent = enemy.chaseTarget && enemy.chaseTarget.x === pos.x && enemy.chaseTarget.y === pos.y;
      const nearestOther = others.length ? Math.min(...others.map(o => distance(pos.x, pos.y, o.x, o.y))) : 0;
      const score = isCurrent ? -Infinity : distance(enemy.x, enemy.y, pos.x, pos.y) - CONFIG.chaseSpreadWeight * nearestOther;
      candidates.push({ x: pos.x, y: pos.y, score });
    }
    return candidates.sort((a, b) => a.score - b.score);
  }

  // ================================================================================================================================================================================================================================================
  // isHeadingToSlot
  // O inimigo tem um sqm do cerco escolhido (chaseTarget), diferente de onde
  // está, ainda colado no player e livre?

  isHeadingToSlot(enemy, playerX, playerY, enemies) {
    const target = enemy.chaseTarget;
    if (!target || (target.x === enemy.x && target.y === enemy.y)) return false;
    if (!isPositionAdjacentTo(target.x, target.y, playerX, playerY)) return false;
    return !this.movement.isBlocked(target.x, target.y, enemy.z || 0, enemy) &&
      !this.isReservedByOther(enemy, enemies, target.x, target.y);
  }

  // ================================================================================================================================================================================================================================================
  // isNextStepTaken
  // O próximo passo do caminho está com outro inimigo? Então espera; a cada
  // chaseRerouteDelay tenta um desvio contornando os inimigos (se achar, troca
  // o caminho e segue por ele). O desvio só vale enquanto o alvo for o mesmo:
  // ensureChasePath não recalcula um caminho que ainda leva ao alvo.

  isNextStepTaken(enemy, enemies, nextStep, target, timestamp, searchBounds) {
    if (!this.isOccupiedByOther(enemy, enemies, nextStep.x, nextStep.y)) return false;
    if (timestamp < (enemy.nextRerouteAt || 0)) return true;

    enemy.nextRerouteAt = timestamp + CONFIG.chaseRerouteDelay;
    const step = this.movement.getPassableStep(target.x, target.y, enemy.z || 0, enemy.step || 0);
    if (step === null) return true;
    const detour = this.movement.findPathWithFallback(enemy, target, step, searchBounds);
    if (detour.length === 0) return true;

    // Troca pro desvio e espera este quadro: followChasePath ainda está com o
    // passo antigo (ocupado) na mão; no próximo quadro segue pelo desvio.
    enemy.chasePath = detour;
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // chasePlayer
  // Vai atacar o player num sqm livre colado nele (getSurroundCandidates).
  // Devolve false se não há rota até nenhum desses sqms: aí o inimigo volta a
  // patrulhar, mesmo vendo o player. Se todos os sqms estão tomados por outros
  // inimigos, espera onde está.

  chasePlayer(enemy, player, enemies, timestamp, searchBounds = null) {
    const playerX = player.x;
    const playerY = player.y;

    // Colado no player: ataca dali — a não ser que esteja só de passagem, a
    // caminho do sqm que escolheu pra fechar o cerco (e que ainda está livre).
    const isAdjacent = isPositionAdjacentTo(enemy.x, enemy.y, playerX, playerY);
    if (isAdjacent && !this.isHeadingToSlot(enemy, playerX, playerY, enemies)) {
      enemy.chasePath = null;
      enemy.chaseTarget = { x: enemy.x, y: enemy.y };
      // Troca de lado de tempos em tempos (intervalo fixo, igual pra todo lvl).
      if (enemy.nextSidestepAt === undefined) {
        enemy.nextSidestepAt = timestamp + randFloat(CONFIG.combatSidestepIntervalMin, CONFIG.combatSidestepIntervalMax);
      }
      if (timestamp >= enemy.nextSidestepAt && timestamp - enemy.lastMoveTime >= calculateMoveDelay(enemy.spd)) {
        this.moveAroundPlayer(enemy, playerX, playerY, enemies, timestamp);
        enemy.nextSidestepAt = timestamp + randFloat(CONFIG.combatSidestepIntervalMin, CONFIG.combatSidestepIntervalMax);
      }
      return true;
    }
    enemy.nextSidestepAt = undefined;

    const candidates = this.getSurroundCandidates(enemy, playerX, playerY, enemies);
    if (candidates.length === 0) {
      // Todos tomados por outros inimigos: espera. Nenhum (paredes etc.): sem rota.
      const takenByOthers = getAdjacentPositions(playerX, playerY).some(pos =>
        this.isOccupiedByOther(enemy, enemies, pos.x, pos.y) || this.isReservedByOther(enemy, enemies, pos.x, pos.y));
      enemy.chaseTarget = null;
      enemy.chasePath = null;
      return takenByOthers;
    }

    // A rota ignora os outros inimigos (eles saem do lugar; parede não). No
    // caminho, se um deles está no próximo sqm, espera — e de tempos em tempos
    // procura um desvio em volta deles.
    for (const target of candidates) {
      if (this.movement.withEnemiesPassable(() => this.movement.ensureChasePath(enemy, target, searchBounds))) {
        enemy.chaseTarget = { x: target.x, y: target.y };
        this.movement.followChasePath(enemy, timestamp, (nextStep) =>
          this.isNextStepTaken(enemy, enemies, nextStep, target, timestamp, searchBounds));
        return true;
      }
    }

    enemy.chaseTarget = null;
    return false;
  }

  // ================================================================================================================================================================================================================================================
  // patrol
  // Passeio natural: parado um tempo → escolhe um sqm na área de patrulha →
  // anda até lá num passo mais calmo que o da perseguição → para de novo.
  // O lvl só entra na velocidade do passo (spd); pausas são iguais pra todos.

  patrol(enemy, enemies, timestamp) {
    if (enemy.patrolPath && enemy.patrolPath.length > 0) {
      this.walkPatrolPath(enemy, enemies, timestamp);
      return;
    }

    if (enemy.patrolResumeAt === undefined) {
      this.pausePatrol(enemy, timestamp);
      return;
    }
    if (timestamp < enemy.patrolResumeAt) return;

    enemy.patrolPath = this.pickPatrolPath(enemy, enemies);
    if (!enemy.patrolPath) this.pausePatrol(enemy, timestamp);
  }

  // ================================================================================================================================================================================================================================================
  // pausePatrol

  pausePatrol(enemy, timestamp) {
    enemy.patrolPath = null;
    enemy.patrolResumeAt = timestamp + randFloat(CONFIG.patrolPauseMin, CONFIG.patrolPauseMax);
  }

  // ================================================================================================================================================================================================================================================
  // pickPatrolPath
  // Sorteia um destino dentro da área de patrulha (sem escada/buraco, livre,
  // com chão) e devolve o caminho até ele, ou null se nenhum sorteio servir.

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

      const step = this.movement.getPassableStep(x, y, floor, enemy.step || 0);
      if (step === null) continue;

      const path = Pathfinding.findPath(
        enemy.x, enemy.y, x, y,
        (nx, ny) => this.movement.isBlockedForPathing(nx, ny, floor),
        enemy.step || 0, step, this.movement, bounds, floor
      );
      if (path.length > 0) return path;
    }
    return null;
  }

  // ================================================================================================================================================================================================================================================
  // walkPatrolPath

  walkPatrolPath(enemy, enemies, timestamp) {
    const stepInterval = enemy.getMoveDuration() * CONFIG.patrolWalkStepFactor;
    if (timestamp - enemy.lastMoveTime < stepInterval) return;

    const next = enemy.patrolPath[0];
    const floor = enemy.z || 0;
    const blocked = this.isOccupiedByOther(enemy, enemies, next.x, next.y) ||
      !this.movement.canMove(enemy.x, enemy.y, floor, enemy.step || 0, next.x, next.y, enemy.height || 1, next.step);
    if (blocked) {
      this.pausePatrol(enemy, timestamp);
      return;
    }

    this.movement.faceTowards(enemy, next.x - enemy.x, next.y - enemy.y);
    this.movement.applyStep(enemy, next.x, next.y, floor, next.step, timestamp);
    enemy.patrolPath.shift();
    if (enemy.patrolPath.length === 0) this.pausePatrol(enemy, timestamp);
  }

  // ================================================================================================================================================================================================================================================
  // update

  // Vendo o player (mesmo andar, no raio de detecção) persegue; sem rota até
  // ele, volta a patrulhar e só tenta de novo depois de chaseRetryDelay.

  update(enemy, player, enemies, timestamp, searchBounds = null) {
    const playerInDetection = getLevel(enemy) === getLevel(player) && enemy.isInDetectionRange(player.x, player.y);
    const waitingRetry = enemy.noRouteUntil !== undefined && timestamp < enemy.noRouteUntil;

    if (playerInDetection && !waitingRetry) {
      const wasChasing = enemy.isChasing;
      enemy.isChasing = true;
      if (this.chasePlayer(enemy, player, enemies, timestamp, searchBounds)) {
        if (!wasChasing) {
          enemy.patrolPath = null;
          console.log(`👁️ Inimigo ${enemy.id} detectou o player`);
        }
        return;
      }
      enemy.isChasing = wasChasing;
      enemy.noRouteUntil = timestamp + CONFIG.chaseRetryDelay;
      console.log(`🚧 Inimigo ${enemy.id} não tem rota até o player: volta a patrulhar`);
    }

    if (enemy.isChasing) {
      enemy.isChasing = false;
      enemy.chasePath = null;
      enemy.chaseTarget = null;
      enemy.nextSidestepAt = undefined;
      enemy.updatePatrolCenter();
      this.pausePatrol(enemy, timestamp);
    }
    this.patrol(enemy, enemies, timestamp);
  }
}
