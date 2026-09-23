// js/systems/player-control.js

import { calculateMoveDelay, getAdjacentPositions } from '../utils/helpers.js';

// Comandos que um jogador manda pra simulação (hoje pelo teclado/mouse; no
// multiplayer, pela rede). Todos têm `type`:
//   { type: 'walkDir', dx, dy }          andar numa direção enquanto a tecla está
//                                        apertada; dx = dy = 0 para
//   { type: 'walkTo', x, y, z }          andar até o sqm (clique no chão); no
//                                        próprio sqm, desce da pilha
//   { type: 'attack', targetId }         escolher inimigo como alvo (null tira)
//   { type: 'toggleFollow' }             liga/desliga seguir o alvo
//   { type: 'moveItem', itemId, x, y, z } arrastar item/cadáver pro sqm

export class PlayerControl {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(sim) {
    this.sim = sim;
  }

  // ================================================================================================================================================================================================================================================
  // handle

  handle(player, command) {
    switch (command.type) {
      case 'walkDir': return this.setWalkDir(player, command.dx || 0, command.dy || 0);
      case 'walkTo': return this.walkTo(player, command.x, command.y, command.z);
      case 'attack': return this.setAttackTarget(player, command.targetId);
      case 'toggleFollow': return this.toggleFollow(player);
      case 'moveItem': return this.moveItem(player, command.itemId, command.x, command.y, command.z);
      default: console.warn('Comando desconhecido:', command);
    }
  }

  // ================================================================================================================================================================================================================================================
  // setWalkDir
  // Tecla de direção apertada: larga o caminho do clique e, com alvo, para de segui-lo.

  setWalkDir(player, dx, dy) {
    if (dx === 0 && dy === 0) {
      player.walkDir = null;
      return;
    }
    player.walkDir = { dx, dy };
    this.clearWalk(player);
    if (player.target) {
      player.autoFollow = false;
      console.log('⌨️ Auto-follow desligado por tecla');
    }
  }

  // ================================================================================================================================================================================================================================================
  // clearWalk

  clearWalk(player) {
    player.walk = { target: null, path: [] };
  }

  // ================================================================================================================================================================================================================================================
  // isWalking

  isWalking(player) {
    return player.walk.path.length > 0;
  }

  // ================================================================================================================================================================================================================================================
  // walkTo
  // Clique no chão. No próprio sqm, com o player em cima de algo: desce pro vizinho mais baixo.

  walkTo(player, x, y, z) {
    if (!this.sim.movement.isInsideMap(x, y)) return;
    if (x === player.x && y === player.y && z === (player.z || 0)) {
      this.stepDownFromCurrentTile(player);
      return;
    }
    this.setWalkTarget(player, x, y, z);
  }

  // ================================================================================================================================================================================================================================================
  // setWalkTarget
  // Leva o player até o sqm (x, y) do andar z — o caminho pode trocar de andar
  // por pilha, escada e buraco. Sem caminho, o player fica onde está.

  setWalkTarget(player, x, y, z) {
    const movement = this.sim.movement;
    if (player.x === x && player.y === y && (player.z || 0) === z) return;

    if (movement.isBlocked(x, y, z)) {
      console.log("❌ Tile bloqueado");
      return;
    }

    if (player.target) {
      player.autoFollow = false;
    }

    const start = { x: player.x, y: player.y, z: player.z || 0, step: player.step || 0 };
    const path = movement.findPath(start, { x, y, z });

    if (path.length === 0) {
      console.log("❌ Nenhum caminho encontrado para este destino");
      this.clearWalk(player);
      return;
    }

    player.walk = { target: { x, y, z }, path };
    console.log(`✅ Caminho criado com ${path.length} passos até (${x},${y}) andar ${z}`);
  }

  // ================================================================================================================================================================================================================================================
  // stepDownFromCurrentTile

  stepDownFromCurrentTile(player) {
    const movement = this.sim.movement;
    const playerStep = player.step || 0;
    if (playerStep <= 0) return;

    const floor = player.z || 0;
    let bestAdjacentTile = null;
    let bestStep = playerStep;

    for (const pos of getAdjacentPositions(player.x, player.y)) {
      if (!movement.isInsideMap(pos.x, pos.y)) continue;
      const adjStep = movement.getPassableStep(pos.x, pos.y, floor, playerStep);
      if (adjStep !== null && adjStep < bestStep) {
        bestStep = adjStep;
        bestAdjacentTile = pos;
      }
    }

    if (bestAdjacentTile) {
      this.setWalkTarget(player, bestAdjacentTile.x, bestAdjacentTile.y, floor);
    }
  }

  // ================================================================================================================================================================================================================================================
  // setAttackTarget
  // Escolher um inimigo liga o seguir; null tira o alvo.

  setAttackTarget(player, targetId) {
    if (targetId === null || targetId === undefined) {
      if (player.target) console.log(`🎯 Alvo desmarcado: ${player.target.id}`);
      player.target = null;
      return;
    }
    const enemy = this.sim.enemies.find(e => e.id === targetId && e.isAlive());
    if (!enemy) return;
    player.target = enemy;
    player.autoFollow = true;
    console.log(`🎯 Alvo selecionado: ${enemy.id}`);
  }

  // ================================================================================================================================================================================================================================================
  // toggleFollow

  toggleFollow(player) {
    player.autoFollow = !player.autoFollow;
    console.log("🏃 Auto-follow: " + (player.autoFollow ? 'ATIVADO' : 'DESATIVADO'));
  }

  // ================================================================================================================================================================================================================================================
  // moveItem
  // Item ao alcance (mesmo sqm ou vizinho, mesmo andar) é movido na hora;
  // senão o player vai até ele e move ao chegar.

  moveItem(player, itemId, x, y, z) {
    const item = this.sim.getItem(itemId);
    if (!item || item.movable === false) return;
    if (!this.sim.movement.isInsideMap(x, y)) return;

    if (this.sim.objectDrag.isPlayerNear(player, item)) {
      this.sim.objectDrag.moveObject(player, item, x, y, z);
    } else {
      this.sim.objectDrag.startDragMoveToObject(player, item, x, y, z);
    }
  }

  // ================================================================================================================================================================================================================================================
  // moveAlongWalk
  // Um passo do caminho do clique. Se o mapa mudou (volume arrastado, inimigo
  // no caminho…) e o passo não termina mais onde o caminho previa, recalcula
  // até o mesmo destino.

  moveAlongWalk(player, now) {
    const movement = this.sim.movement;
    if (now - player.lastMoveTime < calculateMoveDelay(player.spd)) return;

    const nextStep = player.walk.path[0];
    const current = { x: player.x, y: player.y, z: player.z || 0, step: player.step || 0 };
    const predicted = movement.simulateMove(current, nextStep.dx, nextStep.dy);
    if (!predicted || predicted.x !== nextStep.x || predicted.y !== nextStep.y || predicted.z !== nextStep.z) {
      const { x, y, z } = player.walk.target;
      this.setWalkTarget(player, x, y, z);
      return;
    }

    if (movement.moveEntity(player, nextStep.dx, nextStep.dy, now)) {
      player.walk.path.shift();
    } else {
      this.clearWalk(player);
    }
  }

  // ================================================================================================================================================================================================================================================
  // update
  // A cada tick: segue o caminho do clique ou anda na direção das teclas.

  update(player, now) {
    if (this.isWalking(player)) {
      this.moveAlongWalk(player, now);
    } else if (player.walkDir) {
      this.sim.movement.moveEntity(player, player.walkDir.dx, player.walkDir.dy, now);
    }
    this.sim.objectDrag.checkPendingDrag(player);
  }
}
