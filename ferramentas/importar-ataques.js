// ferramentas/importar-ataques.js

// Importa do Canary (servidor open source do Tibia) as magias e as resistências
// das criaturas que já estão no gerador (gerador/projetos/criaturas/**.json):
//   ataques: monster.attacks (combat, firefield, speed) e a cura de
//     monster.defenses, na forma do jogo (tiro, bola, onda, raio, campo,
//     lentidão, cura);
//   resistencias: monster.elements (percent 25 = leva 75% do dano).
// Criatura que já tem `ataques` na receita (conferida à mão) fica como está,
// a não ser com --forcar; a que tem a `magia` própria (feita no gerador) só
// ganha as resistências. Lifedrain vira dano de morte; manadrain, drown e as
// condições não existem no jogo e são puladas.
//
// Uso: node ferramentas/importar-ataques.js <pasta do canary> [--forcar]
// (pasta com data-otservbr-global/monster, como na pre-classificar.js)

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const PASTA_CRIATURAS = path.join(RAIZ, 'gerador', 'projetos', 'criaturas');
const NOMES_DO_CANARY = { tortuguita: 'tortuguita' };
const ELEMENTO = {
  COMBAT_PHYSICALDAMAGE: 'physical', COMBAT_FIREDAMAGE: 'fire', COMBAT_ENERGYDAMAGE: 'energy', COMBAT_EARTHDAMAGE: 'earth',
  COMBAT_ICEDAMAGE: 'ice', COMBAT_DEATHDAMAGE: 'death', COMBAT_HOLYDAMAGE: 'holy', COMBAT_LIFEDRAIN: 'death'
};
const RESISTENCIA = {
  COMBAT_PHYSICALDAMAGE: 'physical', COMBAT_FIREDAMAGE: 'fire', COMBAT_ENERGYDAMAGE: 'energy', COMBAT_EARTHDAMAGE: 'earth',
  COMBAT_ICEDAMAGE: 'ice', COMBAT_DEATHDAMAGE: 'death', COMBAT_HOLYDAMAGE: 'holy'
};
const CAMPOS = { firefield: 'itens/itens-encantados/fire-field', poisonfield: 'itens/itens-encantados/poison-field', energyfield: 'itens/itens-encantados/energy-field' };

// ================================================================================================================================================================================================================================================
// receitas
// Os arquivos de receita de criatura: [{ arquivo, nome }].

function receitas() {
  const lista = [];
  for (const pasta of fs.readdirSync(PASTA_CRIATURAS)) {
    const dir = path.join(PASTA_CRIATURAS, pasta);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const arquivo of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) lista.push({ arquivo: path.join(dir, arquivo), nome: arquivo.replace(/\.json$/, '') });
  }
  return lista;
}

// ================================================================================================================================================================================================================================================
// acharMonstro
// O arquivo .lua do monstro no Canary pelo nome da receita, ou null.

function acharMonstro(raiz, nome) {
  const alvo = `${NOMES_DO_CANARY[nome] || nome}`.replace(/-/g, '_').toLowerCase() + '.lua';
  const procurar = (dir) => {
    for (const entrada of fs.readdirSync(dir, { withFileTypes: true })) {
      const caminho = path.join(dir, entrada.name);
      if (entrada.isDirectory()) {
        const achado = procurar(caminho);
        if (achado) return achado;
      } else if (entrada.name.toLowerCase() === alvo) return caminho;
    }
    return null;
  };
  return procurar(raiz);
}

// ================================================================================================================================================================================================================================================
// linhasDe
// As linhas { ... } do bloco `monster.<bloco> = { ... }` do arquivo, cada uma
// como { chave: valor }.

