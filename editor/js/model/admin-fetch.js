// editor/js/model/admin-fetch.js

const STORAGE_KEY = 'adminSenha';

// ================================================================================================================================================================================================================================================
// savedPassword

function savedPassword() {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

// ================================================================================================================================================================================================================================================
// savePassword

function savePassword(password) {
  try {
    sessionStorage.setItem(STORAGE_KEY, password);
  } catch {
    return;
  }
}

// ================================================================================================================================================================================================================================================
// adminFetch
// fetch pras rotas que mexem no servidor (salvar o mapa, criar personagens de teste): manda a senha do editor
// (JOGO_ADMIN_SENHA do servidor) e, se ela falta ou está errada (401), pergunta uma vez e tenta de novo.

export async function adminFetch(url, options = {}) {
  const send = (password) => fetch(url, { ...options, headers: { ...options.headers, 'X-Admin-Senha': password } });
  let response = await send(savedPassword());
  if (response.status === 401) {
    const typed = prompt('Senha do editor (a JOGO_ADMIN_SENHA do servidor):');
    if (typed) {
      savePassword(typed);
      response = await send(typed);
    }
  }
  return response;
}
