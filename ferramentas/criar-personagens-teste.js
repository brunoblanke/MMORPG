// ferramentas/criar-personagens-teste.js

// Cria (ou refaz) os quatro personagens de teste — Druid, Paladin, Knight e
// Sorcerer —, nível 100, todos os skills em 100, com armas, munição e runas da
// vocação (js/net/test-characters.js) e a senha de teste. Grava no
// characters.json e no passwords.json da pasta de dados. Com o servidor
// ligado, use o botão "Players de teste" do editor; este script é pro servidor
// parado (ele guarda os personagens da memória a cada 10 s e apagaria os
// novos).
//
// Uso: node ferramentas/criar-personagens-teste.js [pasta de dados] [--senha X]
// (sem pasta: a de JOGO_PERSONAGENS, ou data/ do projeto; senha padrão 123456)

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const RAIZ = path.join(__dirname, '..');
const importar = (arquivo) => import(pathToFileURL(path.join(RAIZ, arquivo)).href);

// ================================================================================================================================================================================================================================================
// criar
// Grava os personagens e as senhas em pasta (characters.json e
// passwords.json). Devolve os nomes.

async function criar(pasta, senha) {
  const [{ createTestCharacters, TEST_PASSWORD }, { PasswordStore }] = await Promise.all([importar('js/net/test-characters.js'), importar('js/net/passwords.js')]);
  fs.mkdirSync(pasta, { recursive: true });
  const arquivoPersonagens = path.join(pasta, 'characters.json');
  let personagens = {};
  try {
    personagens = JSON.parse(fs.readFileSync(arquivoPersonagens, 'utf8')) || {};
  } catch {
    personagens = {};
  }
  const nomes = await createTestCharacters(personagens, new PasswordStore(path.join(pasta, 'passwords.json')), senha || TEST_PASSWORD);
  fs.writeFileSync(arquivoPersonagens, JSON.stringify(personagens, null, 2));
  return nomes;
}

// ================================================================================================================================================================================================================================================
// principal

async function principal() {
  const args = process.argv.slice(2);
  const iSenha = args.indexOf('--senha');
  const senha = iSenha >= 0 ? args[iSenha + 1] : undefined;
  const pasta = args.find((a, i) => !a.startsWith('--') && (iSenha < 0 || i !== iSenha + 1))
    || (process.env.JOGO_PERSONAGENS ? path.dirname(process.env.JOGO_PERSONAGENS) : path.join(RAIZ, 'data'));
  const nomes = await criar(path.resolve(pasta), senha);
  console.log(`✅ ${nomes.join(', ')} criados em ${path.resolve(pasta)}`);
}

if (require.main === module) principal();

module.exports = { criar };
