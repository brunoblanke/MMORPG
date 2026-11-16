// ferramentas/desenhar-sprites.js

// Desenha por código as sprites próprias do jogo (ferramentas/desenho/modelos.js: esqueleto 3D, poses e vetor na câmera
// do Tibia) e grava a folha (.png) em gerador/saida e a receita em gerador/projetos, prontas pro jogo e pro editor.
// O desenho é feito num navegador sem janela (Playwright), então roda onde ele existe (a sessão do Claude); as folhas
// vão pro git. A receita leva "desenho": o modelo e as cores, e as propriedades vêm de uma receita parecida (copiaDe)
// na 1ª vez; depois ficam como estiverem (o que o usuário mudar no gerador não é desfeito).
//
// Uso: node ferramentas/desenhar-sprites.js [pasta de prévia]

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const RAIZ = path.join(__dirname, '..');
const MODELOS = path.join(__dirname, 'desenho', 'modelos.js');
const LINHAS = ['sul', 'norte', 'leste', 'oeste', 'cadáver: fresco, apodrecendo, ossos'];

const SPRITES = [
  { tipo: 'personagens/players/aventureiro', ferramenta: 'criaturas', copiaDe: 'personagens/players/player-masculino', modelo: 'humano', visual: { pele: '#e2aa7c', cabelo: '#6b3b1d', camisa: '#3d5fb0', calca: '#6d4c2b', sapato: '#33241a' } },
  { tipo: 'personagens/players/aventureira', ferramenta: 'criaturas', copiaDe: 'personagens/players/player-feminino', modelo: 'humano', visual: { pele: '#e8b68c', cabelo: '#c9862b', camisa: '#b23a48', calca: '#7a2a36', sapato: '#33241a', feminino: true } },
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
    const dados = await pagina.evaluate(({ modelo, visual, argumento }) => {
      const canvas = visual ? folhaDeCriatura(window[modelo] || eval(modelo), visual) : eval(modelo)(argumento);
      return canvas.toDataURL('image/png').split(',')[1];
    }, sprite);
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