function linhasDe(texto, bloco) {
  const inicio = texto.indexOf(`monster.${bloco} = {`);
  if (inicio < 0) return [];
  const fim = texto.indexOf('\n}', inicio);
  return texto.slice(inicio, fim).split('\n').filter(l => /^\s*\{.*\}/.test(l)).map(linha => {
    const campos = {};
    for (const [, chave, valor] of linha.matchAll(/(\w+)\s*=\s*("[^"]*"|[\w.-]+)/g)) campos[chave] = valor.replace(/"/g, '');
    return campos;
  });
}

// ================================================================================================================================================================================================================================================
// ataqueDoCanary
// Uma linha de monster.attacks na forma do jogo, ou null se não dá pra
// importar.

function ataqueDoCanary(l) {
  const n = (valor) => Math.abs(Number(valor) || 0);
  const chance = Math.max(1, Math.min(100, n(l.chance)));
  if (CAMPOS[l.name]) return { forma: 'campo', campo: CAMPOS[l.name], chance, alcance: n(l.range) || 7, raio: n(l.radius) };
  if (l.name === 'speed') {
    const velocidade = Number(l.speedChange) || 0;
    return velocidade < 0 && l.target === 'true' ? { forma: 'lentidao', velocidade, ms: n(l.duration) || 10000, chance, alcance: n(l.range) || 7 } : null;
  }
  if (l.name !== 'combat' || !ELEMENTO[l.type]) return null;
  const elemento = ELEMENTO[l.type];
  const dano = { elemento, min: Math.min(n(l.minDamage), n(l.maxDamage)), max: Math.max(n(l.minDamage), n(l.maxDamage)), chance };
  if (n(l.length) && n(l.spread)) return { forma: 'onda', ...dano, comprimento: n(l.length), abertura: n(l.spread) };
  if (n(l.length)) return { forma: 'raio', ...dano, comprimento: n(l.length) };
  if (n(l.ring)) return { forma: 'anel', ...dano, raio: n(l.ring) };
  if (n(l.radius) && n(l.range)) return { forma: 'bola', ...dano, alcance: n(l.range), raio: Math.min(6, n(l.radius)) };
  if (n(l.radius)) return { forma: 'bola', ...dano, raio: Math.min(6, n(l.radius)), centro: 'si' };
  if (n(l.range)) return { forma: 'tiro', ...dano, alcance: n(l.range) };
  return null;
}

// ================================================================================================================================================================================================================================================
// importar
// Monta ataques e resistencias da criatura a partir do .lua; devolve também o
// que foi pulado.

function importar(texto) {
  const ataques = [];
  const pulados = [];
  for (const linha of linhasDe(texto, 'attacks')) {
    if (linha.name === 'melee') continue;
    const ataque = ataqueDoCanary(linha);
    if (ataque && (ataque.max > 0 || ataque.forma === 'campo' || ataque.forma === 'lentidao')) ataques.push(ataque);
    else pulados.push(`${linha.name} ${linha.type || ''}`.trim());
  }
  for (const linha of linhasDe(texto, 'defenses')) {
    if (linha.name === 'combat' && linha.type === 'COMBAT_HEALING') {
      ataques.push({ forma: 'cura', min: Math.abs(Number(linha.minDamage)) || 0, max: Math.abs(Number(linha.maxDamage)) || 0, chance: Math.max(1, Math.min(100, Number(linha.chance) || 10)) });
    } else pulados.push(`defesa ${linha.name} ${linha.type || ''}`.trim());
  }
  const resistencias = {};
  for (const linha of linhasDe(texto, 'elements')) {
    const elemento = RESISTENCIA[linha.type];
    if (elemento && Number(linha.percent)) resistencias[elemento] = Math.max(0, 100 - Number(linha.percent));
  }
  return { ataques, resistencias, pulados };
}

// ================================================================================================================================================================================================================================================
// principal

function principal() {
  const raiz = process.argv[2] ? path.join(process.argv[2], 'data-otservbr-global', 'monster') : null;
  if (!raiz || !fs.existsSync(raiz)) {
    console.error('Uso: node ferramentas/importar-ataques.js <pasta do canary> [--forcar]');
    process.exit(1);
  }
  const forcar = process.argv.includes('--forcar');
  for (const { arquivo, nome } of receitas()) {
    const receita = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
    const props = receita.propriedades || {};
    if (props.comportamento === 'npc') continue;
    const monstro = acharMonstro(raiz, nome);
    if (!monstro) {
      console.log(`⚠️  ${nome}: não está no Canary, ficou como está`);
      continue;
    }
    if (props.ataques && !forcar) {
      console.log(`⏭️  ${nome}: já tem magias na receita, ficou como está`);
      continue;
    }
    const { ataques, resistencias, pulados } = importar(fs.readFileSync(monstro, 'utf8'));
    const proprias = !!props.magia && !forcar;
    delete props.ataques;
    delete props.resistencias;
    if (ataques.length && !proprias) props.ataques = ataques;
    if (Object.keys(resistencias).length) props.resistencias = resistencias;
    receita.propriedades = props;
    fs.writeFileSync(arquivo, JSON.stringify(receita, null, 2) + (fs.readFileSync(arquivo, 'utf8').endsWith('\n') ? '\n' : ''));
    console.log(`✅ ${nome}: ${proprias ? 'magia própria mantida' : `${ataques.length} magia(s)`}, ${Object.keys(resistencias).length} resistência(s)${pulados.length ? ` — puladas: ${pulados.join(', ')}` : ''}`);
  }
}

if (require.main === module) principal();

module.exports = { importar, linhasDe };
