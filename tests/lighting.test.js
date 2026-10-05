// tests/lighting.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DAY_MS, NIGHT_AMBIENT, PLAYER_LIGHT, ambientLight, worldTime, lightAt } from '../shared/lighting.js';
import { buildGame, floorRect } from './helpers/fixture.js';
import { TICK_MS } from '../js/simulation.js';
import { setAssets } from '../shared/assets.js';
import { itemInfo } from '../shared/items.js';

test('dia do Tibia: 1 hora real (2,5 s por minuto do jogo); amanhece 6h–8h, anoitece 18h–20h; subsolo sempre breu', () => {
  const at = (hour) => hour * 60 * 2500;
  assert.equal(DAY_MS, 3600000);
  assert.equal(worldTime(DAY_MS * 3 + at(12)), 720);
  assert.equal(ambientLight(at(12), 0), 1);
  assert.equal(ambientLight(at(3), 0), NIGHT_AMBIENT);
  assert.equal(ambientLight(at(21), 0), NIGHT_AMBIENT);
  assert.equal(ambientLight(at(7), 0), (40 + 105) / 250);
  assert.equal(ambientLight(at(19), 0), (250 - 105) / 250);
  assert.equal(ambientLight(at(10), 0), 1);
  assert.equal(ambientLight(at(12), -1), 0);
});

test('luz no sqm: a geral ou a da fonte, caindo até o raio', () => {
  const sources = [{ x: 10, y: 10, radius: 2 }];
  assert.equal(lightAt(10, 10, 0, sources), 1);
  assert.ok(lightAt(11, 10, 0, sources) > lightAt(12, 10, 0, sources));
  assert.equal(lightAt(14, 10, 0, sources), 0);
  assert.equal(lightAt(14, 10, 0.5, sources), 0.5);
});

test('tocha vai na mão ou no espaço de munição; botão direito acende e apaga; acesa aumenta a luz do player', async () => {
  const { fitsSlot } = await import('../shared/items.js');
  const TORCH = 'itens/fontes-de-luz/torch';
  setAssets([{ id: TORCH, ferramenta: 'objetos', grupo: 'itens', pasta: 'fontes-de-luz', nome: 'torch', rotulo: 'itens › fontes-de-luz', url: '/t.png', quadro: 32, quadros: 1, pecas: [], propriedades: { move: true, peso: 5, luz: 6 } }]);
  assert.deepEqual([itemInfo(TORCH).slot, itemInfo(TORCH).light], ['escudo', 6]);
  assert.deepEqual([fitsSlot(TORCH, 'escudo'), fitsSlot(TORCH, 'municao'), fitsSlot(TORCH, 'cabeca')], [true, true, false]);
  const sim = buildGame({ objects: floorRect(0, 10, 0, 10, 0), player: { x: 2, y: 2, z: 0 } });
  assert.equal(sim.player.equip.escudo.type, TORCH, 'nasce com a tocha');
  sim.tick(sim.time + TICK_MS);
  assert.equal(sim.player.light, PLAYER_LIGHT, 'apagada não ilumina');
  sim.enqueue('player1', { type: 'useItem', from: { t: 'e', key: 'escudo' } });
  sim.tick(sim.time + TICK_MS);
  sim.tick(sim.time + TICK_MS);
  assert.equal(sim.player.light, 6, 'acesa');
  assert.equal(sim.player.toSave().equip.escudo.lit, true, 'fica acesa ao salvar');
  sim.enqueue('player1', { type: 'useItem', from: { t: 'e', key: 'escudo' } });
  sim.tick(sim.time + TICK_MS);
  sim.tick(sim.time + TICK_MS);
  assert.equal(sim.player.light, PLAYER_LIGHT, 'apagou');
});

test('tocha acesa troca o desenho pelo "Acesa como" do gerador', async () => {
  const { activeAs } = await import('../shared/assets.js');
  const TORCH = 'itens/fontes-de-luz/torch';
  const LIT = 'itens/fontes-de-luz/torch-acesa';
  const a = (id, propriedades) => ({ id, ferramenta: 'objetos', grupo: 'itens', pasta: 'fontes-de-luz', nome: id.split('/').pop(), rotulo: 'itens › fontes-de-luz', url: '/t.png', quadro: 32, quadros: 1, pecas: [], propriedades });
  setAssets([a(TORCH, { move: true, luz: 6, ativoComo: LIT }), a(LIT, { move: true, luz: 6 })]);
  assert.equal(activeAs(TORCH), LIT);
  assert.equal(activeAs(LIT), null);
});

test('tocha acesa gasta como no Tibia (20 min); apagada não gasta; acabou, some', () => {
  const TORCH = 'itens/fontes-de-luz/torch';
  setAssets([{ id: TORCH, ferramenta: 'objetos', grupo: 'itens', pasta: 'fontes-de-luz', nome: 'torch', rotulo: 'itens › fontes-de-luz', url: '/t.png', quadro: 32, quadros: 1, pecas: [], propriedades: { move: true, peso: 5, luz: 6, duracao: 1200 } }]);
  assert.equal(itemInfo(TORCH).burn, 1200);
  const sim = buildGame({ objects: floorRect(0, 10, 0, 10, 0), player: { x: 2, y: 2, z: 0 } });
  const torch = sim.player.equip.escudo;
  sim.inventory.burnLights(60000);
  assert.equal(torch.fuel, undefined, 'apagada não gasta');
  torch.lit = true;
  sim.inventory.burnLights(600000);
  assert.equal(torch.fuel, 600000);
  assert.equal(sim.player.toSave().equip.escudo.fuel, 600000, 'o que sobrou fica salvo');
  torch.lit = false;
  sim.inventory.burnLights(600000);
  assert.equal(torch.fuel, 600000);
  torch.lit = true;
  sim.inventory.burnLights(599000);
  assert.equal(sim.player.equip.escudo, torch);
  sim.inventory.burnLights(1000);
  assert.equal(sim.player.equip.escudo, null, 'queimou até o fim');
});

test('objeto fixo com Ativo como e Começa ativo (poste): usar alterna normal/ativo pra todos', async () => {
  const { serializeState } = await import('../js/net/protocol.js');
  const POST = 'decoracao/iluminacao/poste';
  const LIT = 'decoracao/iluminacao/poste-aceso';
  const asset = (id, props) => ({ id, ferramenta: 'objetos', grupo: 'decoracao', pasta: 'iluminacao', nome: id.split('/').pop(), rotulo: 'decoracao › iluminacao', url: `/${id}.png`, quadro: 64, quadros: 1, pecas: [], propriedades: props });
  setAssets([asset(POST, { move: false, bloqueia: true, luz: 6, ativoComo: LIT, comecaAtivo: true }), asset(LIT, { move: false, bloqueia: true, luz: 6 })]);
  const sim = buildGame({ objects: [...floorRect(0, 10, 0, 10, 0), [POST, 3, 2, 0, 0, false, false, true]], player: { x: 2, y: 2, z: 0 } });
  const post = sim.objects.find(o => o.id.startsWith(POST));
  assert.equal(post.active, true);
  assert.deepEqual(serializeState(sim, sim.player.id).active, [post.id]);
  sim.interactions.useObject(sim.player, post.id);
  assert.equal(post.active, false);
  assert.deepEqual(serializeState(sim, sim.player.id).active, []);
  sim.interactions.useObject(sim.player, post.id);
  assert.equal(post.active, true);
});
