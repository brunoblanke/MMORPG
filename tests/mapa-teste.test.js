// tests/mapa-teste.test.js

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createRequire } from 'module';
import { execFileSync } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

test('o gerador do mapa de teste cria um mapa sem avisos na conferência do servidor', async () => {
  const arquivo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mapa-teste-')), 'mapa.json');
  execFileSync('node', [path.join(RAIZ, 'ferramentas', 'criar-mapa-teste.js'), arquivo]);
  const importar = (...p) => import(pathToFileURL(path.join(RAIZ, ...p)).href);
  const { setAssets } = await importar('shared', 'assets.js');
  setAssets(require(path.join(RAIZ, 'gerador', 'sprites.js')).lerSprites(RAIZ));
  const { Simulation } = await importar('js', 'simulation.js');
  const { validateWorld } = await importar('js', 'core', 'validate.js');
  const sim = new Simulation(JSON.parse(fs.readFileSync(arquivo, 'utf8')), { houses: {}, characters: {} });
  assert.deepEqual(validateWorld(sim), []);
  assert.ok(sim.world.houses.size >= 6);
  assert.ok(sim.mapData.spawn);
});
