// server.js

const express = require('express');
const compression = require('compression');
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const { WebSocketServer } = require('ws');
const { renomearArquivo } = require('./ferramentas/renomear-no-mapa.js');
const { lerSprites: lerSpritesDe } = require('./gerador/sprites.js');
const seguranca = require('./seguranca.js');
const app = express();

const PASTA_JOGO = __dirname;
const MAPA_VAZIO = { version: 3, objetosData: [], transicoesData: [], enemyData: [], npcData: [], botData: [], safeZoneData: [], houseData: [], spawn: null };
let MAP_DATA_PATH = path.resolve(process.env.JOGO_MAPA || path.join(PASTA_JOGO, 'data', 'map.json'));
const CHARACTERS_PATH = process.env.JOGO_PERSONAGENS || path.join(PASTA_JOGO, 'data', 'characters.json');
const HOUSES_PATH = process.env.JOGO_CASAS || path.join(path.dirname(CHARACTERS_PATH), 'houses.json');
const PASSWORDS_PATH = process.env.JOGO_SENHAS || path.join(path.dirname(CHARACTERS_PATH), 'passwords.json');
const PASTA_PROJETOS = path.join(PASTA_JOGO, 'gerador', 'projetos');
const PASTA_SAIDA = path.join(PASTA_JOGO, 'gerador', 'saida');
const SAVE_INTERVAL_MS = 10000;
const BACKUP_DIAS = 7;
const RECARREGAR_ESPERA_MS = 500;
const estado = { iniciadoEm: Date.now(), conexoesTotal: 0, online: 0 };
const PORT = process.env.PORT || 8000;
const ADMIN_SENHA = process.env.JOGO_ADMIN_SENHA || '';
const MAX_MENSAGEM_BYTES = 16 * 1024;
const MAX_CONEXOES_POR_IP = 10;
const MAX_CONTAS_NOVAS_POR_IP = Number(process.env.JOGO_CONTAS_NOVAS_POR_HORA) || 5;
const ESPERA_PARA_ENTRAR_MS = 20000;
const mundoVivo = { gravar: () => {}, juntar: (mapa) => mapa };

const portaoAdmin = seguranca.criarPortaoAdmin(ADMIN_SENHA, seguranca.criarGuarda());
app.disable('x-powered-by');
app.use(compression());
app.use(seguranca.cabecalhosSeguros);
app.use(seguranca.bloquearArquivos);
app.post('/api/save-map', portaoAdmin, express.json({ limit: '50mb' }), salvarMapa);
app.use(express.json({ limit: '100kb' }));
app.get('/api/map', enviarMapa);
app.get('/api/status', enviarStatus);
app.get('/api/sprites', listarSprites);
app.use(express.static(PASTA_JOGO));

prepararMapa();
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
// prepararMapa
// O mapa ao vivo fica em MAP_DATA_PATH (JOGO_MAPA: o servidor é quem manda, o
// deploy não mexe). Sem o arquivo ainda, começa de um mapa vazio. Se o
// arquivo não dá pra criar ou ler (caminho errado, sem permissão, JSON
// estragado), o servidor não sobe e avisa.

function prepararMapa() {
  try {
    if (fs.existsSync(MAP_DATA_PATH)) {
      JSON.parse(fs.readFileSync(MAP_DATA_PATH, 'utf8'));
      const mudou = renomearArquivo(MAP_DATA_PATH);
      if (mudou) console.log(`🗺️  ${mudou} item(ns) do mapa com nome antigo de folha trocados (gerador/renomeados.json)`);
      return;
    }
    fs.mkdirSync(path.dirname(MAP_DATA_PATH), { recursive: true });
    fs.writeFileSync(MAP_DATA_PATH, JSON.stringify(MAPA_VAZIO, null, 2));
    console.log(`🗺️  Mapa vazio criado em ${MAP_DATA_PATH}`);
  } catch (err) {
    console.error(`❌ Não deu pra usar o mapa em ${MAP_DATA_PATH} (${err.message}).`);
    process.exit(1);
  }
}

// ================================================================================================================================================================================================================================================
// enviarMapa
// O mapa ao vivo (o jogo e o editor carregam daqui). Com ?baixar=1 vai como
// arquivo pra baixar.

