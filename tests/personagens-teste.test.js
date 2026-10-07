// tests/personagens-teste.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { setAssets } from '../shared/assets.js';
import { Simulation } from '../js/simulation.js';
import { PasswordStore } from '../js/net/passwords.js';
import { buildMapData, floorRect } from './helpers/fixture.js';

const require = createRequire(import.meta.url);
const { criar } = require('../ferramentas/criar-personagens-teste.js');
const PROJETOS = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'gerador', 'projetos');

// ================================================================================================================================================================================================================================================
// carregarReceitas
// As folhas do gerador como o servidor entrega ao jogo (id, pasta e propriedades).

function carregarReceitas() {
  const lista = [];
  for (const grupo of fs.readdirSync(PROJETOS)) {
    for (const pasta of fs.readdirSync(path.join(PROJETOS, grupo))) {
      const dir = path.join(PROJETOS, grupo, pasta);
      if (!fs.statSync(dir).isDirectory()) continue;
      for (const arquivo of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
        const receita = JSON.parse(fs.readFileSync(path.join(dir, arquivo), 'utf8'));
        const nome = arquivo.slice(0, -5);
        lista.push({ id: `${grupo}/${pasta}/${nome}`, ferramenta: grupo === 'criaturas' ? 'criaturas' : 'objetos', grupo, pasta, nome, url: '/x.png', quadro: 32, quadros: 1, pecas: [], propriedades: receita.propriedades || null });
      }
    }
  }
  return lista;
}

test('personagens de teste: nível 100, skills 100, equipamento da vocação carregado e senha 123456', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'jogo-teste-'));
  try {
    const nomes = await criar(pasta);
    assert.deepEqual(nomes, ['Druid', 'Paladin', 'Knight', 'Sorcerer']);
    const salvos = JSON.parse(fs.readFileSync(path.join(pasta, 'characters.json'), 'utf8'));
    const senhas = new PasswordStore(path.join(pasta, 'passwords.json'));
    setAssets(carregarReceitas());
    const sim = new Simulation(buildMapData({ objects: floorRect(0, 20, 0, 20, 0), spawn: { x: 5, y: 5, z: 0 } }));
    const jogadores = {};
    for (const nome of nomes) {
      assert.equal(await senhas.verify(nome, '123456'), true);
      assert.equal(await senhas.verify(nome, 'outra'), false);
      const salvo = salvos[nome.toLowerCase()];
      const player = sim.addPlayer(`id-${nome}`, { name: nome, saved: salvo });
      jogadores[nome] = player;
      assert.equal(player.lvl, 100);
      assert.equal(player.vocation, nome.toLowerCase());
      assert.ok(Object.values(player.skills).every(skill => skill.lvl === 100));
      for (const [chave, plano] of Object.entries(salvo.equip)) {
        if (plano) assert.ok(player.equip[chave], `${nome}: ${chave} (${plano.type}) não carregou`);
      }
      assert.ok(player.equip.mochila.items.filter(Boolean).length >= 8);
      assert.ok(player.equip.mochila.items.filter(Boolean).every(item => !item.charges));
    }
    const mortes = jogadores.Sorcerer.equip.mochila.items.find(item => item && item.type.endsWith('sudden-death-rune'));
    assert.equal(mortes.count, 50);
    const paladin = jogadores.Paladin;
    const arco = sim.combat.rangedWeapon(paladin);
    assert.ok(!arco.error && arco.ammo.item.count === 100);
    assert.equal(paladin.equip.escudo, null);
    assert.ok(!sim.combat.rangedWeapon(jogadores.Sorcerer).error);
    assert.ok(!sim.combat.rangedWeapon(jogadores.Druid).error);
    assert.equal(sim.combat.rangedWeapon(jogadores.Knight), null);
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});
