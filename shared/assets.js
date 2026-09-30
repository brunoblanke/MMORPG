// shared/assets.js

// As folhas feitas no gerador (gerador/saida/<grupo>/<pasta>/<nome>.png, com a
// receita em gerador/projetos) são os sprites do jogo e do editor. O id de uma
// folha é o caminho dela ('estrutura/pisos/piso-grama-1'); uma peça da folha é
// '<folha>#<peça>' ('estrutura/paredes/parede-tijolos-1#porta-x'). O que a
// folha é vem da pasta: pisos, escadas e entradas (buraco) têm regra própria.
// A lista das folhas (setAssets) vem do servidor, em /api/sprites.

export const SPRITES_URL = '/api/sprites';
export const FLOOR_FOLDER = 'estrutura/pisos/';
export const STAIRS_FOLDER = 'estrutura/escadas/';
export const HOLE_FOLDER = 'estrutura/entradas/';
export const WALL_FOLDER = 'estrutura/paredes/';

// Folha de piso (32 px): linha 1 com as variações do meio, depois as bordas.
const FLOOR_CELLS = {
  s: [0, 1], o: [1, 1], n: [2, 1], l: [3, 1],
  sl: [0, 2], so: [1, 2], nl: [2, 2], no: [3, 2],
  'int-sl': [0, 3], 'int-so': [1, 3], 'int-nl': [2, 3], 'int-no': [3, 3]
};

// Folha de parede (64 px, 4 colunas), na ordem em que o gerador grava.
export const WALL_PIECES = [
  'x', 'y', 'xy', 'yx',
  'porta-x', 'porta-x-aberta', 'porta-y', 'porta-y-aberta',
  'arco-x-oeste', 'arco-x-leste', 'arco-y-norte', 'arco-y-sul',
  'janela-x', 'janela-y'
];
export const WALL_PIECE_NAMES = {
  x: 'X', y: 'Y', xy: 'Canto XY', yx: 'Pilar YX',
  'porta-x': 'Porta X fechada', 'porta-x-aberta': 'Porta X aberta',
  'porta-y': 'Porta Y fechada', 'porta-y-aberta': 'Porta Y aberta',
  'arco-x-oeste': 'Arco X oeste', 'arco-x-leste': 'Arco X leste',
  'arco-y-norte': 'Arco Y norte', 'arco-y-sul': 'Arco Y sul',
  'janela-x': 'Janela X', 'janela-y': 'Janela Y'
};

// Parede: bloqueia (menos porta aberta e arco); tem altura (dá pra empilhar
// em volta) só a parede cheia, a porta fechada e a janela.
const WALL_PROPS = {
  x: [true, true], y: [true, true], xy: [false, true], yx: [false, true],
  'porta-x': [true, true], 'porta-y': [true, true],
  'porta-x-aberta': [false, false], 'porta-y-aberta': [false, false],
  'arco-x-oeste': [false, false], 'arco-x-leste': [false, false],
  'arco-y-norte': [false, false], 'arco-y-sul': [false, false],
  'janela-x': [true, true], 'janela-y': [true, true]
};

const assets = new Map();

// ================================================================================================================================================================================================================================================
// creatureBehavior
// Comportamento da criatura (gerador → Criaturas): 'normal' persegue e ataca
// colado; 'foge' igual, mas foge com a vida baixa; 'mago' ataca de longe e
// mantém distância. Receita antiga com foge > 0 vale 'foge'.

export function creatureBehavior(type) {
  const asset = getAsset(type);
  const props = (asset && asset.propriedades) || {};
  if (['normal', 'foge', 'mago', 'pacifico'].includes(props.comportamento)) return props.comportamento;
  return Number(props.foge) > 0 ? 'foge' : 'normal';
}

// ================================================================================================================================================================================================================================================
// creatureStats
// Números da criatura no gerador (Criaturas): vida, XP dado ao morrer,
// velocidade (escala do Tibia), armadura (defesa) e ataque. Só os
// preenchidos (> 0); o que faltar vem do nível no mapa.