function enviarMapa(req, res) {
  res.set('Cache-Control', 'no-cache');
  if (req.query.baixar) res.attachment('map.json');
  res.type('application/json');
  res.sendFile(MAP_DATA_PATH, { dotfiles: 'allow' }, (err) => {
    if (err && !res.headersSent) {
      console.error(`❌ Não deu pra enviar o mapa ${MAP_DATA_PATH}:`, err.message);
      res.status(404).json({ success: false, message: 'Mapa não encontrado.' });
    }
  });
}

// ================================================================================================================================================================================================================================================
// mapaTemObjetos
// O mapa ao vivo já tem alguma coisa?

function mapaTemObjetos() {
  try {
    const mapa = JSON.parse(fs.readFileSync(MAP_DATA_PATH, 'utf8'));
    return Array.isArray(mapa.objetosData) && mapa.objetosData.length > 0;
  } catch {
    return false;
  }
}

// ================================================================================================================================================================================================================================================
// enviarStatus
// O que o servidor está usando agora (pra conferir o que não funciona): o
// mapa ao vivo e se é o do repositório, se dá pra gravar nas pastas, e quantas
// conexões do jogo (WebSocket) já chegaram e estão abertas.

function enviarStatus(req, res) {
  const gravavel = (arquivo) => {
    try {
      fs.accessSync(path.dirname(arquivo), fs.constants.W_OK);
      return true;
    } catch {
      return false;
    }
  };
  res.set('Cache-Control', 'no-cache');
  res.json({
    ok: true,
    node: process.version,
    iniciadoEm: new Date(estado.iniciadoEm).toISOString(),
    mapa: { arquivo: MAP_DATA_PATH, variavelJogoMapa: !!process.env.JOGO_MAPA, gravavel: gravavel(MAP_DATA_PATH) },
    personagens: { arquivo: CHARACTERS_PATH, variavelJogoPersonagens: !!process.env.JOGO_PERSONAGENS, gravavel: gravavel(CHARACTERS_PATH) },
    jogo: { conexoesTotal: estado.conexoesTotal, online: estado.online }
  });
}

// ================================================================================================================================================================================================================================================
// salvarMapa
// Grava o mapa do editor. Com baseObjetos (o que o editor abriu), só as mudanças feitas no editor entram por cima do
// mapa atual, que pode ter mudado no jogo enquanto o editor estava aberto (mundoVivo.juntar).

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

  if (mapData.objetosData.length === 0 && mapaTemObjetos()) {
    console.error('❌ POST /api/save-map: mapa vazio recusado (apagaria o mapa atual)');
    return res.status(400).json({ success: false, message: 'Mapa vazio recusado: apagaria o mapa atual.' });
  }

  try {
    const base = Array.isArray(mapData.baseObjetos) ? mapData.baseObjetos : null;
    delete mapData.baseObjetos;
    mundoVivo.gravar();
    copiarBackupDiario(MAP_DATA_PATH, 'map');
    copiarBackupDiario(PASSWORDS_PATH, 'passwords');
    const final = base ? mundoVivo.juntar(mapData, base) : mapData;
    fs.writeFileSync(MAP_DATA_PATH, JSON.stringify(final, null, 2), 'utf8');
    console.log(`✅ Mapa salvo em ${MAP_DATA_PATH} (${final.objetosData.length} objetos)`);
    res.json({ success: true, message: 'Mapa salvo com sucesso!' });
  } catch (err) {
    console.error('❌ Erro ao salvar:', err.message);
    res.status(500).json({ success: false, message: 'Erro ao salvar: ' + err.message });
  }
}

// ================================================================================================================================================================================================================================================
// listarSprites
// As folhas feitas no gerador (gerador/projetos/<grupo>/<pasta>/<nome>.json,
// com o PNG em gerador/saida): o que o jogo e o editor desenham (shared/assets.js).

