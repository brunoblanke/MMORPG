// ferramentas/desenhar-sprites.js

// Desenha por código as sprites próprias do jogo (ferramentas/desenho/modelos.js: esqueleto 3D, poses e vetor na câmera
// do Tibia) e grava a folha (.png) em gerador/saida e a receita em gerador/projetos, prontas pro jogo e pro editor.
// O desenho é feito num navegador sem janela (Playwright), então roda onde ele existe (a sessão do Claude); as folhas
// vão pro git. A receita leva "desenho": o modelo e as cores, e as propriedades vêm de uma receita parecida (copiaDe)
// na 1ª vez; depois ficam como estiverem (o que o usuário mudar no gerador não é desfeito).
//
// Uso: node ferramentas/desenhar-sprites.js [pasta de prévia]
// (na pasta de prévia vão também as folhas das criaturas 4× maiores, pra ver os detalhes)

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const RAIZ = path.join(__dirname, '..');
const MODELOS = path.join(__dirname, 'desenho', 'modelos.js');
const LINHAS = ['sul', 'norte', 'leste', 'oeste', 'cadáver: fresco, apodrecendo, ossos'];

const SPRITES = [
  { tipo: 'personagens/players/aventureiro', ferramenta: 'criaturas', copiaDe: 'personagens/players/player-masculino', modelo: 'humano', visual: { pele: '#e2aa7c', cabelo: '#5a3418', camisa: '#5f7896', calca: '#3f4a5c', sapato: '#2c2620', bota: '#4a3626', cinto: '#3a2616', detalhe: '#e2b34a', luva: '#4a3626', bracadeira: '#8fa3ba', ombreira: '#9fb2c8', espetado: true, espada: true } },
  { tipo: 'personagens/players/aventureira', ferramenta: 'criaturas', copiaDe: 'personagens/players/player-feminino', modelo: 'humano', visual: { pele: '#e8b68c', cabelo: '#c9862b', camisa: '#3f7a52', calca: '#2f5c40', sapato: '#33241a', bota: '#5a3a22', cinto: '#4a2f1c', detalhe: '#e8d27a', luva: '#5a3a22', feminino: true, cajado: '#6fd0f0' } },
  { tipo: 'criaturas/mamiferos/lobo-cinzento', ferramenta: 'criaturas', copiaDe: 'criaturas/mamiferos/wolf', modelo: 'lobo', visual: { pelo: '#8a8782', barriga: '#b9b5ad', olho: '#f2d23c' } },
  { tipo: 'decoracao/adornos/caixote', ferramenta: 'objetos', copiaDe: 'decoracao/moveis/harp', modelo: 'caixote', quadro: 32 },
  { tipo: 'decoracao/adornos/barril', ferramenta: 'objetos', copiaDe: 'decoracao/moveis/harp', modelo: 'barril', quadro: 32 },
  { tipo: 'decoracao/iluminacao/poste', ferramenta: 'objetos', copiaDe: 'decoracao/moveis/harp', modelo: 'poste', quadro: 64, propriedades: { move: false, ativoComo: 'decoracao/iluminacao/poste-aceso' } },
  { tipo: 'decoracao/iluminacao/poste-aceso', ferramenta: 'objetos', copiaDe: 'decoracao/moveis/harp', modelo: 'poste', argumento: true, quadro: 64, propriedades: { move: false, luz: 6, ativoComo: 'decoracao/iluminacao/poste' } }
];

// ================================================================================================================================================================================================================================================
// receitaDe
// A receita do sprite: a que já existe (só o desenho é atualizado) ou uma nova com as propriedades da parecida.

function receitaDe(sprite) {
  const arquivo = path.join(RAIZ, 'gerador', 'projetos', `${sprite.tipo}.json`);
  const [grupo, pasta, nome] = sprite.tipo.split('/');
  const desenho = { modelo: sprite.modelo, ...(sprite.visual ? { visual: sprite.visual } : {}) };
  if (fs.existsSync(arquivo)) return { ...JSON.parse(fs.readFileSync(arquivo, 'utf8')), desenho };
  const parecida = JSON.parse(fs.readFileSync(path.join(RAIZ, 'gerador', 'projetos', `${sprite.copiaDe}.json`), 'utf8'));
  const formato = sprite.ferramenta === 'criaturas' ? { quadro: 64, quadros: 9, linhas: LINHAS } : { quadro: sprite.quadro, quadros: 1 };
  return {
    formato,
    desenho,
    ...(sprite.ferramenta === 'criaturas' ? { cadaver: { fresco: { desenho: true }, apodrecendo: { desenho: true }, ossos: { desenho: true } } } : {}),
    propriedades: { ...parecida.propriedades, ...(sprite.propriedades || {}) },
    ferramenta: sprite.ferramenta,
    grupo,
    pasta,
    nome
  };
}

// ================================================================================================================================================================================================================================================
// principal

async function principal() {
  const previa = process.argv[2] ? path.resolve(process.argv[2]) : null;
  const navegador = await chromium.launch();
  const pagina = await navegador.newPage();
  await pagina.addScriptTag({ content: fs.readFileSync(MODELOS, 'utf8') });
  for (const sprite of SPRITES) {
    const desenhar = ({ modelo, visual, argumento, ampliar }) => {
      const canvas = visual ? folhaDeCriatura(eval(modelo), visual, ampliar) : eval(modelo)(argumento);
      return canvas.toDataURL('image/png').split(',')[1];
    };
    const dados = await pagina.evaluate(desenhar, { ...sprite, ampliar: 1 });
    if (previa && sprite.visual) fs.writeFileSync(path.join(previa, `${sprite.tipo.split('/').pop()}-4x.png`), Buffer.from(await pagina.evaluate(desenhar, { ...sprite, ampliar: 4 }), 'base64'));
    const png = Buffer.from(dados, 'base64');
    const saida = path.join(RAIZ, 'gerador', 'saida', `${sprite.tipo}.png`);
    const receita = path.join(RAIZ, 'gerador', 'projetos', `${sprite.tipo}.json`);
    fs.mkdirSync(path.dirname(saida), { recursive: true });
    fs.mkdirSync(path.dirname(receita), { recursive: true });
    fs.writeFileSync(receita, JSON.stringify(receitaDe(sprite), null, 2));
    fs.writeFileSync(saida, png);
    if (previa) fs.writeFileSync(path.join(previa, `${sprite.tipo.split('/').pop()}.png`), png);
    console.log(`✅ ${sprite.tipo}`);
  }
  await navegador.close();
}

principal();
