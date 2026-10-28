// tests/sprites-mapa.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setAssets } from '../shared/assets.js';
import { getSpritePaths } from '../js/views/sprite-registry.js';

const asset = (id, ferramenta, propriedades = {}) => {
  const [grupo, pasta, nome] = id.split('/');
  return { id, ferramenta, grupo, pasta, nome, rotulo: pasta, url: `/${id}.png`, quadro: 32, quadros: 1, pecas: [], propriedades };
};

setAssets([
  asset('estrutura/pisos/grama', 'pisos'),
  asset('estrutura/pisos/areia', 'pisos'),
  asset('decoracao/iluminacao/poste', 'objetos', { ativoComo: 'decoracao/iluminacao/poste-aceso' }),
  asset('decoracao/iluminacao/poste-aceso', 'objetos'),
  asset('itens/espadas/sword', 'objetos'),
  asset('criaturas/teste/rato', 'criaturas'),
  asset('criaturas/teste/dragao', 'criaturas'),
  asset('personagens/players/player-masculino', 'criaturas'),
  asset('personagens/players/player-feminino', 'criaturas')
]);

test('a tela de carregamento espera só as folhas que o mapa usa (e as dos players)', () => {
  const map = {
    objetosData: [['estrutura/pisos/grama#meio-1', 1, 1, 0], ['Border:estrutura/pisos/areia:nl', 1, 2, 0], ['decoracao/iluminacao/poste', 2, 2, 0]],
    enemyData: [[3, 3, 0, 1, 32, 'criaturas/teste/rato']]
  };
  const urls = getSpritePaths(map).sort();
  assert.deepEqual(urls, [
    '/criaturas/teste/rato.png', '/decoracao/iluminacao/poste-aceso.png', '/decoracao/iluminacao/poste.png',
    '/estrutura/pisos/areia.png', '/estrutura/pisos/grama.png',
    '/personagens/players/player-feminino.png', '/personagens/players/player-masculino.png'
  ]);
  assert.ok(!urls.includes('/itens/espadas/sword.png'), 'item fora do mapa carrega quando aparecer');
  assert.ok(!urls.includes('/criaturas/teste/dragao.png'));
});

test('sem mapa, espera todas', () => {
  assert.equal(getSpritePaths(null).length, 9);
});
