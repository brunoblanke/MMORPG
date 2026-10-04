// js/systems/houses.js

import { pay } from './trade.js';
import { toPlain, fromPlain } from '../../shared/items.js';

// Casas (pintadas no editor; world.houses): o player compra dizendo
// !comprarcasa dentro dela, com o dinheiro da mochila; cada um tem uma casa
// só. Com dono, só ele e os convidados entram (world.mayEnter). O dono diz
// !convidar nome ou !tirar nome pra mudar quem entra, e !deixarcasa pra
// largar ela (quem estiver dentro sem poder é levado pra fora). Os itens no
// chão das casas com dono ficam guardados (toSave) e voltam quando o
// servidor reinicia. Entrar numa casa mostra de quem ela é ou o preço.

export const HOUSE_COMMANDS = ['!comprarcasa', '!deixarcasa', '!convidar', '!tirar', '!casa'];

export class HouseController {

  // ================================================================================================================================================================================================================================================
  // constructor
  // saved: { nome: { owner, guests, items: [{ x, y, z, item }] } }.

  constructor(sim, saved = {}) {
    this.sim = sim;
    for (const [name, data] of Object.entries(saved || {})) {
      const house = sim.world.houses.get(name);
      if (!house || !data || typeof data.owner !== 'string') continue;
      house.owner = data.owner;
      house.guests = Array.isArray(data.guests) ? data.guests.filter(g => typeof g === 'string').slice(0, 50) : [];
      if (Array.isArray(data.items)) this.restoreItems(house, data.items);
    }
  }

  // ================================================================================================================================================================================================================================================
  // restoreItems
  // Os itens guardados da casa voltam pro chão dela, no lugar dos itens
  // soltos do mapa que estavam lá.

  restoreItems(house, items) {
    const inventory = this.sim.inventory;
    const keys = new Set(house.tiles.map(t => `${t.x},${t.y},${t.z}`));
    for (const obj of [...this.sim.objects]) {
      if (keys.has(`${obj.x},${obj.y},${obj.z || 0}`) && inventory.isPickable(obj)) inventory.removeGroundObject(obj);
    }
    for (const entry of items) {
      if (!entry || !keys.has(`${entry.x},${entry.y},${entry.z}`)) continue;
      const item = fromPlain(entry.item, () => inventory.nextUid());
      if (item) inventory.spawnGroundItem(item, entry.x, entry.y, entry.z);
    }
  }

  // ================================================================================================================================================================================================================================================
  // message

  message(player, text, kind = 'info') {
    this.sim.emit({ type: 'message', playerId: player.id, text, kind });
  }

  // ================================================================================================================================================================================================================================================
  // houseOf
  // A casa da qual o player é dono, ou null.

  houseOf(player) {
    const name = player.name.toLowerCase();
    return [...this.sim.world.houses.values()].find(h => h.owner && h.owner.toLowerCase() === name) || null;
  }

  // ================================================================================================================================================================================================================================================
  // command
  // O player disse um comando de casa: faz e devolve true.

  command(player, text) {
    const [word, ...rest] = String(text || '').trim().split(/\s+/);
    const cmd = (word || '').toLowerCase();
    if (!HOUSE_COMMANDS.includes(cmd)) return false;
    const name = rest.join(' ').trim();
    const here = this.sim.world.houseAt(player.x, player.y, player.z || 0);
    if (cmd === '!casa') this.describe(player, here);
    else if (cmd === '!comprarcasa') this.buy(player, here);
    else if (cmd === '!deixarcasa') this.leave(player);
    else if (cmd === '!convidar') this.setGuest(player, name, true);
    else this.setGuest(player, name, false);
    return true;
  }

  // ================================================================================================================================================================================================================================================
  // describe

  describe(player, house) {
    if (!house) return this.message(player, 'Você não está numa casa.', 'warn');
    if (house.owner) this.message(player, `${house.name}: casa de ${house.owner}.`);
    else this.message(player, `${house.name}: à venda por ${house.price} moedas de ouro. Diga !comprarcasa aqui dentro pra comprar.`);
  }

  // ================================================================================================================================================================================================================================================
  // buy

