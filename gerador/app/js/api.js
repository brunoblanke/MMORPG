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
// PNG de uma variação (e de um quadro da animação) de um item do Tibia.

export function spriteUrl(id, variation = 0, frame = 0) {
  return `/api/sprite/${id}/${variation}${frame ? `?quadro=${frame}` : ''}`;
}

// ================================================================================================================================================================================================================================================
// fetchWallSuggestion
// As 4 peças de parede do material do item: { pecas: { x, y, xy, yx } } ou null.

export async function fetchWallSuggestion(id) {
  return (await requestJson(`/api/paredes-sugeridas?id=${id}`)).sugestao;
}

// ================================================================================================================================================================================================================================================
// fetchDoorSuggestion
// As 4 portas a partir de uma porta: { pecas: { 'porta-x', 'porta-x-aberta', 'porta-y', 'porta-y-aberta' } } ou null.

export async function fetchDoorSuggestion(id) {
  return (await requestJson(`/api/portas-sugeridas?id=${id}`)).sugestao;
}

// ================================================================================================================================================================================================================================================
// fetchBorderSuggestion
// Conjunto de borda que combina com os chões do meio: { pecas, conjunto } ou null.

export async function fetchBorderSuggestion(groundIds) {
  return (await requestJson(`/api/bordas-sugeridas?chao=${groundIds.join(',')}`)).sugestao;
}

// ================================================================================================================================================================================================================================================
// fetchItemInfo
// { id, categoria, tamanho, quadros, variacoes, bloqueia, move, altura, pegavel, empilhavel }.

export async function fetchItemInfo(id) {
  return (await requestJson(`/api/item/${id}`)).item;
}

// ================================================================================================================================================================================================================================================
// fetchProjects

export async function fetchProjects() {
  return (await requestJson('/api/projetos')).projetos;
}

// ================================================================================================================================================================================================================================================
// fetchProject
// A receita salva em caminho ('grupo/pasta/nome'), com grupo, pasta e nome.

export async function fetchProject(path) {
  return (await requestJson(`/api/projeto?caminho=${encodeURIComponent(path)}`)).receita;
}

// ================================================================================================================================================================================================================================================
// deleteProject
// Apaga a folha e a receita salvas em caminho ('grupo/pasta/nome').

export function deleteProject(path) {
  return requestJson(`/api/projeto?caminho=${encodeURIComponent(path)}`, { method: 'DELETE' });
}

// ================================================================================================================================================================================================================================================
// fetchClassification
// { itens: { id: 'grupo/pasta' }, criaturas: { id: 'grupo/pasta' } }.

export async function fetchClassification() {
  return (await requestJson('/api/classificacao')).classificacao;
}

// ================================================================================================================================================================================================================================================
// classify
// Põe os sprites (tipo 'itens' ou 'criaturas') na pasta 'grupo/pasta' (null
// tira da pasta). Devolve a classificação toda, já atualizada.

export async function classify(type, ids, folder) {
  return (await requestJson('/api/classificacao', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tipo: type, ids, pasta: folder })
  })).classificacao;
}

// ================================================================================================================================================================================================================================================
// fetchTaxonomy
// Os grupos, seções e pastas onde as folhas são salvas (gerador/taxonomia.json).

export async function fetchTaxonomy() {
  return (await requestJson('/api/taxonomia')).taxonomia;
}

// ================================================================================================================================================================================================================================================
// saveProject
// folder: { grupo, pasta }; pngDataUrl: a folha montada no canvas
// ('data:image/png;base64,…'). Devolve { caminho, arquivo }.

export function saveProject(tool, folder, name, recipe, pngDataUrl) {
  return requestJson('/api/salvar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ferramenta: tool, grupo: folder.grupo, pasta: folder.pasta, nome: name, receita: recipe, png: pngDataUrl.split(',')[1] })
  });
}