function listarSprites(req, res) {
  try {
    res.set('Cache-Control', 'no-cache');
    res.json({ success: true, sprites: lerSpritesDe(PASTA_JOGO) });
  } catch (err) {
    console.error('❌ Erro ao listar sprites:', err.message);
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
  const { serializeState, validateName, validatePassword, normalizeGender, VIEW_RANGE_X, VIEW_RANGE_Y } = await import(pathToFileURL(path.join(PASTA_JOGO, 'js', 'net', 'protocol.js')).href);
  const { encodeDelta } = await import(pathToFileURL(path.join(PASTA_JOGO, 'js', 'net', 'delta.js')).href);
  const { PasswordStore, LoginGuard } = await import(pathToFileURL(path.join(PASTA_JOGO, 'js', 'net', 'passwords.js')).href);
  const { createTestCharacters, TEST_CHARACTERS, TEST_PASSWORD } = await import(pathToFileURL(path.join(PASTA_JOGO, 'js', 'net', 'test-characters.js')).href);

  const { setAssets } = await import(pathToFileURL(path.join(PASTA_JOGO, 'shared', 'assets.js')).href);
  setAssets(lerSpritesDe(PASTA_JOGO));

  const { validateWorld } = await import(pathToFileURL(path.join(PASTA_JOGO, 'js', 'core', 'validate.js')).href);
  const criarMundo = (casas = carregarCasas()) => {
    const mundo = new Simulation(JSON.parse(fs.readFileSync(MAP_DATA_PATH, 'utf8')), { houses: casas, characters: personagens });
    const avisos = validateWorld(mundo);
    if (avisos.length) console.log(`\n⚠️  Conferência do mapa e do gerador (${avisos.length}):\n${avisos.map(a => `   • ${a}`).join('\n')}`);
    return mundo;
  };
  const { mergeObjects } = await import(pathToFileURL(path.join(PASTA_JOGO, 'js', 'systems', 'live-map.js')).href);
  const { buildLayersFromMapData, serializeMapFromLayers } = await import(pathToFileURL(path.join(PASTA_JOGO, 'shared', 'map-format.js')).href);
  const { GRID_WIDTH } = await import(pathToFileURL(path.join(PASTA_JOGO, 'shared', 'constants.js')).href);
  fazerBackup();
  const personagens = carregarPersonagens();
  let sim = criarMundo();
  let ultimoGravado = null;
  mundoVivo.gravar = () => {
    if (!sim.liveMap.collect()) return;
    const texto = JSON.stringify(sim.mapData, null, 2);
    const temporario = `${MAP_DATA_PATH}.tmp`;
    try {
      fs.writeFileSync(temporario, texto, 'utf8');
      fs.renameSync(temporario, MAP_DATA_PATH);
      ultimoGravado = texto;
    } catch (err) {
      console.error('❌ Não deu pra gravar o mundo no mapa:', err.message);
    }
  };
  mundoVivo.juntar = (editado, base) => {
    const atual = JSON.parse(fs.readFileSync(MAP_DATA_PATH, 'utf8'));
    const { layers, layerOrder } = buildLayersFromMapData(atual, GRID_WIDTH);
    const normal = serializeMapFromLayers(layerOrder, layers, GRID_WIDTH);
    return { ...editado, objetosData: mergeObjects(base, editado.objetosData, normal.objetosData) };
  };
  let geracao = 0;
  const senhas = new PasswordStore(PASSWORDS_PATH);
  const guarda = new LoginGuard();
  const conexoes = new Map();
  let proximoJogador = 1;

  app.post('/api/personagens-teste', portaoAdmin, async (req, res) => {
    const pedida = req.body && typeof req.body.senha === 'string' && req.body.senha ? req.body.senha : TEST_PASSWORD;
    const senha = validatePassword(pedida);
    if (senha.error) return res.status(400).json({ ok: false, message: senha.error });
    const emUso = Object.keys(TEST_CHARACTERS).filter(nome => sim.players.some(p => p.name.toLowerCase() === nome.toLowerCase()));
    if (emUso.length) return res.status(409).json({ ok: false, message: `Esses personagens estão no jogo, saia antes: ${emUso.join(', ')}.` });
    const nomes = await createTestCharacters(personagens, senhas, senha.password);
    gravarPersonagens(personagens);
    console.log(`🧪 Personagens de teste criados: ${nomes.join(', ')}`);
    res.json({ ok: true, nomes });
  });

  observarMudancas(() => {
    try {
      if (ultimoGravado !== null && fs.readFileSync(MAP_DATA_PATH, 'utf8') === ultimoGravado) return;
    } catch {}
    let novo;
    try {
      novo = criarMundo(sim.houses.toSave());
    } catch (err) {
      console.error('❌ Não deu pra recarregar (arquivo ainda sendo gravado?):', err.message);
      return;
    }
    guardarPersonagens(personagens, sim.players);
    guardarCasas(sim);
    for (const { socket } of conexoes.values()) {
      if (socket.readyState === socket.OPEN) socket.send(JSON.stringify({ type: 'reload' }));
    }
    conexoes.clear();
    geracao++;
    sim = novo;
    console.log('🔄 Mapa recarregado: os navegadores recarregam sozinhos');
  });

  const wss = new WebSocketServer({ server: servidorHttp, path: '/ws', maxPayload: MAX_MENSAGEM_BYTES });
  const conexoesPorIp = seguranca.contarPorChave(MAX_CONEXOES_POR_IP);
  const contasNovas = seguranca.criarJanela({ maximo: MAX_CONTAS_NOVAS_POR_IP });
  wss.on('connection', (socket, pedido) => {
    const endereco = pedido.socket.remoteAddress;
    if (!conexoesPorIp.entrar(endereco)) {
      socket.close(1008, 'Conexões demais deste endereço.');
      return;
    }
    estado.conexoesTotal++;
    estado.online++;
    socket.on('close', () => { estado.online--; conexoesPorIp.sair(endereco); });
    socket.on('error', () => socket.terminate());
    const balde = seguranca.criarBalde();
    const prazo = setTimeout(() => { if (!player) socket.close(1008, 'Demorou pra entrar.'); }, ESPERA_PARA_ENTRAR_MS);
    socket.on('close', () => clearTimeout(prazo));
    let player = null;
    let entrando = false;
    let minhaGeracao = geracao;

    const recusar = (erro) => socket.send(JSON.stringify({ type: 'joinError', error: erro }));

    const entrar = async (mensagem) => {
      const erro = validateName(mensagem.name);
      if (erro.error) return recusar(erro.error);
      const chave = `${endereco}|${erro.name.toLowerCase()}`;
      const espera = guarda.retryIn(chave);
      if (espera) return recusar(`Muitas tentativas. Espere ${Math.ceil(espera / 1000)} segundos.`);
      const senha = validatePassword(mensagem.password);
      if (senha.error) return recusar(senha.error);
      if (senhas.has(erro.name)) {
        if (!await senhas.verify(erro.name, senha.password)) {
          guarda.fail(chave);
          return recusar('Senha incorreta.');
        }
        guarda.clear(chave);
      } else if (!contasNovas.tentar(endereco)) {
        return recusar('Contas novas demais deste endereço. Tente mais tarde.');
      } else if (!await senhas.claim(erro.name, senha.password)) {
        return recusar('Senha incorreta.');
      }
      if (socket.readyState !== socket.OPEN) return;
      if (minhaGeracao !== geracao) return recusar('O mapa foi atualizado. Tente entrar de novo.');
      const corpo = sim.players.find(p => p.name.toLowerCase() === erro.name.toLowerCase());
      if (corpo && corpo.isBot) return recusar('Esse nome já está em uso. Escolha outro.');
      if (corpo) {
        const antiga = conexoes.get(corpo.id);
        player = corpo;
        player.offline = false;
        player.offlineSince = null;
        conexoes.set(player.id, { socket, sent: null });
        if (antiga && antiga.socket !== socket) {
          antiga.socket.send(JSON.stringify({ type: 'replaced' }));
          antiga.socket.close();
        }
        console.log(`🟢 ${player.name} voltou ao corpo que ficou no mapa (${conexoes.size} online)`);
        socket.send(JSON.stringify({ type: 'welcome', playerId: player.id, explored: player.explored.toSave() }));
        sim.announceEntry(player);
        return;
      }
      const playerId = `player${proximoJogador}`;
      proximoJogador++;
      const saved = personagens[erro.name.toLowerCase()];
      player = sim.addPlayer(playerId, { name: erro.name, gender: normalizeGender(mensagem.gender), saved });
      conexoes.set(playerId, { socket, sent: null });
      console.log(`🟢 ${player.name} entrou ${saved ? `(nível ${player.lvl}) ` : '(novo) '}(${conexoes.size} online)`);
      socket.send(JSON.stringify({ type: 'welcome', playerId, explored: player.explored.toSave() }));
      sim.announceEntry(player);
    };

    socket.on('message', (dados) => {
      if (!balde.permitir()) {
        console.log(`⛔ ${player ? player.name : endereco} mandou mensagens demais: conexão derrubada`);
        socket.close(1008, 'Mensagens demais.');
        return;
      }
      const mensagem = lerMensagem(dados);
      if (!mensagem) return;
      if (player && minhaGeracao !== geracao) return;

      if (!player) {
        if (entrando || mensagem.type !== 'join') return;
        minhaGeracao = geracao;
        entrando = true;
        entrar(mensagem).catch(err => console.error('❌ Erro ao entrar:', err.message)).finally(() => { entrando = false; });
        return;
      }

      if (mensagem.type === 'command' && mensagem.command && typeof mensagem.command.type === 'string') {
        sim.enqueue(player.id, mensagem.command);
      }
    });

    socket.on('close', () => {
      if (!player || minhaGeracao !== geracao) return;
      const atual = conexoes.get(player.id);
      if (!atual || atual.socket !== socket) return;
      guardarPersonagens(personagens, [player]);
      conexoes.delete(player.id);
      const saiu = sim.leaveGame(player.id);
      console.log(saiu ? `🔴 ${player.name} saiu (${conexoes.size} online)` : `🟠 ${player.name} caiu: o corpo fica no mapa esperando (${conexoes.size} online)`);
    });
  });

  const inicio = Date.now();
  let tempo = 0;
  setInterval(() => {
    const agora = Date.now() - inicio;
    while (tempo + TICK_MS <= agora) {
      tempo += TICK_MS;
      sim.tick(tempo);
      for (const saiu of sim.drainLoggedOut()) {
        guardarPersonagens(personagens, [saiu]);
        const dormindo = conexoes.get(saiu.id);
        if ((saiu.sleep || saiu.rested) && dormindo) {
          conexoes.delete(saiu.id);
          dormindo.socket.send(JSON.stringify({ type: 'sleeping' }));
          dormindo.socket.close();
        }
        console.log(`🔴 ${saiu.name} saiu do mapa depois do combate (${conexoes.size} online)`);
      }
      enviarEstado(sim, conexoes, tempo, { serializeState, encodeDelta, range: [VIEW_RANGE_X, VIEW_RANGE_Y] });
    }
  }, TICK_MS);

  setInterval(() => {
    guardarPersonagens(personagens, sim.players);
    guardarCasas(sim);
    mundoVivo.gravar();
  }, SAVE_INTERVAL_MS);
  for (const sinal of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(sinal, () => {
      guardarPersonagens(personagens, sim.players);
      guardarCasas(sim);
      mundoVivo.gravar();
      console.log('💾 Personagens e mundo salvos');
      process.exit(0);
    });
  }
}

// ================================================================================================================================================================================================================================================
// observarMudancas
// Chama recarregar quando o mapa muda no disco (salvo no editor), uma vez
// por leva de mudanças (RECARREGAR_ESPERA_MS sem nada novo).

function observarMudancas(recarregar) {
  let espera = null;
  const mudou = () => {
    clearTimeout(espera);
    espera = setTimeout(recarregar, RECARREGAR_ESPERA_MS);
  };
  const observar = (alvo, opcoes, filtro = () => true) => {
    try {
      fs.watch(alvo, opcoes, (evento, nome) => { if (filtro(nome)) mudou(); });
    } catch (err) {
      console.error(`❌ Não deu pra observar ${alvo}:`, err.message);
    }
  };
  observar(path.dirname(MAP_DATA_PATH), {}, nome => nome === path.basename(MAP_DATA_PATH));
}

// ================================================================================================================================================================================================================================================
// carregarPersonagens
// Personagens guardados, pelo nome em minúsculas. Sem arquivo (ou com ele
// estragado), começa vazio — e o arquivo estragado fica guardado ao lado (characters.json.estragado-*), pra o
// próximo salvamento não apagar os personagens dele.

function carregarPersonagens() {
  try {
    const personagens = JSON.parse(fs.readFileSync(CHARACTERS_PATH, 'utf8'));
    return personagens && typeof personagens === 'object' ? personagens : {};
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('❌ Erro ao ler personagens:', err.message);
      try {
        fs.copyFileSync(CHARACTERS_PATH, `${CHARACTERS_PATH}.estragado-${Date.now()}`);
      } catch {}
    }
    return {};
  }
}

