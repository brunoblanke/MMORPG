// gerador/server.js

const express = require('express');
const fs = require('fs');
const path = require('path');
const { TibiaAssets, paletaDeRoupa } = require('./tibia-assets.js');

// Gerador de sprites: programa à parte do jogo e do editor. Mostra os sprites
// do Tibia (tibia/780), monta folhas com as ferramentas (pisos, criaturas,
// paredes, objetos) na tela e grava na pasta escolhida (taxonomia.json):
//   saida/<grupo>/<pasta>/<nome>.png      a folha pronta, no formato do jogo
//   projetos/<grupo>/<pasta>/<nome>.json  a receita (de onde veio cada parte)
// Receitas antigas, de antes das pastas, ficam em projetos/<ferramenta>/<nome>.json.

const PORTA = process.env.PORT || 8100;
const PASTA_APP = path.join(__dirname, 'app');
const PASTA_TIBIA = path.join(__dirname, 'tibia', '780');
const PASTA_SAIDA = path.join(__dirname, 'saida');
const PASTA_PROJETOS = path.join(__dirname, 'projetos');
const FERRAMENTAS = ['pisos', 'criaturas', 'paredes', 'objetos'];
const TAXONOMIA = JSON.parse(fs.readFileSync(path.join(__dirname, 'taxonomia.json'), 'utf8'));
const NOME_VALIDO = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const app = express();
app.use(express.json({ limit: '20mb' }));
app.get('/api/catalogo', catalogo);
app.get('/api/sprite/:id/:variacao', spriteDoItem);
app.get('/api/bordas-sugeridas', bordasSugeridas);
app.get('/api/paredes-sugeridas', paredesSugeridas);
app.get('/api/portas-sugeridas', portasSugeridas);
app.get('/api/item/:id', infoDoItem);
app.get('/api/criatura/:id/miniatura', miniaturaCriatura);
app.get('/api/criatura/:id/folha', folhaDeCriatura);
app.get('/api/paleta', (req, res) => res.json({ success: true, cores: paletaDeRoupa() }));
app.get('/api/projetos', listarProjetos);
app.get('/api/taxonomia', (req, res) => res.json({ success: true, taxonomia: TAXONOMIA }));
app.get('/api/projeto', abrirProjeto);
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
    res.set('Cache-Control', 'no-cache');
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
    res.set('Cache-Control', 'no-cache');
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
    res.set({ 'Cache-Control': 'no-cache', 'X-Tamanho': folha.tamanho, 'X-Quadros': folha.quadros });
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
// infoDoItem

