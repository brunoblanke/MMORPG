// moba/host.js

import { MobaSim } from './engine/sim.js';
import { TICK_MS } from './engine/config.js';

const RESTART_MS = 12000;
const IDLE_MS = 30000;

// ================================================================================================================================================================================================================================================
// O anfitrião da partida: guarda a MobaSim, quem está conectado (cada conexão é um fluxo de eventos do navegador, SSE) e o herói de cada
// jogador. A partida só anda enquanto há alguém conectado; sem ninguém por IDLE_MS, ela pausa e o servidor fica parado.

export class MatchHost {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor() {
    this.sim = new MobaSim();
    this.clients = new Map();
    this.counter = 0;
    this.timer = null;
    this.idleTimer = null;
    this.wasOver = false;
  }

  // ================================================================================================================================================================================================================================================
  // connect
  // Um navegador abriu o fluxo: devolve o id dele e põe a partida pra andar.

  connect(response) {
    const id = `c${++this.counter}-${Math.random().toString(36).slice(2, 8)}`;
    this.clients.set(id, { response, heroId: null });
    clearTimeout(this.idleTimer);
    if (!this.timer) this.timer = setInterval(() => this.tick(), TICK_MS);
    return id;
  }

  // ================================================================================================================================================================================================================================================
  // disconnect
  // O navegador saiu: o herói dele volta a ser bot; sem ninguém, a partida pausa depois de um tempo.

  disconnect(id) {
    const client = this.clients.get(id);
    const hero = client && client.heroId ? this.sim.heroes.find(item => item.id === client.heroId) : null;
    if (hero) hero.human = false;
    this.clients.delete(id);
    if (!this.clients.size) {
      this.idleTimer = setTimeout(() => {
        clearInterval(this.timer);
        this.timer = null;
      }, IDLE_MS);
    }
  }

  // ================================================================================================================================================================================================================================================
  // join
  // O jogador toma o herói da vocação e do time (se não é de outro jogador); devolve o id do herói ou null.

  join(id, team, vocation) {
    const client = this.clients.get(id);
    if (!client || client.heroId) return null;
    const hero = this.sim.heroes.find(item => item.vocation === vocation && item.team === team && !item.human);
    if (!hero) return null;
    hero.human = true;
    hero.moveTarget = null;
    hero.attackTargetId = null;
    client.heroId = hero.id;
    return hero.id;
  }

  // ================================================================================================================================================================================================================================================
  // command
  // A ordem do jogador pro herói dele.

  command(id, command) {
    const client = this.clients.get(id);
    if (client && client.heroId) this.sim.command(client.heroId, command);
  }

  // ================================================================================================================================================================================================================================================
  // push
  // Manda o texto (um quadro de estado) pra todos os fluxos abertos.

  push(text) {
    for (const [id, client] of this.clients) {
      try {
        client.response.write(`data: ${text}\n\n`);
      } catch {
        this.disconnect(id);
      }
    }
  }

  // ================================================================================================================================================================================================================================================
  // restartLater
  // Depois do fim da partida, começa outra e devolve os heróis aos jogadores que estavam conectados.

  restartLater() {
    setTimeout(() => {
      this.sim = new MobaSim();
      for (const [id, client] of this.clients) {
        const hero = client.heroId ? this.sim.heroes.find(item => item.id === client.heroId) : null;
        if (hero) hero.human = true;
        else client.heroId = null;
        client.response.write(`event: joined\ndata: ${JSON.stringify({ id, heroId: client.heroId })}\n\n`);
      }
    }, RESTART_MS);
  }

  // ================================================================================================================================================================================================================================================
  // tick
  // Um tick da partida e o estado pra todo mundo.

  tick() {
    this.sim.tick();
    this.push(JSON.stringify({ ...this.sim.snapshot(), events: this.sim.drainEvents() }));
    if (this.sim.over && !this.wasOver) this.restartLater();
    this.wasOver = this.sim.over;
  }
}
