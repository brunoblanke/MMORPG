// server.js

const express = require('express');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { WebSocketServer } = require('ws');
const { TibiaAssets } = require('./server/tibia-assets.js');
const app = express();

const PASTA_JOGO = __dirname;
const MAP_DATA_PATH = path.join(PASTA_JOGO, 'data', 'map.json');
const CHARACTERS_PATH = path.join(PASTA_JOGO, 'data', 'characters.json');
const TIBIA_CLIENT_PATH = path.join(PASTA_JOGO, 'img', '780');
const TIBIA_REGISTRY_PATH = path.join(PASTA_JOGO, 'data', 'tibia.json');
const IMG_PATH = path.join(PASTA_JOGO, 'img');
const SAVE_INTERVAL_MS = 10000;
const PORT = process.env.PORT || 8000;

app.use(express.text({ type: 'text/plain', limit: '50mb' }));
app.use(express.json({ limit: '50mb' }));
app.use(liberarCors);
app.post('/api/save-map', salvarMapa);
app.get('/api/tibia/catalog', catalogoTibia);
app.get('/api/tibia/thumb/:tipo/:id', miniaturaTibia);
app.post('/api/tibia/import', importarTibia);
app.use(express.static(PASTA_JOGO));

let tibia = null;
let registroTibia = null;
let modulosJogo = null;

const servidor = http.createServer(app);
iniciarJogo(servidor).then(() => iniciarServidor(servidor, PORT));

// ================================================================================================================================================================================================================================================
// liberarCors

function liberarCors(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
}

// ================================================================================================================================================================================================================================================
// salvarMapa

function salvarMapa(req, res) {
  const mapData = req.body;
  const isValidMap = mapData && typeof mapData === 'object' &&
    Array.isArray(mapData.objetosData) &&
    Array.isArray(mapData.transicoesData) &&
    Array.isArray(mapData.enemyData);

  if (!isValidMap) {
    console.error('❌ POST /api/save-map: conteúdo não é um mapa válido');
    return res.status(400).json({ success: false, message: 'Conteúdo não é um mapa válido.' });
  }

  try {
    fs.writeFileSync(MAP_DATA_PATH, JSON.stringify(mapData, null, 2), 'utf8');
    console.log(`✅ Mapa salvo em ${MAP_DATA_PATH} (${mapData.objetosData.length} objetos)`);
    res.json({ success: true, message: 'Mapa salvo com sucesso!' });
  } catch (err) {
    console.error('❌ Erro ao salvar:', err.message);
    res.status(500).json({ success: false, message: 'Erro ao salvar: ' + err.message });
  }
}

// ================================================================================================================================================================================================================================================
// arquivosTibia
// Tibia.spr/Tibia.dat de img/780, lidos na 1ª vez que o editor pede.

function arquivosTibia() {
  if (!tibia) tibia = new TibiaAssets(TIBIA_CLIENT_PATH);
  return tibia;
}

// ================================================================================================================================================================================================================================================
// lerRegistroTibia

function lerRegistroTibia() {
  try {
    const registro = JSON.parse(fs.readFileSync(TIBIA_REGISTRY_PATH, 'utf8'));
    return { version: 1, items: registro.items || {}, creatures: registro.creatures || {} };
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('❌ Erro ao ler data/tibia.json:', err.message);
    return { version: 1, items: {}, creatures: {} };
  }
}

// ================================================================================================================================================================================================================================================
// gravarRegistroTibia
// Grava data/tibia.json e avisa a simulação (criaturas novas passam a valer).

function gravarRegistroTibia() {
  fs.writeFileSync(TIBIA_REGISTRY_PATH, JSON.stringify(registroTibia, null, 2), 'utf8');
  if (modulosJogo) modulosJogo.setTibiaRegistry(registroTibia);
}

// ================================================================================================================================================================================================================================================
// catalogoTibia

function catalogoTibia(req, res) {
  try {
    res.json({ success: true, ...arquivosTibia().catalogo(), registry: registroTibia });
  } catch (err) {
    console.error('❌ Tibia:', err.message);
    res.status(500).json({ success: false, message: `Não foi possível ler img/780: ${err.message}` });
  }
}

// ================================================================================================================================================================================================================================================
// miniaturaTibia

function miniaturaTibia(req, res) {
  const tipo = req.params.tipo === 'creature' ? 'creature' : 'item';
  const id = parseInt(req.params.id, 10);
  try {
    const png = Number.isInteger(id) ? arquivosTibia().miniatura(tipo, id) : null;
    if (!png) return res.sendStatus(404);
    res.set('Cache-Control', 'public, max-age=86400');
    res.type('png').send(png);
  } catch (err) {
    res.sendStatus(500);
  }
}

// ================================================================================================================================================================================================================================================
// importarTibia
// Gera o PNG do que o editor escolheu e registra em data/tibia.json:
//   { kind: 'item', id }                                  item ou chão
//   { kind: 'creature', id, name, lvl, corpse }           criatura (corpse: id do item do cadáver, opcional)