// ================================================================================================================================================================================================================================================
// fazerBackup
// Ao subir o servidor, uma cópia dos personagens, do mapa e das senhas do dia em backups/
// (ao lado de cada arquivo, fora do git: characters-AAAA-MM-DD.json,
// map-AAAA-MM-DD.json e passwords-AAAA-MM-DD.json). Ficam as BACKUP_DIAS mais novas.

function fazerBackup() {
  copiarBackupDiario(CHARACTERS_PATH, 'characters');
  copiarBackupDiario(MAP_DATA_PATH, 'map');
}

// ================================================================================================================================================================================================================================================
// copiarBackupDiario
// Uma cópia por dia do arquivo (prefixo-AAAA-MM-DD.json) na pasta backups ao
// lado dele, guardando as últimas BACKUP_DIAS.

function copiarBackupDiario(arquivo, prefixo) {
  if (!fs.existsSync(arquivo)) return;
  try {
    const pasta = path.join(path.dirname(arquivo), 'backups');
    fs.mkdirSync(pasta, { recursive: true });
    const dia = new Date().toISOString().slice(0, 10);
    const destino = path.join(pasta, `${prefixo}-${dia}.json`);
    if (!fs.existsSync(destino)) fs.copyFileSync(arquivo, destino);
    const padrao = new RegExp(`^${prefixo}-\\d{4}-\\d{2}-\\d{2}\\.json$`);
    const copias = fs.readdirSync(pasta).filter(nome => padrao.test(nome)).sort();
    for (const velha of copias.slice(0, Math.max(0, copias.length - BACKUP_DIAS))) fs.unlinkSync(path.join(pasta, velha));
  } catch (err) {
    console.error(`❌ Erro no backup (${prefixo}):`, err.message);
  }
}

