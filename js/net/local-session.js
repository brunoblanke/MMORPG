// js/net/local-session.js

import { Simulation, TICK_MS } from '../simulation.js';

const MAX_TICKS_PER_FRAME = 10;
const SAVE_INTERVAL_MS = 5000;

// Jogo sozinho: a simulação roda no próprio navegador (sem servidor de jogo,
// ex.: hospedagem só de arquivos). Mesma interface da RemoteSession. O
// personagem fica guardado no localStorage deste navegador, pelo nome.

export class LocalSession {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(mapData, name = 'Player', gender) {
    this.sim = new Simulation(mapData);
    this.playerId = 'player1';
    this.storageKey = `character:${name.toLowerCase()}`;
    this.sim.addPlayer(this.playerId, { name, gender, saved: this.loadCharacter() });
    this.simTime = null;
    this.lastSave = 0;
    this.isOnline = false;
    window.addEventListener('beforeunload', () => this.saveCharacter());
  }

  // ================================================================================================================================================================================================================================================
  // loadCharacter

  loadCharacter() {
    try {
      return JSON.parse(localStorage.getItem(this.storageKey));
    } catch {
      return null;
    }
  }

  // ================================================================================================================================================================================================================================================
  // saveCharacter

  saveCharacter() {
    const player = this.player;
    if (!player) return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(player.toSave()));
    } catch {
      return;
    }
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
    if (timestamp - this.lastSave >= SAVE_INTERVAL_MS) {
      this.lastSave = timestamp;
      this.saveCharacter();
    }
    return this.sim.drainEvents();
  }
}
