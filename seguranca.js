// seguranca.js

const crypto = require('crypto');

// O que o servidor usa pra se proteger: arquivos que nunca saem pela web, a senha do editor, limites de
// conexões e de mensagens do jogo e cabeçalhos de segurança. Tudo puro (sem rede), pra testar.

const PROTEGIDOS = [
  /^\/\./,
  /^\/(data|node_modules|tests|ferramentas|transf|\.git|\.github|\.claude)(\/|$)/,
  /^\/gerador\/tibia(\/|$)/,
  /^\/(server\.js|iniciar\.js|seguranca\.js|start-server\.bat|package(-lock)?\.json|claude\.md|pendencias\.md|sftp-config\.json|jsconfig\.json)$/,
  /\.(env|pem|key|bak|tmp|log)$/,
  /\/\./
];

// ================================================================================================================================================================================================================================================
// caminhoBloqueado
// O caminho (da URL) é de um arquivo que não pode sair pela web: dados dos jogadores, código do servidor, repositório, ferramentas e o que começa com ponto.

function caminhoBloqueado(url) {
  let caminho;
  try {
    caminho = decodeURIComponent(String(url).split('?')[0]).replace(/\\/g, '/').replace(/\/{2,}/g, '/').toLowerCase();
  } catch {
    return true;
  }
  if (caminho.includes('\0') || caminho.includes('/../')) return true;
  return PROTEGIDOS.some(regra => regra.test(caminho));
}

// ================================================================================================================================================================================================================================================
// bloquearArquivos
// Middleware: 404 pros caminhos protegidos (não revela que existem).

function bloquearArquivos(req, res, next) {
  if (caminhoBloqueado(req.originalUrl || req.url)) return res.status(404).end();
  next();
}

// ================================================================================================================================================================================================================================================
// cabecalhosSeguros
// Middleware: cabeçalhos que fecham brechas comuns do navegador.

function cabecalhosSeguros(req, res, next) {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Referrer-Policy', 'same-origin');
  res.set('Cross-Origin-Opener-Policy', 'same-origin');
  next();
}

// ================================================================================================================================================================================================================================================
// ehLocal
// A requisição veio da própria máquina do servidor.

function ehLocal(req) {
  const endereco = (req.socket && req.socket.remoteAddress) || '';
  return endereco === '127.0.0.1' || endereco === '::1' || endereco === '::ffff:127.0.0.1';
}

// ================================================================================================================================================================================================================================================
// senhaConfere
// Compara a senha enviada com a do servidor sem vazar nada pelo tempo.

function senhaConfere(enviada, segredo) {
  if (!segredo || typeof enviada !== 'string') return false;
  const a = crypto.createHash('sha256').update(enviada).digest();
  const b = crypto.createHash('sha256').update(segredo).digest();
  return crypto.timingSafeEqual(a, b);
}

// ================================================================================================================================================================================================================================================
// criarGuarda
// Trava uma chave (origem) por travaMs depois de maxFalhas erros seguidos. Mesma interface do LoginGuard dos
// jogadores (js/net/passwords.js): retryIn, fail, clear.

function criarGuarda({ maxFalhas = 5, travaMs = 30000, agora = Date.now } = {}) {
  const entradas = new Map();
  return {
    retryIn(chave) {
      const entrada = entradas.get(chave);
      if (!entrada || !entrada.ate) return 0;
      const falta = entrada.ate - agora();
      if (falta > 0) return falta;
      entradas.delete(chave);
      return 0;
    },
    fail(chave) {
      const entrada = entradas.get(chave) || { falhas: 0, ate: 0 };
      entrada.falhas++;
      if (entrada.falhas >= maxFalhas) entrada.ate = agora() + travaMs;
      entradas.set(chave, entrada);
    },
    clear(chave) {
      entradas.delete(chave);
    }
  };
}

// ================================================================================================================================================================================================================================================
// criarPortaoAdmin
// Middleware das rotas que mexem no servidor (salvar o mapa, criar personagens de teste). Com a senha
// (JOGO_ADMIN_SENHA) no cabeçalho X-Admin-Senha; sem senha configurada, só aceita quem está na própria
// máquina. Erros repetidos de uma mesma origem travam por um tempo (guarda).

function criarPortaoAdmin(segredo, guarda) {
  return (req, res, next) => {
    const origem = (req.socket && req.socket.remoteAddress) || '?';
    const espera = guarda.retryIn(`admin|${origem}`);
    if (espera) return res.status(429).json({ success: false, ok: false, message: `Muitas tentativas. Espere ${Math.ceil(espera / 1000)} segundos.` });
    if (!segredo) {
      if (ehLocal(req)) return next();
      return res.status(403).json({ success: false, ok: false, message: 'Defina JOGO_ADMIN_SENHA no servidor pra mexer nele de outro computador.' });
    }
    if (senhaConfere(req.get('x-admin-senha'), segredo)) {
      guarda.clear(`admin|${origem}`);
      return next();
    }
    guarda.fail(`admin|${origem}`);
    res.status(401).json({ success: false, ok: false, message: 'Senha do editor errada.' });
  };
}

// ================================================================================================================================================================================================================================================
// criarBalde
// Limite de mensagens por conexão (balde de fichas): enche `taxa` fichas por segundo até `rajada`; cada mensagem gasta uma.
// permitir(agora) devolve false quando acabaram.

function criarBalde({ taxa = 100, rajada = 200, agora = Date.now } = {}) {
  let fichas = rajada;
  let ultimo = agora();
  return {
    permitir() {
      const t = agora();
      fichas = Math.min(rajada, fichas + (t - ultimo) / 1000 * taxa);
      ultimo = t;
      if (fichas < 1) return false;
      fichas--;
      return true;
    }
  };
}

// ================================================================================================================================================================================================================================================
// contarPorChave
// Quantas coisas abertas cada chave (endereço) tem: entrar(chave) devolve false se já está no máximo; sair(chave) libera.

function contarPorChave(maximo) {
  const contagem = new Map();
  return {
    entrar(chave) {
      const atual = contagem.get(chave) || 0;
      if (atual >= maximo) return false;
      contagem.set(chave, atual + 1);
      return true;
    },
    sair(chave) {
      const atual = (contagem.get(chave) || 0) - 1;
      if (atual > 0) contagem.set(chave, atual);
      else contagem.delete(chave);
    }
  };
}

// ================================================================================================================================================================================================================================================
// criarJanela
// Limite de eventos por chave numa janela de tempo (ex.: contas novas por hora por endereço): tentar(chave) devolve false
// quando já teve `maximo` na janela.

function criarJanela({ maximo = 5, janelaMs = 3600000, agora = Date.now } = {}) {
  const eventos = new Map();
  return {
    tentar(chave) {
      const t = agora();
      const recentes = (eventos.get(chave) || []).filter(quando => t - quando < janelaMs);
      if (recentes.length >= maximo) {
        eventos.set(chave, recentes);
        return false;
      }
      recentes.push(t);
      eventos.set(chave, recentes);
      return true;
    }
  };
}

module.exports = { criarGuarda, caminhoBloqueado, bloquearArquivos, cabecalhosSeguros, ehLocal, senhaConfere, criarPortaoAdmin, criarBalde, contarPorChave, criarJanela };
