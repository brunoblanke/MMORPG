// gerador/server.js

const express = require('express');
const fs = require('fs');
const path = require('path');
const { TibiaAssets, paletaDeRoupa } = require('./tibia-assets.js');

// Gerador de sprites: programa à parte do jogo e do editor. Mostra os sprites
// do Tibia (tibia/780), monta folhas (pisos, criaturas, paredes) na tela e grava:
//   saida/<categoria>/<nome>.png      a folha pronta, no formato do jogo
//   projetos/<categoria>/<nome>.json  a receita (de onde veio cada parte)

const PORTA = process.env.PORT || 8100;
const PASTA_APP = path.join(__dirname, 'app');
const PASTA_TIBIA = path.join(__dirname, 'tibia', '780');
const PASTA_SAIDA = path.join(__dirname, 'saida');
const PASTA_PROJETOS = path.join(__dirname, 'projetos');
const CATEGORIAS = ['pisos', 'criaturas', 'paredes'];
const NOME_VALIDO = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const app = express();
app.use(express.json({ limit: '20mb' }));
app.get('/api/catalogo', catalogo);
app.get('/api/sprite/:id/:variacao', spriteDoItem);
app.get('/api/bordas-sugeridas', bordasSugeridas);
app.get('/api/paredes-sugeridas', paredesSugeridas);
app.get('/api/criatura/:id/miniatura', miniaturaCriatura);
app.get('/api/criatura/:id/folha', folhaDeCriatura);
app.get('/api/paleta', (req, res) => res.json({ success: true, cores: paletaDeRoupa() }));
app.get('/api/projetos', listarProjetos);
app.get('/api/projetos/:categoria/:nome', abrirProjeto);
app.post('/api/salvar', salvar);
app.use('/saida', express.static(PASTA_SAIDA));
app.use(express.static(PASTA_APP));

let tibia = null;

app.listen(PORTA, () => {
  console.log(`\n🎨 Gerador de sprites em http://localhost:${PORTA}`);
  console.log(`📁 PNGs prontos em ${PASTA_SAIDA}\n`);
});

// ================================================================================================================================================================================================================================================
// arquivosTibia
// Tibia.spr/Tibia.dat, lidos na 1ª vez que a tela pede.

function arquivosTibia() {
  if (!tibia) tibia = new TibiaAssets(PASTA_TIBIA);
  return tibia;
}

// ================================================================================================================================================================================================================================================
// catalogo

function catalogo(req, res) {
  try {
    res.json({ success: true, ...arquivosTibia().catalogo() });
  } catch (err) {
    console.error('❌ Tibia:', err.message);
    res.status(500).json({ success: false, message: `Não foi possível ler tibia/780: ${err.message}` });
  }
}

// ================================================================================================================================================================================================================================================
// spriteDoItem

function spriteDoItem(req, res) {
  const id = parseInt(req.params.id, 10);
  const variacao = parseInt(req.params.variacao, 10);
  const quadro = parseInt(req.query.quadro || '0', 10);
  try {
    const png = arquivosTibia().spriteDoItem(id, variacao, quadro);
    if (!png) return res.sendStatus(404);
    res.set('Cache-Control', 'public, max-age=86400');
    res.type('png').send(png);
  } catch (err) {
    res.sendStatus(500);
  }
}

// ================================================================================================================================================================================================================================================
// miniaturaCriatura

function miniaturaCriatura(req, res) {
  try {
    const png = arquivosTibia().miniaturaCriatura(parseInt(req.params.id, 10));
    if (!png) return res.sendStatus(404);
    res.set('Cache-Control', 'public, max-age=86400');
    res.type('png').send(png);
  } catch (err) {
    res.sendStatus(500);
  }
}

// ================================================================================================================================================================================================================================================
// folhaDeCriatura
// ?cores=78,69,58,76&addons=1,2 → PNG (4 direções × quadros); tamanho e
// quadros vão nos cabeçalhos X-Tamanho e X-Quadros.

