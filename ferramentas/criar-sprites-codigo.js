// ferramentas/criar-sprites-codigo.js

// Cria as receitas das sprites desenhadas por código (lista SPRITES). A receita leva "desenho" (modelo, cores e
// argumento de shared/desenho.js) e não tem .png: o jogo e o editor desenham a folha no navegador, em Canvas 2D.
// As propriedades vêm de uma receita parecida (copiaDe) na 1ª vez; depois ficam como estiverem (só o desenho é
// atualizado). Pra mudar um visual ou criar outro: editar SPRITES e rodar de novo.
//
// Uso: node ferramentas/criar-sprites-codigo.js

const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const LINHAS = ['sul', 'norte', 'leste', 'oeste', 'cadáver: fresco, apodrecendo, ossos'];

const SPRITES = [
  { tipo: 'personagens/players/aventureiro', ferramenta: 'criaturas', copiaDe: 'personagens/players/player-masculino', modelo: 'humano', visual: { pele: '#f0c09a', cabelo: '#7a4a26', camisa: '#3f66b8', calca: '#4a3a2e', sapato: '#6a4228', cinto: '#5a3820', fivela: '#e8b83a', alca: '#6e4526' } },
  { tipo: 'personagens/players/aventureira', ferramenta: 'criaturas', copiaDe: 'personagens/players/player-feminino', modelo: 'humano', visual: { pele: '#f2c6a2', cabelo: '#a4532c', camisa: '#4f8f52', calca: '#3e6e44', sapato: '#6a4228', cinto: '#5a3820', fivela: '#e8b83a', alca: '#6e4526', feminino: true } },
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
  const desenho = { modelo: sprite.modelo, ...(sprite.visual ? { visual: sprite.visual } : {}), ...(sprite.argumento !== undefined ? { argumento: sprite.argumento } : {}) };
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

function principal() {
  for (const sprite of SPRITES) {
    const arquivo = path.join(RAIZ, 'gerador', 'projetos', `${sprite.tipo}.json`);
    fs.mkdirSync(path.dirname(arquivo), { recursive: true });
    fs.writeFileSync(arquivo, JSON.stringify(receitaDe(sprite), null, 2));
    console.log(`✅ ${sprite.tipo}`);
  }
}

principal();
