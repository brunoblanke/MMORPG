// ferramentas/importar-racas.js

// Importa do Canary a raça das criaturas que já estão no gerador (monster.race → propriedades.raca): blood vira
// sangue (o padrão, que a receita não guarda), venom veneno, undead morto-vivo, fire fogo e energy energia. A raça diz
// o que o golpe físico mostra na criatura e o que fica no chão (shared/items.js → RACES). NPC e criatura que não está
// no Canary ficam como estão. Pode rodar de novo.
//
// Uso: node ferramentas/importar-racas.js <pasta do canary>
// (pasta com data-otservbr-global/monster, como em importar-ataques.js)

const fs = require('fs');
const path = require('path');
const { receitas, acharMonstro } = require('./importar-ataques.js');

const RACAS = { blood: 'sangue', venom: 'veneno', undead: 'morto-vivo', fire: 'fogo', energy: 'energia' };

// ================================================================================================================================================================================================================================================
// principal

function principal() {
  const raiz = process.argv[2] ? path.join(process.argv[2], 'data-otservbr-global', 'monster') : null;
  if (!raiz || !fs.existsSync(raiz)) {
    console.error('Uso: node ferramentas/importar-racas.js <pasta do canary>');
    process.exit(1);
  }
  const contagem = {};
  for (const { arquivo, nome } of receitas()) {
    const texto = fs.readFileSync(arquivo, 'utf8');
    const receita = JSON.parse(texto);
    const props = receita.propriedades || {};
    if (props.comportamento === 'npc') continue;
    const monstro = acharMonstro(raiz, nome);
    const achada = monstro && fs.readFileSync(monstro, 'utf8').match(/monster\.race\s*=\s*"([a-z]+)"/);
    if (!achada) {
      console.log(`⚠️  ${nome}: sem raça no Canary, ficou como está`);
      continue;
    }
    const raca = RACAS[achada[1]] || 'sangue';
    contagem[raca] = (contagem[raca] || 0) + 1;
    const antes = props.raca;
    if (raca === 'sangue') delete props.raca;
    else props.raca = raca;
    if (props.raca === antes) continue;
    receita.propriedades = props;
    fs.writeFileSync(arquivo, JSON.stringify(receita, null, 2) + (texto.endsWith('\n') ? '\n' : ''));
  }
  console.log(contagem);
}

principal();