function folhaDeCriatura(req, res) {
  const lista = (texto) => String(texto || '').split(',').filter(Boolean).map(n => parseInt(n, 10)).filter(Number.isInteger);
  const cores = lista(req.query.cores);
  try {
    const folha = arquivosTibia().folhaDeCriatura(parseInt(req.params.id, 10), {
      cores: cores.length === 4 ? cores : undefined,
      addons: lista(req.query.addons)
    });
    if (!folha) return res.sendStatus(404);
    res.set({ 'Cache-Control': 'public, max-age=86400', 'X-Tamanho': folha.tamanho, 'X-Quadros': folha.quadros });
    res.type('png').send(folha.png);
  } catch (err) {
    res.sendStatus(500);
  }
}

// ================================================================================================================================================================================================================================================
// bordasSugeridas
// ?chao=4526,4527 → { sugestao: { pecas, conjunto } } ou sugestao null.

function bordasSugeridas(req, res) {
  const ids = String(req.query.chao || '').split(',').map(n => parseInt(n, 10)).filter(Number.isInteger);
  try {
    res.json({ success: true, sugestao: ids.length ? arquivosTibia().sugerirBordas(ids) : null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================================================================================================================================================================================================================
// paredesSugeridas
// ?id=1271 → { sugestao: { pecas: { x, y, xy, yx } } } ou sugestao null.

function paredesSugeridas(req, res) {
  try {
    res.json({ success: true, sugestao: arquivosTibia().sugerirParedes(parseInt(req.query.id, 10)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================================================================================================================================================================================================================
// listarProjetos
// Todas as receitas salvas: [{ categoria, nome, atualizado }], mais novas primeiro.

function listarProjetos(req, res) {
  const projetos = [];
  for (const categoria of CATEGORIAS) {
    const pasta = path.join(PASTA_PROJETOS, categoria);
    if (!fs.existsSync(pasta)) continue;
    for (const arquivo of fs.readdirSync(pasta)) {
      if (!arquivo.endsWith('.json')) continue;
      const atualizado = fs.statSync(path.join(pasta, arquivo)).mtimeMs;
      projetos.push({ categoria, nome: arquivo.slice(0, -5), atualizado });
    }
  }
  projetos.sort((a, b) => b.atualizado - a.atualizado);
  res.json({ success: true, projetos });
}

// ================================================================================================================================================================================================================================================
// abrirProjeto

function abrirProjeto(req, res) {
  const { categoria, nome } = req.params;
  if (!CATEGORIAS.includes(categoria) || !NOME_VALIDO.test(nome)) return res.sendStatus(404);
  const arquivo = path.join(PASTA_PROJETOS, categoria, `${nome}.json`);
  if (!fs.existsSync(arquivo)) return res.sendStatus(404);
  res.json({ success: true, receita: JSON.parse(fs.readFileSync(arquivo, 'utf8')) });
}

// ================================================================================================================================================================================================================================================
// salvar
// { categoria, nome, receita, png } — png em base64 (a folha montada na tela).

function salvar(req, res) {
  const { categoria, nome, receita, png } = req.body || {};
  if (!CATEGORIAS.includes(categoria)) return res.status(400).json({ success: false, message: 'Categoria inválida.' });
  if (!NOME_VALIDO.test(nome || '') || nome.length > 40) {
    return res.status(400).json({ success: false, message: 'Nome: letras minúsculas, números e hífen (ex.: grama-escura).' });
  }
  const imagem = Buffer.from(String(png || ''), 'base64');
  if (imagem.subarray(1, 4).toString() !== 'PNG') return res.status(400).json({ success: false, message: 'Imagem inválida.' });

  try {
    const arquivoPng = path.join(PASTA_SAIDA, categoria, `${nome}.png`);
    const arquivoReceita = path.join(PASTA_PROJETOS, categoria, `${nome}.json`);
    fs.mkdirSync(path.dirname(arquivoPng), { recursive: true });
    fs.mkdirSync(path.dirname(arquivoReceita), { recursive: true });
    fs.writeFileSync(arquivoPng, imagem);
    fs.writeFileSync(arquivoReceita, JSON.stringify({ ...receita, categoria, nome }, null, 2), 'utf8');
    console.log(`✅ ${categoria}/${nome}.png salvo`);
    res.json({ success: true, arquivo: `saida/${categoria}/${nome}.png` });
  } catch (err) {
    console.error('❌ Erro ao salvar:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}