// ================================================================================================================================================================================================================================================
// carregarCasas / guardarCasas
// Dono, convidados e itens das casas (data/houses.json). Sem arquivo (ou
// com ele estragado), as casas começam sem dono.

function carregarCasas() {
  try {
    const casas = JSON.parse(fs.readFileSync(HOUSES_PATH, 'utf8'));
    return casas && typeof casas === 'object' ? casas : {};
  } catch {
    return {};
  }
}

function guardarCasas(sim) {
  try {
    const temporario = HOUSES_PATH + '.tmp';
    fs.writeFileSync(temporario, JSON.stringify(sim.houses.toSave(), null, 2), 'utf8');
    fs.renameSync(temporario, HOUSES_PATH);
  } catch (err) {
    console.error('❌ Erro ao salvar casas:', err.message);
  }
}

// ================================================================================================================================================================================================================================================
// guardarPersonagens
// Atualiza os jogadores online e grava (primeiro num temporário, pra não
// estragar o arquivo se o servidor cair no meio).

function guardarPersonagens(personagens, jogadores) {
  if (jogadores.length === 0) return;
  for (const jogador of jogadores) {
    if (!jogador.isBot) personagens[jogador.name.toLowerCase()] = jogador.toSave();
  }
  gravarPersonagens(personagens);
}