function infoDoItem(req, res) {
  try {
    const info = arquivosTibia().infoDoItem(parseInt(req.params.id, 10));
    if (!info) return res.status(404).json({ success: false, message: 'Item não existe.' });
    res.json({ success: true, item: info });
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
// portasSugeridas
// ?id=1682 → { sugestao: { pecas: { 'porta-x', 'porta-x-aberta', 'porta-y', 'porta-y-aberta' } } } ou sugestao null.

function portasSugeridas(req, res) {
  try {
    res.json({ success: true, sugestao: arquivosTibia().sugerirPortas(parseInt(req.query.id, 10)) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================================================================================================================================================================================================================
// pastaDaTaxonomia
// A pasta { id, nome, ferramenta } do grupo, ou null.

function pastaDaTaxonomia(grupo, pasta) {
  const g = TAXONOMIA.grupos.find(item => item.id === grupo);
  if (!g) return null;
  for (const secao of g.secoes) {
    const encontrada = secao.pastas.find(item => item.id === pasta);
    if (encontrada) return encontrada;
  }
  return null;
}

// ================================================================================================================================================================================================================================================
// lerCaminho
// 'grupo/pasta/nome' (ou o antigo 'ferramenta/nome') → { grupo, pasta, nome, ferramenta }, ou null.

function lerCaminho(caminho) {
  const partes = String(caminho || '').split('/');
  if (!partes.every(parte => NOME_VALIDO.test(parte))) return null;
  if (partes.length === 2 && FERRAMENTAS.includes(partes[0])) {
    return { grupo: null, pasta: null, nome: partes[1], ferramenta: partes[0] };
  }
  if (partes.length !== 3) return null;
  const pasta = pastaDaTaxonomia(partes[0], partes[1]);
  return pasta ? { grupo: partes[0], pasta: partes[1], nome: partes[2], ferramenta: pasta.ferramenta } : null;
}

// ================================================================================================================================================================================================================================================
// listarProjetos
// Todas as receitas salvas: [{ caminho, ferramenta, grupo, pasta, nome, atualizado }],
// mais novas primeiro. caminho é 'grupo/pasta/nome' ('ferramenta/nome' nas antigas).

function listarProjetos(req, res) {
  const projetos = [];
  const lerPasta = (relativa) => {
    const pasta = path.join(PASTA_PROJETOS, relativa);
    if (!fs.existsSync(pasta)) return;
    for (const arquivo of fs.readdirSync(pasta)) {
      if (!arquivo.endsWith('.json')) continue;
      const info = lerCaminho(`${relativa}/${arquivo.slice(0, -5)}`);
      if (!info) continue;
      const atualizado = fs.statSync(path.join(pasta, arquivo)).mtimeMs;
      projetos.push({ caminho: `${relativa}/${info.nome}`, ...info, atualizado });
    }
  };
  for (const ferramenta of FERRAMENTAS) lerPasta(ferramenta);
  for (const grupo of TAXONOMIA.grupos) {
    for (const secao of grupo.secoes) {
      for (const pasta of secao.pastas) lerPasta(`${grupo.id}/${pasta.id}`);
    }
  }
  projetos.sort((a, b) => b.atualizado - a.atualizado);
  res.json({ success: true, projetos });
}

// ================================================================================================================================================================================================================================================
// abrirProjeto
// ?caminho=grupo/pasta/nome → { receita }.

function abrirProjeto(req, res) {
  const info = lerCaminho(req.query.caminho);
  if (!info) return res.sendStatus(404);
  const arquivo = path.join(PASTA_PROJETOS, `${req.query.caminho}.json`);
  if (!fs.existsSync(arquivo)) return res.sendStatus(404);
  res.json({ success: true, receita: { ...JSON.parse(fs.readFileSync(arquivo, 'utf8')), grupo: info.grupo, pasta: info.pasta, nome: info.nome } });
}

// ================================================================================================================================================================================================================================================
// salvar
// { ferramenta, grupo, pasta, nome, receita, png } — png em base64 (a folha
// montada na tela); a pasta tem que ser da ferramenta.

function salvar(req, res) {
  const { ferramenta, grupo, pasta, nome, receita, png } = req.body || {};
  const destino = pastaDaTaxonomia(grupo, pasta);
  if (!destino) return res.status(400).json({ success: false, message: 'Escolha a pasta.' });
  if (destino.ferramenta !== ferramenta) return res.status(400).json({ success: false, message: `A pasta ${destino.nome} não é dessa ferramenta.` });
  if (!NOME_VALIDO.test(nome || '') || nome.length > 40) {
    return res.status(400).json({ success: false, message: 'Nome: letras minúsculas, números e hífen (ex.: grama-escura).' });
  }
  const imagem = Buffer.from(String(png || ''), 'base64');
  if (imagem.subarray(1, 4).toString() !== 'PNG') return res.status(400).json({ success: false, message: 'Imagem inválida.' });

  const caminho = `${grupo}/${pasta}/${nome}`;
  try {
    const arquivoPng = path.join(PASTA_SAIDA, `${caminho}.png`);
    const arquivoReceita = path.join(PASTA_PROJETOS, `${caminho}.json`);
    fs.mkdirSync(path.dirname(arquivoPng), { recursive: true });
    fs.mkdirSync(path.dirname(arquivoReceita), { recursive: true });
    fs.writeFileSync(arquivoPng, imagem);
    fs.writeFileSync(arquivoReceita, JSON.stringify({ ...receita, ferramenta, grupo, pasta, nome }, null, 2), 'utf8');
    console.log(`✅ ${caminho}.png salvo`);
    res.json({ success: true, caminho, arquivo: `saida/${caminho}.png` });
  } catch (err) {
    console.error('❌ Erro ao salvar:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}