export function creatureStats(type) {
  const asset = getAsset(type);
  const props = (asset && asset.propriedades) || {};
  const stats = {};
  for (const [key, field] of [['hp', 'vida'], ['xp', 'xp'], ['spd', 'velocidade'], ['def', 'armadura'], ['atk', 'ataque']]) {
    const value = Math.floor(Number(props[field]));
    if (value > 0) stats[key] = value;
  }
  return stats;
}

// ================================================================================================================================================================================================================================================
// doorState / doorType
// Porta de parede ('<folha>#porta-x', '<folha>#porta-y-aberta'…): { open,
// hasVolume, blocksMovement } do tipo, ou null se não é porta. doorType dá o
// tipo da mesma porta aberta ou fechada.

const DOOR_PIECE = /^porta-[xy](-aberta)?$/;

export function doorState(type) {
  const { piece } = splitType(type);
  if (!DOOR_PIECE.test(piece || '')) return null;
  const [hasVolume, blocksMovement] = WALL_PROPS[piece];
  return { open: piece.endsWith('-aberta'), hasVolume, blocksMovement };
}

export function doorType(type, open) {
  const { asset, piece } = splitType(type);
  const base = piece.replace(/-aberta$/, '');
  return `${asset}#${open ? `${base}-aberta` : base}`;
}

// ================================================================================================================================================================================================================================================
// setAssets
// Lista de /api/sprites: [{ id, ferramenta, grupo, pasta, nome, rotulo, url,
// quadro, quadros, variacoes, pecas, propriedades, cadaver }].

export function setAssets(list) {
  assets.clear();
  for (const asset of list) assets.set(asset.id, asset);
}

// ================================================================================================================================================================================================================================================
// loadAssets
// Busca a lista no servidor e guarda (setAssets).

export async function loadAssets(url = SPRITES_URL) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Falha ao carregar os sprites (${response.status})`);
  const data = await response.json();
  setAssets(data.sprites || []);
  return data.sprites || [];
}

// ================================================================================================================================================================================================================================================
// getAsset

export function getAsset(id) {
  return assets.get(id) || null;
}

// ================================================================================================================================================================================================================================================
// listAssets
// As folhas de uma ferramenta ('pisos', 'paredes', 'objetos', 'criaturas'),
// em ordem de pasta e nome; filter opcional.

export function listAssets(tool, filter = () => true) {
  return [...assets.values()]
    .filter(asset => asset.ferramenta === tool && filter(asset))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, 'pt') || a.nome.localeCompare(b.nome, 'pt'));
}

// ================================================================================================================================================================================================================================================
// pieceType / splitType
// '<folha>#<peça>' ↔ { asset, piece } (sem peça: piece null).

export function pieceType(asset, piece) {
  return piece ? `${asset}#${piece}` : asset;
}

export function splitType(type) {
  const [asset, piece = null] = String(type || '').split('#');
  return { asset, piece };
}

// ================================================================================================================================================================================================================================================
// objectIdType
// Tipo do objeto do jogo pelo id dele ('<tipo>_<n>' → '<tipo>').

export function objectIdType(id) {
  return String(id || '').replace(/_\d+$/, '');
}

// ================================================================================================================================================================================================================================================
// floorBehavior
// O que o piso faz com quem pisa (gerador → Pisos → Comportamento): blocks,
// ninguém pisa e item jogado afunda; damage, vida que tira a cada segundo.

export function floorBehavior(type) {
  const asset = getAsset(splitType(type).asset);
  const props = (asset && asset.propriedades) || {};
  const damage = props.comportamento === 'dano' ? Math.max(0, Math.floor(Number(props.dano)) || 0) : 0;
  return { blocks: props.comportamento === 'bloqueia', damage };
}

// ================================================================================================================================================================================================================================================
// floorHasPiece
// A folha de piso tem a peça preenchida no gerador (ex.: 'int-no')?

export function floorHasPiece(type, piece) {
  const asset = getAsset(type);
  return !!asset && Array.isArray(asset.pecas) && asset.pecas.includes(piece);
}

// ================================================================================================================================================================================================================================================
// blocksThrow
// O que barra item jogado: parede (Estrutura › Paredes), menos janela e porta
// aberta. Árvore, pedra e outros objetos que bloqueiam a passagem de player e
// inimigos deixam o item passar por cima.