// ================================================================================================================================================================================================================================================
// gravarPersonagens
// Grava o objeto de personagens no arquivo (primeiro num temporário).

function gravarPersonagens(personagens) {
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
// enviarEstado
// Um estado por jogador (cada um recebe o próprio alvo/caminho), só com o
// que está perto dele e só o que mudou desde o último (js/net/delta.js), e
// os eventos do tick que acontecem por perto. O último fica guardado como
// cópia: o estado aponta pra objetos vivos (o inventário), que mudam depois.

function enviarEstado(sim, conexoes, tempo, { serializeState, encodeDelta, range }) {
  const events = sim.drainEvents();
  for (const [playerId, conexao] of conexoes) {
    const { socket } = conexao;
    if (socket.readyState !== socket.OPEN) continue;
    const player = sim.getPlayer(playerId);
    const state = serializeState(sim, playerId, true);
    const delta = encodeDelta(conexao.sent, state);
    conexao.sent = JSON.parse(JSON.stringify(state));
    const perto = events.filter((e) => {
      const x = e.x ?? e.fromX;
      const y = e.y ?? e.fromY;
      if (!player || x === undefined) return true;
      return Math.abs(x - player.x) <= range[0] && Math.abs(y - player.y) <= range[1] && (e.z === undefined || e.z === (player.z || 0));
    });
    socket.send(JSON.stringify({ type: 'state', time: tempo, delta, events: perto }));
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