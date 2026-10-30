// tests/editor-fill.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { areaCells, fillActive, brushSize, areaDrag } from '../editor/js/model/brush.js';
import { setAssets } from '../shared/assets.js';
import { state } from '../editor/js/model/state.js';
import { GRID } from '../editor/js/config.js';

test('preencher área: os sqm do retângulo entre os dois cantos, em qualquer ordem, dentro do mapa', () => {
  assert.equal(areaCells({ x0: 2, y0: 3, x1: 4, y1: 1 }).length, 9);
  assert.deepEqual(areaCells({ x0: 5, y0: 5, x1: 5, y1: 5 }), [{ x: 5, y: 5 }]);
  assert.equal(areaCells({ x0: -3, y0: 0, x1: 1, y1: 0 }).length, 2);
  assert.ok(areaCells({ x0: GRID - 2, y0: 0, x1: GRID + 5, y1: 0 }).every(c => c.x < GRID));
});

test('as ferramentas de pintar sabem preencher área, não as de pôr uma coisa só', () => {
  for (const tool of ['floor', 'item', 'deco', 'wall', 'eraser', 'safe', 'house']) {
    state.tool = tool;
    assert.equal(fillActive(), true, tool);
  }
  for (const tool of ['select', 'enemy', 'npc', 'spawn']) {
    state.tool = tool;
    assert.equal(fillActive(), false, tool);
  }
});

test('Acessos: a entrada usa pincel e área; a escada vai uma por vez; o teletransporte preenche área', () => {
  const asset = (id, propriedades) => ({ id, ferramenta: 'objetos', grupo: 'estrutura', pasta: id.split('/')[1], nome: id.split('/')[2], url: '/a.png', quadro: 32, quadros: 1, pecas: [], propriedades });
  setAssets([
    asset('estrutura/escadas/escada-de-teste', { transicao: 'escada' }),
    asset('estrutura/entradas/buraco-de-teste', { transicao: 'buraco' }),
    asset('estrutura/teletransportes/tp-de-teste', { uso: 'teleporte' })
  ]);
  state.tool = 'access';
  state.brushSize = 3;
  state.accessPaint = 'estrutura/escadas/escada-de-teste';
  assert.equal(fillActive(), false);
  assert.equal(brushSize(), 1);
  state.accessPaint = 'estrutura/entradas/buraco-de-teste';
  assert.equal(fillActive(), true);
  assert.equal(brushSize(), 3);
  state.accessPaint = 'estrutura/teletransportes/tp-de-teste';
  assert.equal(fillActive(), true);
  assert.equal(brushSize(), 1);
});

test('arrastar pinta por onde passa; com o botão Área ligado ou Shift, marca área (um inverte o outro)', () => {
  state.tool = 'floor';
  state.areaFill = false;
  assert.equal(areaDrag(), false);
  assert.equal(areaDrag(true), true);
  state.areaFill = true;
  assert.equal(areaDrag(), true);
  assert.equal(areaDrag(true), false);
  state.tool = 'enemy';
  assert.equal(areaDrag(), false);
  state.areaFill = false;
});
