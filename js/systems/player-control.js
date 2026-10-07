// js/systems/player-control.js

import { calculateMoveDelay, getAdjacentPositions, directionFromDelta } from '../utils/helpers.js';
import { getStairTop } from '../../shared/stairs.js';
import { isEntranceFolder, objectIdType } from '../../shared/assets.js';

// Comandos que um jogador manda pra simulação (hoje pelo teclado/mouse; no
// multiplayer, pela rede). Todos têm `type`:
//   { type: 'walkDir', dx, dy }          andar numa direção enquanto a tecla está
//                                        apertada; dx = dy = 0 para
//   { type: 'walkTo', x, y, z }          andar até o sqm (clique no chão); no
//                                        próprio sqm, desce da pilha
//   { type: 'attack', targetId }         escolher inimigo como alvo (null tira)
//   { type: 'toggleFollow' }             liga/desliga seguir o alvo
//   { type: 'toggleAttackMode' }         alterna auto ataque / defesa
//   { type: 'moveItem', itemId, x, y, z } arrastar item/cadáver pro sqm
//   { type: 'moveInv', from, to, amount } mover item do inventário, de um
//                                        container ou do chão (systems/inventory.js)
//   { type: 'openContainer', itemId }    abrir caixa do chão (anda até ela)
//   { type: 'closeContainer', itemId }   fechar caixa do chão
//   { type: 'saveLayout', layout }       guardar o layout das janelas
//   { type: 'useDoor', x, y, z }         abrir/fechar porta (anda até ela)

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
      case 'toggleAttackMode': return this.toggleAttackMode(player);
      case 'moveItem': return this.moveItem(player, command.itemId, command.x, command.y, command.z);
      case 'moveInv': return this.sim.inventory.move(player, command.from, command.to, command.amount);
      case 'openContainer': return this.sim.inventory.open(player, command.itemId);
      case 'useObject': return this.sim.interactions.useObject(player, command.id);
      case 'useItem': return this.sim.inventory.use(player, command.from, command.target || null);
      case 'closeContainer': return this.sim.inventory.close(player, command.itemId);
      case 'saveLayout': return this.sim.inventory.saveLayout(player, command.layout);
      case 'useStairs': return this.useStairs(player, command.x, command.y, command.z);
      case 'useDoor': return this.useDoor(player, command.x, command.y, command.z);
      case 'say': return this.sim.spells.cast(player, command.text) || this.sim.houses.command(player, command.text) || this.sim.talk.playerSays(player, command.text);
      case 'turn': return this.turn(player, command.dx, command.dy);
      case 'partyInvite': return this.sim.social.invite(player, command.targetId);
      case 'partyJoin': return this.sim.social.join(player, command.leaderId);
      case 'partyLeave': return this.sim.social.leave(player);
      case 'privateMessage': return this.sim.social.privateMessage(player, command.to, command.text);
      case 'vipAdd': return this.sim.social.vipAdd(player, command.name);
      case 'vipRemove': return this.sim.social.vipRemove(player, command.name);
      case 'tradeOpen': return this.sim.social.tradeOpen(player, command.targetId);
      case 'tradeOffer': return this.sim.social.tradeOffer(player, command.from);
      case 'tradeAccept': return this.sim.social.tradeAccept(player);
      case 'tradeCancel': return this.sim.social.cancelTrade(player);
      default: console.warn('Comando desconhecido:', command);
    }
  }

  // ================================================================================================================================================================================================================================================
  // turn
  // Ctrl + direção: vira pro lado (dx, dy) sem sair do sqm.

  turn(player, dx, dy) {
    const direction = directionFromDelta(Math.sign(dx) || 0, Math.sign(dy) || 0);
    if (direction) player.direction = direction;
  }

  // ================================================================================================================================================================================================================================================
  // setWalkDir
  // Tecla de direção apertada: larga o caminho do clique e, com alvo, para de segui-lo.

  setWalkDir(player, dx, dy) {
    player.pendingStairs = null;
    player.pendingDoor = null;
    if (dx === 0 && dy === 0) {
      player.walkDir = null;
      return;
    }
    player.walkDir = { dx, dy };
    this.clearWalk(player);
    this.stopFollowing(player);
  }

  // ================================================================================================================================================================================================================================================
  // stopFollowing
  // O player se moveu por conta própria (tecla ou clique no chão) tendo um
  // alvo: o modo seguir passa pra parado, mesmo com o auto ataque ligado.
  // Sem alvo, andar não mexe no seguir.

  stopFollowing(player) {
    if (!player.target) return;
    if (!player.followMode && !player.autoFollow) return;
    player.followMode = false;
    player.autoFollow = false;
    console.log('🧍 Seguir desligado: o player se moveu');
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
  // Clique no chão: anda até o sqm (x, y) no andar em que o player está (o
  // andar do clique é ignorado). No próprio sqm, com o player em cima de algo:
  // desce pro vizinho mais baixo. Topo de escada (o buraco invisível no andar
  // de cima) não é clicável: pra descer, clica-se na base dela (stairTopBelow)
  // — a não ser que tenha uma entrada desenhada ali (alçapão da escada reta).

  walkTo(player, x, y) {
    player.pendingStairs = null;
    player.pendingDoor = null;
    if (!this.sim.movement.isInsideMap(x, y)) return;
    this.stopFollowing(player);
    if (x === player.x && y === player.y) {
      this.stepDownFromCurrentTile(player);
      return;
    }
    const z = player.z || 0;
    if (this.isBareStairTop(x, y, z)) return;
    const top = this.stairTopBelow(x, y, z);
    if (top) {
      this.setWalkTarget(player, top.x, top.y, z);
      return;
    }
    this.setWalkTarget(player, x, y, z);
  }

  // ================================================================================================================================================================================================================================================
  // isBareStairTop
  // Topo de escada sem entrada desenhada por cima (só o buraco invisível).

  isBareStairTop(x, y, z) {
    const world = this.sim.world;
    const transition = world.getTransitionAt(x, y, z);
    if (!transition || !transition.isStairTop) return false;
    return !world.getObjectsAt(x, y).some(o => (o.z || 0) === z && isEntranceFolder(objectIdType(o.id)));
  }

  // ================================================================================================================================================================================================================================================
  // stairTopBelow
  // Clique, no andar de cima, no sqm (sem piso) onde está o pé de uma escada
  // do andar de baixo: é pra descer por ela. Devolve o topo dela (o buraco
  // que desce), ou null.

  stairTopBelow(x, y, z) {
    const world = this.sim.world;
    if (world.hasFloorAt(x, y, z)) return null;
    const stairs = world.getTransitionAt(x, y, z - 1);
    if (!stairs || stairs.stairDirection !== 'up') return null;
    const top = getStairTop(x, y, z - 1);
    const hole = world.getTransitionAt(top.x, top.y, top.z);
    return hole && hole.stairDirection === 'down' ? top : null;
  }

  // ================================================================================================================================================================================================================================================
  // setWalkTarget
  // Leva o player até o sqm (x, y) do andar z sem sair do andar: o caminho não
  // sobe/desce pela pilha nem passa por escada ou buraco (só entra num se ele
  // for o sqm clicado). Sem caminho, o player fica onde está.

  setWalkTarget(player, x, y, z) {
    const movement = this.sim.movement;
    if (player.x === x && player.y === y && (player.z || 0) === z) return;

    if (movement.isBlocked(x, y, z)) {
      console.log("❌ Tile bloqueado");
      return;
    }

    const start = { x: player.x, y: player.y, z: player.z || 0, step: player.step || 0 };
    const path = movement.findPath(start, { x, y, z }, { sameFloor: true });

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
  // Escolher um inimigo segue ele se o modo seguir estiver ligado e desliga o
  // auto ataque; null tira o alvo. Inimigo em outro andar ou longe demais não vira alvo.

  setAttackTarget(player, targetId) {
    if (targetId === null || targetId === undefined) {
      if (player.target) console.log(`🎯 Alvo desmarcado: ${player.target.id}`);
      player.target = null;
      return;
    }
    const other = this.sim.players.find(p => p.id === targetId);
    if (other && !this.sim.social.canAttack(player, other)) {
      this.sim.emit({ type: 'message', playerId: player.id, text: 'Você não pode atacar esse player (zona segura, mesma party ou nível abaixo de 8).', kind: 'warn' });
      return;
    }
    const enemy = other || this.sim.enemies.find(e => e.id === targetId && e.isAlive());
    if (!enemy || this.sim.combat.isTargetLost(player, enemy)) return;
    player.target = enemy;
    player.autoFollow = player.followMode;
    player.attackMode = false;
    console.log(`🎯 Alvo selecionado: ${enemy.id}`);
  }

  // ================================================================================================================================================================================================================================================
  // toggleFollow
  // Modo seguir (ícone no inventário): ligado, o player anda até o alvo.
  // Andar pelas teclas só pausa o seguir até escolher um alvo de novo.

  toggleFollow(player) {
    player.followMode = !player.followMode;
    player.autoFollow = player.followMode;
    console.log("🏃 Auto-follow: " + (player.followMode ? 'ATIVADO' : 'DESATIVADO'));
  }

  // ================================================================================================================================================================================================================================================
  // toggleAttackMode
  // Auto ataque (espadas) ou defesa (escudo): no auto ataque, sem alvo, o
  // player ataca o primeiro inimigo da fila (combat.updateAutoAttack).

  toggleAttackMode(player) {
    player.attackMode = !player.attackMode;
    console.log("⚔️ Modo: " + (player.attackMode ? 'AUTO ATAQUE' : 'DEFESA'));
  }

  // ================================================================================================================================================================================================================================================
  // moveItem
  // Item ao alcance (mesmo sqm ou vizinho, mesmo andar) é movido na hora;
  // senão o player vai até ele e move ao chegar.

  moveItem(player, itemId, x, y, z) {
    const item = this.sim.getItem(itemId);
    if (!item || item.movable === false) return;
    if (!this.sim.movement.isInsideMap(x, y)) return;
    const world = this.sim.world;
    if (!world.mayEnter(player, item.x, item.y, item.z || 0) || !world.mayEnter(player, x, y, z)) {
      this.sim.emit({ type: 'message', playerId: player.id, text: 'Essa casa não é sua.', kind: 'warn' });
      return;
    }

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
  // até o mesmo destino. Pisar na escada/buraco do destino leva pro outro
  // andar: vale o sqm pisado (via), não onde o teleporte deixa.

  moveAlongWalk(player, now) {
    const movement = this.sim.movement;
    if (now - player.lastMoveTime < calculateMoveDelay(player.spd)) return;

    const nextStep = player.walk.path[0];
    const current = { x: player.x, y: player.y, z: player.z || 0, step: player.step || 0 };
    const predicted = movement.simulateMove(current, nextStep.dx, nextStep.dy);
    const entered = predicted && (predicted.via || predicted);
    if (!entered || entered.x !== nextStep.x || entered.y !== nextStep.y || entered.z !== nextStep.z) {
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
    this.checkPendingStairs(player);
    this.checkPendingDoor(player);
  }

  // ================================================================================================================================================================================================================================================
  // useStairs
  // Comando useStairs (duplo clique no sqm de uma escada sem altura): colado
  // nela (em qualquer direção, inclusive na diagonal) ou em cima dela, sobe,
  // mesmo com alguém em cima; longe, anda até o sqm dela (se estiver livre) ou
  // até um sqm livre colado nela e sobe ao chegar.

  useStairs(player, x, y, z) {
    const stairs = this.sim.world.getTransitionAt(x, y, z);
    if (!stairs || !stairs.manualStairs) return;
    if (this.isNextTo(player, stairs)) {
      player.pendingStairs = null;
      this.clearWalk(player);
      this.climb(player, stairs);
      return;
    }
    const approach = this.stairsApproach(player, stairs);
    if (!approach) return;
    player.pendingStairs = { x, y, z };
    this.setWalkTarget(player, approach.x, approach.y, z);
  }

  // ================================================================================================================================================================================================================================================
  // stairsApproach
  // Pra onde andar até a escada: o sqm dela se estiver livre; ocupado, o sqm
  // livre colado nela mais perto do player. null se não há.

  stairsApproach(player, stairs) {
    const world = this.sim.world;
    const z = stairs.z || 0;
    if (!world.isBlocked(stairs.x, stairs.y, z)) return { x: stairs.x, y: stairs.y };
    let best = null;
    let bestDist = Infinity;
    for (const pos of getAdjacentPositions(stairs.x, stairs.y)) {
      if (!world.isInside(pos.x, pos.y) || world.isBlocked(pos.x, pos.y, z) || world.getTransitionAt(pos.x, pos.y, z)) continue;
      if (world.getPassableStep(pos.x, pos.y, z) === null) continue;
      const d = Math.max(Math.abs(player.x - pos.x), Math.abs(player.y - pos.y));
      if (d < bestDist) { bestDist = d; best = pos; }
    }
    return best;
  }

  // ================================================================================================================================================================================================================================================
  // climb
  // Leva o player pro alvo da escada. Alvo ocupado: o sqm livre mais perto dele
  // (só buraco e respawn deixam dois players no mesmo sqm). Não entra em casa
  // de outro dono.

  climb(player, stairs) {
    const world = this.sim.world;
    const { targetX, targetY, targetZ } = stairs;
    const occupied = world.hasFloorAt(targetX, targetY, targetZ) && world.isBlocked(targetX, targetY, targetZ);
    const landing = occupied ? this.sim.findSpotNear(targetX, targetY, targetZ) : null;
    if (occupied && !landing) return;
    const spot = landing || { x: targetX, y: targetY };
    if (!world.mayEnter(player, spot.x, spot.y, targetZ)) {
      this.sim.emit({ type: 'message', playerId: player.id, text: 'Essa casa não é sua.', kind: 'warn' });
      return;
    }
    this.sim.movement.useTransition(player, stairs, landing);
  }

  // ================================================================================================================================================================================================================================================
  // checkPendingStairs
  // Chegou do lado da escada do duplo clique (ou nela): sobe. Parou longe: desiste.

  checkPendingStairs(player) {
    const pending = player.pendingStairs;
    if (!pending || this.isWalking(player)) return;
    player.pendingStairs = null;
    const stairs = this.sim.world.getTransitionAt(pending.x, pending.y, pending.z);
    if (stairs && stairs.manualStairs && this.isNextTo(player, stairs)) this.climb(player, stairs);
  }

  // ================================================================================================================================================================================================================================================
  // useDoor
  // Comando useDoor (clique na porta): colado nela, abre ou fecha; longe, o
  // player anda até o sqm colado mais perto e abre ao chegar.

  useDoor(player, x, y, z) {
    const door = this.sim.world.getDoorAt(x, y, z);
    if (!door) return;
    if (this.isNextTo(player, door)) {
      player.pendingDoor = null;
      this.toggleDoor(player, door);
      return;
    }
    const movement = this.sim.movement;
    let best = null;
    let bestDist = Infinity;
    for (const pos of getAdjacentPositions(x, y)) {
      if (!movement.isInsideMap(pos.x, pos.y) || movement.isBlocked(pos.x, pos.y, z)) continue;
      if (movement.getPassableStep(pos.x, pos.y, z) === null) continue;
      const d = Math.max(Math.abs(player.x - pos.x), Math.abs(player.y - pos.y));
      if (d < bestDist) { bestDist = d; best = pos; }
    }
    if (!best) return;
    player.pendingDoor = { x, y, z };
    this.setWalkTarget(player, best.x, best.y, z);
  }

  // ================================================================================================================================================================================================================================================
  // isNextTo

  isNextTo(player, obj) {
    if ((player.z || 0) !== (obj.z || 0)) return false;
    return Math.max(Math.abs(player.x - obj.x), Math.abs(player.y - obj.y)) <= 1;
  }

  // ================================================================================================================================================================================================================================================
  // toggleDoor
  // Abre a porta fechada ou fecha a aberta. Não fecha com alguém no vão.

  toggleDoor(player, door) {
    const world = this.sim.world;
    const open = !door.blocksMovement;
    if (open && world.getCreatureAt(door.x, door.y, door.z || 0) !== null) {
      this.sim.emit({ type: 'message', playerId: player.id, text: 'Tem alguém no caminho.', kind: 'warn' });
      return;
    }
    const oldId = world.setDoorOpen(door, !open);
    if (!oldId) return;
    this.sim.objectsById.delete(oldId);
    this.sim.objectsById.set(door.id, door);
    console.log(`🚪 Porta em (${door.x}, ${door.y}) ${open ? 'fechada' : 'aberta'}`);
  }

  // ================================================================================================================================================================================================================================================
  // checkPendingDoor
  // Chegou do lado da porta clicada: abre (ou fecha). Parou longe: desiste.

  checkPendingDoor(player) {
    const pending = player.pendingDoor;
    if (!pending || this.isWalking(player)) return;
    player.pendingDoor = null;
    const door = this.sim.world.getDoorAt(pending.x, pending.y, pending.z);
    if (door && this.isNextTo(player, door)) this.toggleDoor(player, door);
  }
}
