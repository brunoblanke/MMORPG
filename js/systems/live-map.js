// js/systems/live-map.js

import { objectIdType, objectProps } from '../../shared/assets.js';

// O mundo vivo: o que o jogo muda no mapa (árvore cortada que vira toco, muda que vira árvore, toco que some) vale
// pra sempre. Cada objeto fixo do mapa lembra a linha dele em mapData.objetosData (mapEntry); collect() tira as
// linhas dos que sumiram de vez (o que rebrota não conta) e acrescenta as dos que nasceram, e o servidor grava o
// mapData no arquivo do mapa. Itens soltos no chão ficam de fora.
// Os navegadores carregam o mapa do arquivo e recebem em view() as mudanças nos objetos fixos desde que o servidor
// subiu ([tipo da mudança, tipo, x, y, z, bloqueia, tem altura]); aplicar de novo o que o arquivo já tem não muda nada.

export class LiveMap {

  // ================================================================================================================================================================================================================================================
  // constructor

  constructor(sim) {
    this.sim = sim;
    this.tracked = sim.objects.filter(obj => obj.mapEntry);
    this.born = new Set();
    this.changes = new Map();
  }

  // ================================================================================================================================================================================================================================================
  // add
  // Um objeto fixo que nasceu no jogo (interactions.placeObject): vai pro mapa e pros navegadores.

  add(obj) {
    this.born.add(obj);
    this.shown(obj);
  }

  // ================================================================================================================================================================================================================================================
  // shown
  // Um objeto fixo apareceu no mundo (nasceu ou rebrotou).

  shown(obj) {
    const key = changeKey(obj);
    if (this.changes.has(key) && this.changes.get(key)[0] === 'gone') this.changes.delete(key);
    else this.changes.set(key, ['born', ...changeData(obj)]);
  }

  // ================================================================================================================================================================================================================================================
  // hidden
  // Um objeto fixo saiu do mundo (cortado, virou outro).

  hidden(obj) {
    const key = changeKey(obj);
    if (this.changes.has(key) && this.changes.get(key)[0] === 'born') this.changes.delete(key);
    else this.changes.set(key, ['gone', ...changeData(obj)]);
  }

  // ================================================================================================================================================================================================================================================
  // view
  // As mudanças nos objetos fixos perto de quem vê (near), pro navegador.

  view(near = () => true) {
    return [...this.changes.values()].filter(([, , x, y]) => near({ x, y }));
  }

  // ================================================================================================================================================================================================================================================
  // collect
  // Passa as mudanças pro mapData.objetosData. Devolve true se o mapa mudou (aí o servidor grava).

  collect() {
    const { world, mapData } = this.sim;
    const gone = this.tracked.filter(obj => !world.objects.has(obj) && !obj.regrowing);
    const born = [...this.born].filter(obj => world.objects.has(obj));
    this.born.clear();
    if (!gone.length && !born.length) return false;
    const goneEntries = new Set(gone.map(obj => obj.mapEntry));
    const kept = (mapData.objetosData || []).filter(entry => !goneEntries.has(entry));
    for (const obj of born) {
      const type = objectIdType(obj.id);
      const props = objectProps(type);
      obj.mapEntry = [type, obj.x, obj.y, obj.z || 0, 0, props.movable, props.hasVolume, props.blocksMovement];
      kept.push(obj.mapEntry);
    }
    mapData.objetosData = kept;
    const goneSet = new Set(gone);
    this.tracked = [...this.tracked.filter(obj => !goneSet.has(obj)), ...born];
    return true;
  }
}

// ================================================================================================================================================================================================================================================
// changeKey

function changeKey(obj) {
  return `${objectIdType(obj.id)}@${obj.x},${obj.y},${obj.z || 0}`;
}

// ================================================================================================================================================================================================================================================
// changeData

function changeData(obj) {
  return [objectIdType(obj.id), obj.x, obj.y, obj.z || 0, !!obj.blocksMovement, !!obj.hasVolume];
}

// ================================================================================================================================================================================================================================================
// mergeObjects
// O que o editor mudou (de base pra edited) aplicado no mapa atual (current), que pode ter mudanças do jogo feitas
// enquanto o editor estava aberto. As três listas no mesmo formato (o do editor); cada linha conta como um todo.

export function mergeObjects(base, edited, current) {
  const key = (entry) => JSON.stringify(entry);
  const count = (list) => {
    const counts = new Map();
    for (const entry of list) counts.set(key(entry), (counts.get(key(entry)) || 0) + 1);
    return counts;
  };
  const before = count(base);
  const after = count(edited);
  const removed = new Map();
  for (const [k, n] of before) if (n > (after.get(k) || 0)) removed.set(k, n - (after.get(k) || 0));
  const added = [];
  const seen = new Map();
  for (const entry of edited) {
    const k = key(entry);
    seen.set(k, (seen.get(k) || 0) + 1);
    if (seen.get(k) > (before.get(k) || 0)) added.push(entry);
  }
  const result = [];
  for (const entry of current) {
    const k = key(entry);
    if (removed.get(k) > 0) {
      removed.set(k, removed.get(k) - 1);
      continue;
    }
    result.push(entry);
  }
  return [...result, ...added];
}
