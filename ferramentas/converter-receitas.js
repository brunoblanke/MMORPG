// ferramentas/converter-receitas.js

// Passa para dentro de cada receita do gerador o que hoje o jogo adivinha pela pasta, pra pasta virar só
// organização: o espaço do inventário (slot) e a skill da arma dos itens, a transição (escada, buraco ou nenhuma) dos objetos
// e se a peça fechada de parede barra o arremesso e apoia item. Só acrescenta campos que a receita ainda não tem
// (pode rodar de novo), e confere no fim que nada mudou de comportamento.
//
// Uso: node ferramentas/converter-receitas.js [--conferir]   (--conferir só mostra o que mudaria)

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { lerSprites } = require('../gerador/sprites.js');

const RAIZ = path.join(__dirname, '..');

// ================================================================================================================================================================================================================================================
// importar

const importar = (...partes) => import(pathToFileURL(path.join(RAIZ, ...partes)).href);

// ================================================================================================================================================================================================================================================
// comportamento
// O que o jogo faz com cada receita, pra comparar antes e depois da conversão.

function comportamento(assets, items, sprites) {
  const resultado = {};
  for (const s of sprites) {
    const info = s.ferramenta === 'objetos' ? items.itemInfo(s.id) : null;
    resultado[s.id] = {
      slot: info ? info.slot : null,
      skill: info ? info.weaponSkill : null,
      escada: assets.isStairsType(s.id),
      buraco: assets.isHoleType(s.id),
      arremesso: s.ferramenta === 'paredes' ? assets.blocksThrow(`${s.id}#x`) : null,
      apoia: s.ferramenta === 'paredes' ? !!assets.supportsItems(`${s.id}#x`) : null
    };
  }
  return resultado;
}

// ================================================================================================================================================================================================================================================
// principal

async function principal() {
  const apenasConferir = process.argv.includes('--conferir');
  const assets = await importar('shared', 'assets.js');
  const items = await importar('shared', 'items.js');
  const sprites = lerSprites(RAIZ, { todas: true });
  assets.setAssets(sprites);
  const antes = comportamento(assets, items, sprites);
  const alteradas = [];

  for (const sprite of sprites) {
    const arquivo = path.join(RAIZ, 'gerador', 'projetos', `${sprite.id}.json`);
    const receita = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    const props = receita.propriedades || {};
    const novas = {};
    if (sprite.ferramenta === 'objetos') {
      const comportamentoAtual = antes[sprite.id];
      if (props.slot === undefined && comportamentoAtual.slot) novas.slot = comportamentoAtual.slot;
      if (props.skillArma === undefined && comportamentoAtual.skill) novas.skillArma = comportamentoAtual.skill;
      if (props.transicao === undefined) {
        if (comportamentoAtual.escada) novas.transicao = 'escada';
        else if (comportamentoAtual.buraco) novas.transicao = 'buraco';
        else if (sprite.pasta === 'escadas' || sprite.pasta === 'entradas') novas.transicao = 'nenhuma';
      }
    } else if (sprite.ferramenta === 'paredes') {
      const colisao = props.colisao || {};
      const novaColisao = { ...colisao };
      if (typeof colisao.arremesso !== 'boolean') novaColisao.arremesso = antes[sprite.id].arremesso;
      if (typeof colisao.apoia !== 'boolean') novaColisao.apoia = antes[sprite.id].apoia;
      if (JSON.stringify(novaColisao) !== JSON.stringify(colisao)) novas.colisao = novaColisao;
    }
    if (!Object.keys(novas).length) continue;
    alteradas.push(sprite.id);
    if (apenasConferir) continue;
    receita.propriedades = { ...props, ...novas };
    fs.writeFileSync(arquivo, JSON.stringify(receita, null, 2) + '\n');
  }

  if (!apenasConferir) {
    const depois = lerSprites(RAIZ, { todas: true });
    assets.setAssets(depois);
    const comparado = comportamento(assets, items, depois);
    const diferentes = Object.keys(antes).filter(id => JSON.stringify(antes[id]) !== JSON.stringify(comparado[id]));
    if (diferentes.length) {
      console.error(`❌ Mudou o comportamento de: ${diferentes.join(', ')}`);
      process.exit(1);
    }
  }
  console.log(`${apenasConferir ? 'Mudariam' : 'Convertidas'}: ${alteradas.length} receitas de ${sprites.length}. Comportamento conferido.`);
}

principal();
