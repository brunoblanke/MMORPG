// tests/criar-criaturas.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { receitaDoMonstro, itensDoGerador, CLASSICAS } = require('../ferramentas/criar-criaturas.js');

const TROLL = `local mType = Game.createMonsterType("Troll")
monster.experience = 20
monster.outfit = {
	lookType = 15,
	lookHead = 0,
	lookBody = 0,
	lookLegs = 0,
	lookFeet = 0,
	lookAddons = 0,
}
monster.health = 50
monster.maxHealth = 50
monster.corpse = 5960
monster.speed = 63
monster.flags = {
	hostile = true,
	targetDistance = 1,
	runHealth = 15,
}
monster.loot = {
	{ id = 3003, chance = 7950 }, -- rope
	{ name = "gold coin", chance = 65300, maxCount = 12 },
	{ name = "meat", chance = 15000 },
	{ name = "item que nao existe no gerador", chance = 1000 },
}
monster.attacks = {
	{ name = "melee", interval = 2000, chance = 100, minDamage = 0, maxDamage = -15 },
}
monster.defenses = {
	defense = 10,
	armor = 6,
}
monster.elements = {
	{ type = COMBAT_ENERGYDAMAGE, percent = 20 },
	{ type = COMBAT_EARTHDAMAGE, percent = -10 },
}
`;

test('criar-criaturas: a receita sai com vida, xp, velocidade ×2, comportamento, loot só de itens que existem e resistências', () => {
  const receita = receitaDoMonstro(TROLL, 'humanoides', 'troll', itensDoGerador());
  assert.equal(receita.criatura.id, 15);
  assert.equal(receita.nome, 'troll');
  assert.equal(receita.cadaver.fresco.tibia.id, 5960);
  const props = receita.propriedades;
  assert.deepEqual([props.vida, props.xp, props.velocidade, props.armadura, props.defesa, props.ataque], [50, 20, 126, 6, 10, 15]);
  assert.equal(props.comportamento, 'foge');
  assert.deepEqual(props.loot.map(item => item.tipo), ['itens/valiosos/gold-coin', 'itens/comidas/meet']);
  assert.deepEqual(props.loot[0], { tipo: 'itens/valiosos/gold-coin', chance: 0.653, min: 1, max: 12 });
  assert.deepEqual(props.resistencias, { energy: 80, earth: 110 });
});

test('criar-criaturas: toda criatura da lista tem pasta que existe na taxonomia', () => {
  const taxonomia = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'gerador', 'taxonomia.json'), 'utf8'));
  const pastas = new Set(taxonomia.grupos.find(grupo => grupo.id === 'criaturas').secoes.flatMap(secao => secao.pastas.map(pasta => pasta.id)));
  for (const [, , pasta] of CLASSICAS) assert.ok(pastas.has(pasta), pasta);
});
