// ferramentas/ajustar-personagem.js

// Muda o nível e os skills de um personagem guardado (characters.json), com o servidor PARADO
// (ele guarda os personagens na memória e sobrescreveria a mudança).
//
// Uso: node ferramentas/ajustar-personagem.js "Nome do personagem" --nivel 10 --sword 50 --shielding 50 --magic 50
//   --arquivo caminho/characters.json   (padrão: JOGO_PERSONAGENS ou data/characters.json)
// Skills aceitos: magic, e os de shared/skills.js (fist, club, sword, axe, distance, shielding, fishing).
// Guarda uma cópia do arquivo ao lado (characters.json.antes-de-ajustar) antes de mexer.

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');

// ================================================================================================================================================================================================================================================
// lerArgumentos

function lerArgumentos(lista) {
  const nome = lista[0];
  const opcoes = {};
  for (let i = 1; i < lista.length; i += 2) opcoes[lista[i].replace(/^--/, '')] = lista[i + 1];
  return { nome, opcoes };
}

// ================================================================================================================================================================================================================================================
// ajustar

async function ajustar() {
  const { nome, opcoes } = lerArgumentos(process.argv.slice(2));
  if (!nome || nome.startsWith('--')) {
    console.log('Uso: node ferramentas/ajustar-personagem.js "Nome" --nivel 10 --sword 50 --shielding 50 --magic 50');
    process.exit(1);
  }
  const { SKILL_KEYS } = await import('../shared/skills.js');
  const arquivo = opcoes.arquivo || process.env.JOGO_PERSONAGENS || path.join(RAIZ, 'data', 'characters.json');
  const personagens = JSON.parse(fs.readFileSync(arquivo, 'utf8'));
  const chave = nome.trim().toLowerCase();
  const personagem = personagens[chave];
  if (!personagem) {
    console.log(`Não achei "${nome}". Personagens guardados: ${Object.values(personagens).map(p => p.name).join(', ')}`);
    process.exit(1);
  }
  const validos = ['magic', ...SKILL_KEYS];
  const nivel = opcoes.nivel === undefined ? null : Number(opcoes.nivel);
  if (nivel !== null && !(Number.isInteger(nivel) && nivel >= 1)) throw new Error('--nivel precisa ser um inteiro de 1 pra cima');
  const skills = Object.entries(opcoes).filter(([chaveSkill]) => chaveSkill !== 'nivel' && chaveSkill !== 'arquivo');
  for (const [skill, valor] of skills) {
    if (!validos.includes(skill) || !(Number.isInteger(Number(valor)) && Number(valor) >= 0)) throw new Error(`Skill inválido: --${skill} ${valor} (válidos: ${validos.join(', ')})`);
  }
  fs.copyFileSync(arquivo, arquivo + '.antes-de-ajustar');
  if (nivel !== null) {
    personagem.lvl = nivel;
    personagem.xp = 0;
    personagem.currentHp = 999999;
    personagem.mana = 999999;
  }
  personagem.skills = personagem.skills || {};
  for (const [skill, valor] of skills) personagem.skills[skill] = { lvl: Number(valor), tries: 0, pct: 0 };
  fs.writeFileSync(arquivo + '.tmp', JSON.stringify(personagens, null, 2), 'utf8');
  fs.renameSync(arquivo + '.tmp', arquivo);
  console.log(`${personagem.name}: nível ${personagem.lvl}, skills ${JSON.stringify(Object.fromEntries(skills.map(([s, v]) => [s, Number(v)])))}`);
}

ajustar().catch(erro => {
  console.error('❌', erro.message);
  process.exit(1);
});
