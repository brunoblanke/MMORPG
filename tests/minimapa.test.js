// tests/minimapa.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGame, floorRect, FLOOR, wall } from './helpers/fixture.js';
import { TICK_MS } from '../js/simulation.js';
import { setAssets } from '../shared/assets.js';
import { descreverUso } from '../shared/ficha.js';
import { minimapCells } from '../js/views/minimap.js';

const BAG = 'itens/recipientes/bolsa-de-teste';
const MAP = 'itens/documentos-e-papeis/mapa-de-teste';

const asset = (id, propriedades, ferramenta = 'objetos') => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta, grupo, pasta, nome, url: `/${nome}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([
  asset(FLOOR, {}, 'pisos'),
  asset(BAG, { move: true, espacos: 4 }),
  asset(MAP, { move: true, peso: 7.9, uso: 'mapa' })
]);

test('usar o mapa abre o mini mapa no navegador de quem usou', () => {
  const game = buildGame({ objects: floorRect(0, 10, 0, 10, 0), player: { x: 5, y: 5, z: 0 } });
  game.player.equip.mochila = { uid: 'b1', type: BAG, items: [{ uid: 'm1', type: MAP }, null, null, null] };
  game.enqueue('player1', { type: 'useItem', from: { t: 'c', uid: 'b1', i: 0 } });
  game.tick(game.time + TICK_MS);
  assert.ok(game.drainEvents().some(e => e.type === 'minimap' && e.playerId === game.player.id));
  assert.equal(game.player.equip.mochila.items[0].type, MAP, 'o mapa não se gasta');
  assert.deepEqual(descreverUso('mapa'), ['Ao clicar: abrir mapa']);
});

test('o mapa no chão ao lado também abre', () => {
  const game = buildGame({ objects: floorRect(0, 10, 0, 10, 0), player: { x: 5, y: 5, z: 0 } });
  const map = game.inventory.spawnGroundItem({ uid: 'm1', type: MAP }, 6, 5, 0);
  game.enqueue('player1', { type: 'useItem', from: { t: 'g', id: map.id } });
  game.tick(game.time + TICK_MS);
  assert.ok(game.drainEvents().some(e => e.type === 'minimap' && e.playerId === game.player.id));
});

test('mini mapa: cor do piso, do que bloqueia por cima dele, preto sem chão e o player no meio', () => {
  const game = buildGame({ objects: [...floorRect(0, 6, 0, 6, 0), ...wall(4, 3)], player: { x: 3, y: 3, z: 0 } });
  const cells = minimapCells(game.world, game.player, (type) => type.startsWith(FLOOR) ? 'piso' : 'parede', 2);
  assert.equal(cells.length, 25);
  const at = (dx, dy) => cells[(dy + 2) * 5 + (dx + 2)];
  assert.equal(at(0, 0), '#ffffff');
  assert.equal(at(1, 0), 'parede');
  assert.equal(at(-1, 0), 'piso');
  const corner = minimapCells(game.world, { x: 0, y: 0, z: 0 }, () => 'piso', 1);
  assert.equal(corner[0], '#000000', 'fora do mapa');
});
