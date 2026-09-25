// gerador/app/js/api.js

// Conversa com gerador/server.js.

// ================================================================================================================================================================================================================================================
// requestJson

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.success) throw new Error(data.message || `HTTP ${response.status}`);
  return data;
}

// ================================================================================================================================================================================================================================================
// fetchCatalog

export function fetchCatalog() {
  return requestJson('/api/catalogo');
}

// ================================================================================================================================================================================================================================================
// spriteUrl
// PNG de uma variação de um item do Tibia.

export function spriteUrl(id, variation = 0) {
  return `/api/sprite/${id}/${variation}`;
}

// ================================================================================================================================================================================================================================================
// fetchProjects

export async function fetchProjects() {
  return (await requestJson('/api/projetos')).projetos;
}

// ================================================================================================================================================================================================================================================
// fetchProject

export async function fetchProject(category, name) {
  return (await requestJson(`/api/projetos/${category}/${name}`)).receita;
}

// ================================================================================================================================================================================================================================================
// saveProject
// pngDataUrl: a folha montada no canvas ('data:image/png;base64,…').

export function saveProject(category, name, recipe, pngDataUrl) {
  return requestJson('/api/salvar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoria: category, nome: name, receita: recipe, png: pngDataUrl.split(',')[1] })
  });
}
