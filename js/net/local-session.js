// js/net/local-session.js

import { Simulation, TICK_MS } from '../simulation.js';

const MAX_TICKS_PER_FRAME = 10;

// Jogo sozinho: a simulação roda no próprio navegador (sem servidor de jogo,
// ex.: hospedagem só de arquivos). Mesma interface da RemoteSession.

export class LocalSession {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(mapData, name = 'Player') {
    this.sim = new Simulation(mapData);
    this.playerId = 'player1';
    this.sim.addPlayer(this.playerId, { name });
    this.simTime = null;
    this.isOnline = false;
  }

  get world() { return this.sim.world; }
  get objects() { return this.sim.objects; }
  get players() { return this.sim.players; }
  get enemies() { return this.sim.enemies; }
  get deadBodies() { return this.sim.deadBodies; }
  get player() { return this.sim.getPlayer(this.playerId); }

  // ================================================================================================================================================================================================================================================
  // send

  send(command) {
    this.sim.enqueue(this.playerId, command);
  }

  // ================================================================================================================================================================================================================================================
  // update
  // Avança a simulação em passos fixos de TICK_MS até alcançar o relógio da
  // tela. Se a aba ficou parada (muitos ticks atrasados), pula o atraso.
  // Devolve os eventos dos ticks rodados.

  update(timestamp) {
    if (this.simTime === null) this.simTime = timestamp - TICK_MS;

    let ticks = 0;
    while (this.simTime + TICK_MS <= timestamp && ticks < MAX_TICKS_PER_FRAME) {
      this.simTime += TICK_MS;
      this.sim.tick(this.simTime);
      ticks++;
    }
    if (ticks === MAX_TICKS_PER_FRAME) this.simTime = timestamp;
    return this.sim.drainEvents();
  }
}
