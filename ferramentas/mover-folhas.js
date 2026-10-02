// ferramentas/mover-folhas.js

// Muda folhas do gerador de pasta sem quebrar nada: move a receita
// (gerador/projetos) e o PNG (gerador/saida), acerta grupo/pasta/nome dentro
// da receita e troca o caminho antigo pelo novo em tudo que aponta pra ele —
// mapa (objetos, NPCs, criaturas), outras receitas (vendas, loot,
// "abre como", "aceso como") e o código (shared, js, editor).
//
// Uso: node ferramentas/mover-folhas.js de para [de para …]
//   ex.: node ferramentas/mover-folhas.js estrutura/natureza/fogueira decoracao/iluminacao/fogueira
// Ou:  node ferramentas/mover-folhas.js --plano arquivo.json   ([["de", "para"], …])

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const PROJETOS = path.join(RAIZ, 'gerador', 'projetos');
const SAIDA = path.join(RAIZ, 'gerador', 'saida');
const PASTAS_DE_CODIGO = ['shared', 'js', 'editor/js'];

// ================================================================================================================================================================================================================================================
// lerPares

function lerPares(args) {
  if (args[0] === '--plano') return JSON.parse(fs.readFileSync(args[1], 'utf8'));
  if (!args.length || args.length % 2) throw new Error('Passe pares: de para [de para …]');
  const pares = [];
  for (let i = 0; i < args.length; i += 2) pares.push([args[i], args[i + 1]]);
  return pares;
}

// ================================================================================================================================================================================================================================================
// arquivos
// Todos os arquivos com a extensão dentro da pasta (recursivo).

function arquivos(pasta, extensao) {
  if (!fs.existsSync(pasta)) return [];
  return fs.readdirSync(pasta, { withFileTypes: true }).flatMap(item => {
    const caminho = path.join(pasta, item.name);
    if (item.isDirectory()) return arquivos(caminho, extensao);
    return item.name.endsWith(extensao) ? [caminho] : [];
  });
}

// ================================================================================================================================================================================================================================================
// moverFolha
// Receita e PNG de "de" pra "para"; dentro da receita, grupo/pasta/nome novos.

function moverFolha(de, para) {
  const origem = path.join(PROJETOS, `${de}.json`);
  const destino = path.join(PROJETOS, `${para}.json`);
  if (!fs.existsSync(origem)) throw new Error(`Não existe: gerador/projetos/${de}.json`);
  if (fs.existsSync(destino)) throw new Error(`Já existe: gerador/projetos/${para}.json`);
  const [grupo, pasta, nome] = para.split('/');
  const texto = fs.readFileSync(origem, 'utf8');
  const receita = JSON.parse(texto);
  Object.assign(receita, { grupo, pasta, nome });
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.writeFileSync(destino, JSON.stringify(receita, null, 2) + (texto.endsWith('\n') ? '\n' : ''));
  fs.unlinkSync(origem);
  const png = path.join(SAIDA, `${de}.png`);
  if (fs.existsSync(png)) {
    fs.mkdirSync(path.dirname(path.join(SAIDA, `${para}.png`)), { recursive: true });
    fs.renameSync(png, path.join(SAIDA, `${para}.png`));
  }
}

// ================================================================================================================================================================================================================================================
// trocarReferencias
// Troca o caminho antigo pelo novo onde ele aparece como valor: entre aspas,
// com peça (#x) ou como borda (Border:<folha>:n). Devolve quantas trocas.

function trocarReferencias(arquivo, pares) {
  const texto = fs.readFileSync(arquivo, 'utf8');
  let novo = texto;
  let trocas = 0;
  for (const [de, para] of pares) {
    const busca = new RegExp(`(["':])${de.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=["'#:])`, 'g');
    novo = novo.replace(busca, (_, antes) => {
      trocas++;
      return antes + para;
    });
  }
  if (trocas) fs.writeFileSync(arquivo, novo);
  return trocas;
}

// ================================================================================================================================================================================================================================================
// main

function main() {
  const pares = lerPares(process.argv.slice(2));
  for (const [de, para] of pares) moverFolha(de, para);
  const alvos = [
    path.join(RAIZ, 'data', 'map.json'),
    ...arquivos(PROJETOS, '.json'),
    ...PASTAS_DE_CODIGO.flatMap(pasta => arquivos(path.join(RAIZ, pasta), '.js'))
  ];
  for (const arquivo of alvos) {
    const trocas = trocarReferencias(arquivo, pares);
    if (trocas) console.log(`✏️  ${path.relative(RAIZ, arquivo)}: ${trocas} referência(s)`);
  }
  console.log(`✅ ${pares.length} folha(s) movida(s)`);
}

main();
