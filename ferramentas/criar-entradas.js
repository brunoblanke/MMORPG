// ferramentas/criar-entradas.js

// Cria no gerador as receitas dos buracos clássicos do Tibia (pasta
// estrutura/entradas): buracos, buracos grandes, armadilhas (pitfall),
// alçapões e entradas de caverna. Só entram os desenhos que o Canary marca
// como "floorchange down" (os que levam pro andar de baixo). As folhas (.png)
// saem do gerador: aba Objetos → "Gerar folhas pendentes". Receita que já
// existe (ou desenho que já tem receita) fica como está.
//
// Uso: node ferramentas/criar-entradas.js <pasta do canary>
// (pasta com data/items/items.xml)

const fs = require('fs');
const path = require('path');
const { listarReceitas, idsDoTibia } = require('./receitas.js');

const RAIZ = path.join(__dirname, '..');
const PASTA_PROJETOS = path.join(RAIZ, 'gerador', 'projetos');
const PASTA = path.join(PASTA_PROJETOS, 'estrutura', 'entradas');

const GRUPOS = {
  buraco: [385, 394, 594, 595, 607, 610, 615, 868, 5731, 7515, 7516, 7517, 7518, 7520, 7521, 7737, 7755],
  'buraco-grande': [874, 7522, 8144],
  armadilha: [294, 1080],
  alcapao: [369, 370, 411, 412, 434, 476, 484, 1156, 5544, 5691, 6172, 7053],
  'entrada-caverna': [877, 7181, 7182, 7476, 7477, 7478, 7479]
};

// ================================================================================================================================================================================================================================================
// idsQueDescem
// Os ids do items.xml com floorchange "down".

function idsQueDescem(arquivo) {
  const texto = fs.readFileSync(arquivo, 'utf8');
  const ids = new Set();
  for (const m of texto.matchAll(/<item (?:id="(\d+)"|fromid="(\d+)" toid="(\d+)")[^>]*?>([\s\S]*?)<\/item>/g)) {
    if (!/key="floorchange" value="down"/.test(m[4])) continue;
    const de = Number(m[1] || m[2]);
    const ate = Number(m[1] || m[3]);
    for (let id = de; id <= ate; id++) ids.add(id);
  }
  return ids;
}

// ================================================================================================================================================================================================================================================
// principal

function principal() {
  const canary = process.argv[2];
  if (!canary) throw new Error('Passe a pasta do canary (com data/items/items.xml).');
  const descem = idsQueDescem(path.join(canary, 'data', 'items', 'items.xml'));
  const usados = idsDoTibia(listarReceitas(PASTA_PROJETOS, 'estrutura', 'decoracao', 'itens'));
  fs.mkdirSync(PASTA, { recursive: true });
  let criadas = 0;
  for (const [grupo, ids] of Object.entries(GRUPOS)) {
    let numero = 0;
    for (const id of ids) {
      if (!descem.has(id) || usados.has(id)) continue;
      let nome;
      do nome = `${grupo}-${++numero}`; while (fs.existsSync(path.join(PASTA, `${nome}.json`)));
      const receita = {
        formato: { quadro: 32, quadros: 1 },
        objeto: { tibia: { id, variacao: 0 } },
        propriedades: { bloqueia: false, move: false, altura: false, empilhavel: false, peso: 9999, espacos: 0, atk: 0, def: 0, ml: 0 },
        ferramenta: 'objetos', grupo: 'estrutura', pasta: 'entradas', nome
      };
      fs.writeFileSync(path.join(PASTA, `${nome}.json`), JSON.stringify(receita, null, 2) + '\n');
      console.log(`✅ ${nome} (${id})`);
      criadas++;
    }
  }
  console.log(`${criadas} receita(s) criada(s). Falta gerar as folhas: gerador → Objetos → "Gerar folhas pendentes".`);
}

principal();