function importarTibia(req, res) {
  const { kind, id, name, lvl, corpse } = req.body || {};
  try {
    if (kind === 'item') {
      const entrada = arquivosTibia().exportarItem(parseInt(id, 10), IMG_PATH);
      if (!entrada) return res.status(404).json({ success: false, message: `Item ${id} não existe ou não tem desenho.` });
      registroTibia.items[id] = entrada;
      gravarRegistroTibia();
      console.log(`🧱 Tibia: item ${id} (${entrada.kind}) gerado em img/${entrada.file}`);
      return res.json({ success: true, item: entrada });
    }

    if (kind === 'creature') {
      const nome = String(name || '').trim().replace(/\s+/g, ' ');
      if (!/^[\p{L}\p{N} '-]{2,30}$/u.test(nome)) {
        return res.status(400).json({ success: false, message: 'Nome da criatura: de 2 a 30 letras ou números.' });
      }
      if (modulosJogo && modulosJogo.CREATURE_TYPES[nome]) {
        return res.status(400).json({ success: false, message: `"${nome}" já é uma criatura do jogo. Escolha outro nome.` });
      }
      const sprite = arquivosTibia().exportarCriatura(parseInt(id, 10), IMG_PATH);
      if (!sprite) return res.status(404).json({ success: false, message: `Criatura ${id} não existe ou não tem desenho.` });

      const cadaver = corpse ? arquivosTibia().exportarItem(parseInt(corpse, 10), IMG_PATH) : null;
      if (cadaver) registroTibia.items[corpse] = cadaver;
      const entrada = {
        outfit: parseInt(id, 10),
        file: sprite.file,
        spriteSize: sprite.spriteSize,
        frames: sprite.frames,
        color: '#8B6B4A',
        defaultLvl: Math.max(1, parseInt(lvl, 10) || 5),
        corpse: cadaver ? cadaver.file : null,
        corpseSize: cadaver ? Math.max(cadaver.fw, cadaver.fh) : 32,
        corpseFrames: 1
      };
      registroTibia.creatures[nome] = entrada;
      gravarRegistroTibia();
      console.log(`🐀 Tibia: criatura "${nome}" (roupa ${id}) gerada em img/${entrada.file}`);
      return res.json({ success: true, name: nome, creature: entrada });
    }

    res.status(400).json({ success: false, message: 'Pedido inválido.' });
  } catch (err) {
    console.error('❌ Tibia:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
}

// ================================================================================================================================================================================================================================================
// enderecosRede

function enderecosRede(porta) {
  const enderecos = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const rede of interfaces) {
      if (rede.family === 'IPv4' && !rede.internal) {
        enderecos.push(`http://${rede.address}:${porta}`);
      }
    }
  }
  return enderecos;
}

// ================================================================================================================================================================================================================================================
// iniciarJogo
// Roda a simulação (js/simulation.js) aqui no servidor, TICK_MS em TICK_MS, e
// aceita jogadores por WebSocket em /ws: a conexão manda o nome e o gênero do
// personagem ('join') e, aceito, vira um jogador que manda comandos e recebe, a cada
// tick, o estado do jogo e os eventos. Personagens ficam guardados pelo nome em
// data/characters.json: ao sair, a cada SAVE_INTERVAL_MS e ao fechar o servidor.

async function iniciarJogo(servidorHttp) {
  const { Simulation, TICK_MS } = await import(pathToFileURL(path.join(PASTA_JOGO, 'js', 'simulation.js')).href);
  const { serializeState, validateName, normalizeGender } = await import(pathToFileURL(path.join(PASTA_JOGO, 'js', 'net', 'protocol.js')).href);
  const { setTibiaRegistry } = await import(pathToFileURL(path.join(PASTA_JOGO, 'shared', 'tibia-registry.js')).href);
  const { CREATURE_TYPES } = await import(pathToFileURL(path.join(PASTA_JOGO, 'shared', 'catalog.js')).href);
  modulosJogo = { setTibiaRegistry, CREATURE_TYPES };
  registroTibia = lerRegistroTibia();
  setTibiaRegistry(registroTibia);

  const mapData = JSON.parse(fs.readFileSync(MAP_DATA_PATH, 'utf8'));
  const sim = new Simulation(mapData);
  const personagens = carregarPersonagens();
  const conexoes = new Map();
  let proximoJogador = 1;

  const wss = new WebSocketServer({ server: servidorHttp, path: '/ws' });
  wss.on('connection', (socket) => {
    let player = null;

    socket.on('message', (dados) => {
      const mensagem = lerMensagem(dados);
      if (!mensagem) return;

      if (!player) {
        if (mensagem.type !== 'join') return;
        const erro = validarEntrada(sim, mensagem.name, validateName);
        if (erro.error) {
          socket.send(JSON.stringify({ type: 'joinError', error: erro.error }));
          return;
        }
        const playerId = `player${proximoJogador}`;
        proximoJogador++;
        const saved = personagens[erro.name.toLowerCase()];
        player = sim.addPlayer(playerId, { name: erro.name, gender: normalizeGender(mensagem.gender), saved });
        conexoes.set(playerId, socket);
        console.log(`🟢 ${player.name} entrou ${saved ? `(nível ${player.lvl}) ` : '(novo) '}(${conexoes.size} online)`);
        socket.send(JSON.stringify({ type: 'welcome', playerId }));
        return;
      }

      if (mensagem.type === 'command' && mensagem.command && typeof mensagem.command.type === 'string') {
        sim.enqueue(player.id, mensagem.command);
      }
    });

    socket.on('close', () => {
      if (!player) return;
      guardarPersonagens(personagens, [player]);
      sim.removePlayer(player.id);
      conexoes.delete(player.id);
      console.log(`🔴 ${player.name} saiu (${conexoes.size} online)`);
    });
  });

  const inicio = Date.now();
  let tempo = 0;
  setInterval(() => {
    const agora = Date.now() - inicio;
    while (tempo + TICK_MS <= agora) {
      tempo += TICK_MS;
      sim.tick(tempo);
      enviarEstado(sim, conexoes, tempo, serializeState);
    }
  }, TICK_MS);

  setInterval(() => guardarPersonagens(personagens, sim.players), SAVE_INTERVAL_MS);
  for (const sinal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(sinal, () => {
      guardarPersonagens(personagens, sim.players);
      console.log('💾 Personagens salvos');
      process.exit(0);
    });
  }
}

// ================================================================================================================================================================================================================================================
// carregarPersonagens
// Personagens guardados, pelo nome em minúsculas. Sem arquivo (ou com ele
// estragado), começa vazio.

function carregarPersonagens() {
  try {
    const personagens = JSON.parse(fs.readFileSync(CHARACTERS_PATH, 'utf8'));
    return personagens && typeof personagens === 'object' ? personagens : {};
  } catch (err) {
    if (err.code !== 'ENOENT') console.error('❌ Erro ao ler personagens:', err.message);
    return {};
  }
}

// ================================================================================================================================================================================================================================================
// guardarPersonagens
// Atualiza os jogadores na lista e grava o arquivo (primeiro num temporário,
// pra não estragar o arquivo se o servidor cair no meio).

function guardarPersonagens(personagens, jogadores) {
  if (jogadores.length === 0) return;
  for (const jogador of jogadores) {
    personagens[jogador.name.toLowerCase()] = jogador.toSave();
  }
  try {
    const temporario = CHARACTERS_PATH + '.tmp';
    fs.writeFileSync(temporario, JSON.stringify(personagens, null, 2), 'utf8');
    fs.renameSync(temporario, CHARACTERS_PATH);
  } catch (err) {
    console.error('❌ Erro ao salvar personagens:', err.message);
  }
}

// ================================================================================================================================================================================================================================================
// lerMensagem

function lerMensagem(dados) {
  try {
    const mensagem = JSON.parse(dados);
    return mensagem && typeof mensagem === 'object' ? mensagem : null;
  } catch {
    return null;
  }
}

// ================================================================================================================================================================================================================================================
// validarEntrada
// Nome válido (validateName) e que nenhum jogador online esteja usando.
// Devolve { name } ou { error }.

function validarEntrada(sim, nome, validateName) {
  const resultado = validateName(nome);
  if (resultado.error) return resultado;
  const emUso = sim.players.some(p => p.name.toLowerCase() === resultado.name.toLowerCase());
  if (emUso) return { error: 'Esse nome já está em uso. Escolha outro.' };
  return resultado;
}

// ================================================================================================================================================================================================================================================
// enviarEstado
// Um estado por jogador (cada um recebe o próprio alvo/caminho), com os
// eventos do tick.

function enviarEstado(sim, conexoes, tempo, serializeState) {
  const events = sim.drainEvents();
  for (const [playerId, socket] of conexoes) {
    if (socket.readyState !== socket.OPEN) continue;
    const state = serializeState(sim, playerId);
    socket.send(JSON.stringify({ type: 'state', time: tempo, state, events }));
  }
}

// ================================================================================================================================================================================================================================================
// iniciarServidor

function iniciarServidor(servidor, porta) {
  servidor.listen(porta, '0.0.0.0', () => {
    console.log(`\n🚀 Servidor rodando em http://localhost:${porta}`);
    for (const endereco of enderecosRede(porta)) {
      console.log(`🌐 Na rede: ${endereco}`);
    }
    console.log(`🎮 Multiplayer: abra o endereço acima em mais de uma aba ou computador`);
    console.log(`📝 Editor em: http://localhost:${porta}/editor/\n`);
  });
}