export function blocksThrow(type) {
  const { asset, piece } = splitType(type);
  if (!asset.startsWith(WALL_FOLDER)) return false;
  return !/^janela|^porta-.*-aberta$/.test(piece || '');
}

// ================================================================================================================================================================================================================================================
// stairKind
// Pela altura da folha (gerador → Objetos → Tem altura): com altura é a
// 'normal' (sobe ao pisar, sai atrás do topo); sem, a 'reta' (pisar só
// posiciona; sobe com duplo clique e sai na frente do topo).

export function stairKind(type) {
  const asset = getAsset(splitType(type).asset);
  return asset && asset.propriedades && asset.propriedades.altura === false ? 'reta' : 'normal';
}

// ================================================================================================================================================================================================================================================
// isFloorType / isStairsType / isHoleType
// Pela pasta da folha (não precisa da lista: vale no servidor também).

export function isFloorType(type) {
  return splitType(type).asset.startsWith(FLOOR_FOLDER);
}

export function isStairsType(type) {
  return splitType(type).asset.startsWith(STAIRS_FOLDER);
}

export function isHoleType(type) {
  return splitType(type).asset.startsWith(HOLE_FOLDER);
}

// ================================================================================================================================================================================================================================================
// isWallType / isItemType
// Peça de parede (ferramenta paredes) ou objeto solto (ferramenta objetos,
// fora escada e buraco).

export function isWallType(type) {
  const asset = getAsset(splitType(type).asset);
  return !!asset && asset.ferramenta === 'paredes';
}

export function isItemType(type) {
  const asset = getAsset(splitType(type).asset);
  return !!asset && asset.ferramenta === 'objetos' && !isStairsType(type) && !isHoleType(type);
}

// ================================================================================================================================================================================================================================================
// objectProps
// { movable, hasVolume, blocksMovement } de uma parede ou objeto.

export function objectProps(type) {
  const { asset: assetId, piece } = splitType(type);
  const asset = getAsset(assetId);
  if (asset && asset.ferramenta === 'paredes') {
    const [hasVolume, blocksMovement] = WALL_PROPS[piece] || [true, true];
    return { movable: false, hasVolume, blocksMovement };
  }
  const props = (asset && asset.propriedades) || {};
  return { movable: !!props.move, hasVolume: !!props.altura, blocksMovement: !!props.bloqueia };
}

// ================================================================================================================================================================================================================================================
// displayName
// Nome pra mostrar: 'criaturas/elementais/fire-elemental' → 'Fire Elemental'.

export function displayName(type) {
  const { asset } = splitType(type);
  const name = asset.split('/').pop() || '';
  return name.split('-').filter(Boolean).map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
}

// ================================================================================================================================================================================================================================================
// interiorVariant
// Variação do meio do piso no sqm ('meio-1'…), igual pra todas (sorteio fixo
// pela posição).

export function interiorVariant(x, y, z, count = 4) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return `meio-${((h >>> 0) % Math.max(1, count)) + 1}`;
}

// ================================================================================================================================================================================================================================================
// spriteFrame
// Onde desenhar a peça na folha: { url, x, y, size, frames } — x, y do 1º
// quadro; os outros quadros seguem à direita. null se a folha não existe.

export function spriteFrame(type) {
  const { asset: assetId, piece } = splitType(type);
  const asset = getAsset(assetId);
  if (!asset) return null;
  const size = asset.quadro;
  if (asset.ferramenta === 'pisos') {
    const middle = /^meio-(\d+)$/.exec(piece || 'meio-1');
    const [col, row] = middle ? [Math.min(Number(middle[1]), asset.variacoes || 1) - 1, 0] : (FLOOR_CELLS[piece] || [0, 0]);
    return { url: asset.url, x: col * size, y: row * size, size, frames: 1 };
  }
  if (asset.ferramenta === 'paredes') {
    const index = Math.max(0, (asset.ordem || WALL_PIECES).indexOf(piece || 'x'));
    return { url: asset.url, x: (index % 4) * size, y: Math.floor(index / 4) * size, size, frames: 1 };
  }
  return { url: asset.url, x: 0, y: 0, size, frames: asset.quadros || 1 };
}