  buy(player, house) {
    if (!house) return this.message(player, 'Entre na casa que você quer comprar.', 'warn');
    if (house.owner) return this.message(player, `${house.name} já é de ${house.owner}.`, 'warn');
    if (this.houseOf(player)) return this.message(player, 'Você já tem uma casa.', 'warn');
    if (!pay(player, house.price, () => this.sim.inventory.nextUid())) return this.message(player, `Você precisa de ${house.price} moedas de ouro na mochila.`, 'warn');
    house.owner = player.name;
    house.guests = [];
    this.message(player, `Parabéns! ${house.name} agora é sua.`);
  }

  // ================================================================================================================================================================================================================================================
  // leave

  leave(player) {
    const house = this.houseOf(player);
    if (!house) return this.message(player, 'Você não tem casa.', 'warn');
    house.owner = null;
    house.guests = [];
    this.message(player, `Você deixou ${house.name}.`);
  }

  // ================================================================================================================================================================================================================================================
  // setGuest
  // O dono põe ou tira alguém da lista de quem entra; quem sai da lista e
  // está dentro é levado pra fora.

  setGuest(player, name, allow) {
    const house = this.houseOf(player);
    if (!house) return this.message(player, 'Você não tem casa.', 'warn');
    if (!name) return this.message(player, allow ? 'Diga !convidar e o nome.' : 'Diga !tirar e o nome.', 'warn');
    const clean = name.slice(0, 30);
    house.guests = house.guests.filter(g => g.toLowerCase() !== clean.toLowerCase());
    if (allow) house.guests.push(clean);
    this.message(player, allow ? `${clean} pode entrar em ${house.name}.` : `${clean} não entra mais em ${house.name}.`);
    if (!allow) this.expel(house);
  }

  // ================================================================================================================================================================================================================================================
  // expel
  // Quem está na casa sem poder vai pro sqm livre mais perto fora dela.

  expel(house) {
    const world = this.sim.world;
    for (const player of this.sim.players) {
      const z = player.z || 0;
      if (world.houseAt(player.x, player.y, z) !== house || world.mayEnter(player, player.x, player.y, z)) continue;
      const outside = this.spotOutside(house, z);
      if (outside) this.sim.teleportPlayer(player, outside.x, outside.y, z);
    }
  }

  // ================================================================================================================================================================================================================================================
  // spotOutside
  // O sqm livre fora da casa mais perto dela.

  spotOutside(house, z) {
    const world = this.sim.world;
    const tiles = house.tiles.filter(t => t.z === z);
    for (let radius = 1; radius <= 10; radius++) {
      for (const tile of tiles) {
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const x = tile.x + dx;
            const y = tile.y + dy;
            if (world.houseAt(x, y, z) || !world.isInside(x, y) || world.isBlocked(x, y, z) || world.getPassableStep(x, y, z) === null) continue;
            return { x, y };
          }
        }
      }
    }
    return null;
  }

  // ================================================================================================================================================================================================================================================
  // update
  // Entrar numa casa mostra de quem ela é (ou o preço).

  update() {
    const world = this.sim.world;
    for (const player of this.sim.players) {
      const house = world.houseAt(player.x, player.y, player.z || 0);
      if (house === (player.inHouse || null)) continue;
      player.inHouse = house;
      if (house) this.describe(player, house);
    }
  }

  // ================================================================================================================================================================================================================================================
  // toSave
  // Dono, convidados e os itens do chão de cada casa com dono.

  toSave() {
    const saved = {};
    const inventory = this.sim.inventory;
    for (const house of this.sim.world.houses.values()) {
      if (!house.owner) continue;
      const keys = new Set(house.tiles.map(t => `${t.x},${t.y},${t.z}`));
      const items = this.sim.objects.filter(obj => keys.has(`${obj.x},${obj.y},${obj.z || 0}`) && inventory.isPickable(obj))
        .map(obj => ({ x: obj.x, y: obj.y, z: obj.z || 0, item: toPlain(inventory.groundItem(obj)) }));
      saved[house.name] = { owner: house.owner, guests: house.guests, items };
    }
    return saved;
  }

  // ================================================================================================================================================================================================================================================
  // viewOf
  // Dono e convidados de cada casa (pro cliente prever quem entra).

  viewOf() {
    return [...this.sim.world.houses.values()].filter(h => h.owner).map(h => [h.name, h.owner, h.guests]);
  }
}
