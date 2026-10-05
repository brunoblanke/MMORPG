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
// Passagem: só o topo da parede (o vão por onde se passa por baixo).
export const WALL_PIECES = [
  'x', 'y', 'xy', 'yx',
  'porta-x', 'porta-x-aberta', 'porta-y', 'porta-y-aberta',
  'arco-x-oeste', 'arco-x-leste', 'arco-y-norte', 'arco-y-sul',
  'janela-x', 'janela-y', 'passagem-x', 'passagem-y'
];
export const WALL_PIECE_NAMES = {
  x: 'X', y: 'Y', xy: 'Canto XY', yx: 'Pilar YX',
  'porta-x': 'Porta X fechada', 'porta-x-aberta': 'Porta X aberta',
  'porta-y': 'Porta Y fechada', 'porta-y-aberta': 'Porta Y aberta',
  'arco-x-oeste': 'Arco X oeste', 'arco-x-leste': 'Arco X leste',
  'arco-y-norte': 'Arco Y norte', 'arco-y-sul': 'Arco Y sul',
  'janela-x': 'Janela X', 'janela-y': 'Janela Y',
  'passagem-x': 'Passagem X', 'passagem-y': 'Passagem Y'
};

// Parede: bloqueia (menos porta aberta, arco e passagem); tem altura (dá
// pra empilhar em volta) só a parede cheia, a porta fechada e a janela.
const WALL_PROPS = {
  x: [true, true], y: [true, true], xy: [false, true], yx: [false, true],
  'porta-x': [true, true], 'porta-y': [true, true],
  'porta-x-aberta': [false, false], 'porta-y-aberta': [false, false],
  'arco-x-oeste': [false, false], 'arco-x-leste': [false, false],
  'arco-y-norte': [false, false], 'arco-y-sul': [false, false],
  'janela-x': [true, true], 'janela-y': [true, true],
  'passagem-x': [false, false], 'passagem-y': [false, false]
};

const assets = new Map();

// ================================================================================================================================================================================================================================================
// creatureBehavior
// Comportamento da criatura (gerador → Criaturas): 'normal' persegue e ataca
// colado; 'foge' igual, mas foge com a vida baixa; 'mago' ataca de longe e
// mantém distância; 'npc' é um NPC (conversa, não luta: shared/npcs.js).
// Receita antiga com foge > 0 vale 'foge'.

export function creatureBehavior(type) {
  const asset = getAsset(type);
  const props = (asset && asset.propriedades) || {};
  if (['normal', 'foge', 'mago', 'pacifico', 'npc'].includes(props.comportamento)) return props.comportamento;
  return Number(props.foge) > 0 ? 'foge' : 'normal';
}

// ================================================================================================================================================================================================================================================
// creatureStats
// Números da criatura no gerador (Criaturas): vida, XP dado ao morrer,
// velocidade (escala do Tibia: rat 134, player nível 1 = 220), armadura,
// defesa e ataque (o maior golpe). Só os preenchidos (> 0; com a vida
// preenchida, XP, armadura, defesa e ataque 0 valem 0 de verdade); o que
// faltar vem do nível no mapa.

export function creatureStats(type) {
  const asset = getAsset(type);
  const props = (asset && asset.propriedades) || {};
  const stats = {};
  for (const [key, field] of [['hp', 'vida'], ['xp', 'xp'], ['spd', 'velocidade'], ['def', 'armadura'], ['defense', 'defesa'], ['atk', 'ataque']]) {
    const value = Math.floor(Number(props[field]));
    if (value > 0 || (key !== 'hp' && key !== 'spd' && value === 0 && props.vida > 0)) stats[key] = value;
  }
  return stats;
}

// ================================================================================================================================================================================================================================================
// creaturePowers
// O que a criatura faz além do golpe (gerador → Criaturas): spell, a magia
// de longe ({ kind, damage, chance %, a cada tentativa }); poison, o veneno
// que o golpe deixa (dano por vez); summon, a criatura que ela invoca ({
// type, max }); respawn, o tempo pra renascer (ms; 0 = o padrão).

export const SPELL_ELEMENTS = ['fire', 'energy', 'poison', 'ice', 'earth', 'death', 'holy'];

export function creaturePowers(type) {
  const asset = getAsset(type);
  const props = (asset && asset.propriedades) || {};
  const int = (value) => Math.max(0, Math.floor(Number(value)) || 0);
  const magic = props.magia || {};
  const spell = SPELL_ELEMENTS.includes(magic.tipo) && int(magic.dano) > 0
    ? { kind: magic.tipo, damage: int(magic.dano), chance: Math.min(100, Math.max(1, int(magic.chance) || 20)) }
    : null;
  const call = props.invoca || {};
  const summon = typeof call.tipo === 'string' && call.tipo && int(call.max) > 0 ? { type: call.tipo, max: Math.min(5, int(call.max)) } : null;
  return { spell, poison: int(props.veneno), summon, respawn: int(props.respawn) * 1000 };
}

// ================================================================================================================================================================================================================================================
// creatureLoot
// O que a criatura pode deixar no corpo (gerador → Criaturas → Loot):
// [{ tipo, chance (0–1), min, max }], só as entradas válidas.

export function creatureLoot(type) {
  const asset = getAsset(type);
  const loot = asset && asset.propriedades && asset.propriedades.loot;
  if (!Array.isArray(loot)) return [];
  return loot.filter(e => e && typeof e.tipo === 'string' && e.tipo && Number(e.chance) > 0).map(e => ({
    tipo: e.tipo,
    chance: Math.min(1, Number(e.chance)),
    min: Math.max(1, Math.floor(Number(e.min)) || 1),
    max: Math.max(1, Math.floor(Number(e.max)) || 1)
  }));
}

// ================================================================================================================================================================================================================================================
// creatureVoices
// O que a criatura diz de vez em quando (gerador → Criaturas → Falas).

export function creatureVoices(type) {
  const asset = getAsset(type);
  const lines = asset && asset.propriedades && asset.propriedades.falas;
  return Array.isArray(lines) ? lines.filter(line => typeof line === 'string' && line.trim()) : [];
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
// quadro, quadros, msPorQuadro, variacoes, padrao, pecas, propriedades,
// cadaver, direcoes, sqms }].

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
  return { blocks: props.comportamento === 'bloqueia', damage, edgeBlocks: props.bordaBloqueia === true };
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
// O que barra item jogado: parede (Estrutura › Paredes), menos janela,
// passagem e porta aberta. Árvore, pedra e outros objetos que bloqueiam a passagem de player e
// inimigos deixam o item passar por cima.

export const MAGIC_WALL = 'itens/itens-encantados/magic-wall';

export function blocksThrow(type) {
  const { asset, piece } = splitType(type);
  if (asset === MAGIC_WALL) return true;
  if (!asset.startsWith(WALL_FOLDER)) return false;
  return !/^janela|^passagem|^porta-.*-aberta$/.test(piece || '');
}

// ================================================================================================================================================================================================================================================
// isOnTopType
// Peça que fica por cima de quem está no sqm (a passagem: o topo da parede
// por onde se passa por baixo), como o "sempre por cima" do Tibia.

export function isOnTopType(type) {
  const { asset, piece } = splitType(type);
  return isWallType(type) && /^passagem-/.test(splitType(type).piece || '');
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
// Pela pasta da folha. Com Uso no gerador, o uso manda: marca de corda na
// pasta de escadas não é escada; monte da pá e bueiro na pasta de entradas
// não são buraco (o monte só vira quando a pá abre; o bueiro se usa).

export function isFloorType(type) {
  return splitType(type).asset.startsWith(FLOOR_FOLDER);
}

export function isStairsType(type) {
  return splitType(type).asset.startsWith(STAIRS_FOLDER) && objectUse(type) !== 'corda';
}

export function isHoleType(type) {
  return splitType(type).asset.startsWith(HOLE_FOLDER) && !['pa', 'pa-cai', 'descer'].includes(objectUse(type));
}

// ================================================================================================================================================================================================================================================
// isStairsFolder / isEntranceFolder
// Só a pasta (Estrutura › Escadas / Entradas): é onde o editor lista e
// guarda a peça, qualquer que seja o uso dela no jogo.

export function isStairsFolder(type) {
  return splitType(type).asset.startsWith(STAIRS_FOLDER);
}

export function isEntranceFolder(type) {
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
  return !!asset && asset.ferramenta === 'objetos' && !isStairsFolder(type) && !isEntranceFolder(type);
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
// objectUse
// Pra que serve o objeto (gerador → Objetos → Uso): 'placa' (mostra o texto),
// 'livro' (abre o texto), 'bau-quest' (dá os itens uma vez por player),
// 'corda' (marca de corda: sobe um andar com a corda), 'pa' (monte que a pá
// abre em buraco), 'pa-cai' (a pá abre e o player já cai; o desenho não
// muda), 'descer' (bueiro: usar leva pro andar de baixo),
// 'ferramenta-corda', 'ferramenta-pa' ou 'deposito' (abre o depósito do
// player); null se nenhum.

export const OBJECT_USES = ['placa', 'livro', 'bau-quest', 'corda', 'pa', 'pa-cai', 'descer', 'ferramenta-corda', 'ferramenta-pa', 'deposito'];

export function objectUse(type) {
  const asset = getAsset(splitType(type).asset);
  const use = asset && asset.propriedades && asset.propriedades.uso;
  return OBJECT_USES.includes(use) ? use : null;
}

// ================================================================================================================================================================================================================================================
// activeAs
// Todo objeto tem o estado normal e, se tiver o desenho dele (gerador → Ativo
// como), o ativo: a tocha acesa, o monte que a pá abriu, o poste ligado…
// Devolve a folha do desenho ativo, virada como o objeto, ou null.

export function activeAs(type) {
  const asset = getAsset(splitType(type).asset);
  const target = asset && asset.propriedades && asset.propriedades.ativoComo;
  return target && getAsset(target) ? withDirection(target, type) : null;
}

// ================================================================================================================================================================================================================================================
// togglesOnUse / startsActive
// Objeto fixo com o desenho ativo e sem outro Uso: usar alterna entre normal
// e ativo (poste, lampião, alavanca…). startsActive: começa ativo no mapa
// (gerador → Começa ativo).

export function togglesOnUse(type) {
  return !objectProps(type).movable && !objectUse(type) && !!activeAs(type);
}

export function startsActive(type) {
  const asset = getAsset(splitType(type).asset);
  return togglesOnUse(type) && !!(asset.propriedades && asset.propriedades.comecaAtivo);
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
// objectDirections / objectDirection
// Objeto que gira (gerador → Objetos → Direções): as direções que ele tem, na
// ordem das linhas da folha ([] se não gira). No mapa, a direção vai como
// peça ('decoracao/baus/bau-quest#leste'); sem peça (ou com uma que ele não
// tem), vale a 1ª.

export const DIRECTIONS = ['norte', 'leste', 'sul', 'oeste'];

export function objectDirections(type) {
  const asset = getAsset(splitType(type).asset);
  return (asset && Array.isArray(asset.direcoes) && asset.direcoes) || [];
}

export function objectDirection(type) {
  const directions = objectDirections(type);
  const { piece } = splitType(type);
  return directions.includes(piece) ? piece : directions[0] || null;
}

// ================================================================================================================================================================================================================================================
// rotateType
// O mesmo objeto virado pra próxima direção que ele tem (no sentido do
// relógio; step -1 volta). Objeto que não gira fica como está.

export function rotateType(type, step = 1) {
  const directions = objectDirections(type);
  if (directions.length < 2) return type;
  const ordered = DIRECTIONS.filter(dir => directions.includes(dir));
  const index = ordered.indexOf(objectDirection(type));
  return pieceType(splitType(type).asset, ordered[(index + step + ordered.length) % ordered.length]);
}

// ================================================================================================================================================================================================================================================
// withDirection
// A folha target (ex.: o desenho aceso) virada como type, se ela tiver essa
// direção.

export function withDirection(target, type) {
  const direction = objectDirection(type);
  return direction && objectDirections(target).includes(direction) ? pieceType(target, direction) : target;
}

// ================================================================================================================================================================================================================================================
// extraSquares
// Objeto de 2 sqm (cama): o sqm a mais em volta do sqm onde ele está, [dx,
// dy]: em pé (norte/sul), o de cima; deitado (leste/oeste), o da esquerda.
// [] se ocupa só 1.

export function extraSquares(type) {
  const asset = getAsset(splitType(type).asset);
  if (!asset || asset.sqms !== 2) return [];
  return ['leste', 'oeste'].includes(objectDirection(type)) ? [[-1, 0]] : [[0, -1]];
}

// ================================================================================================================================================================================================================================================
// floorMiddle
// A peça do meio do piso no sqm: piso com padrão (gerador: chão do Tibia que
// muda pela posição, ex. areia 4 × 4) usa o pedaço da posição
// ('padrao-<coluna>-<linha>'), emendando sem costura; os outros sorteiam uma
// das variações do meio (interiorVariant).

export function floorMiddle(type, x, y, z) {
  const asset = getAsset(splitType(type).asset);
  const pattern = asset && Array.isArray(asset.padrao) ? asset.padrao : null;
  if (!pattern) return interiorVariant(x, y, z, (asset && asset.variacoes) || 4);
  const [cols, rows] = pattern;
  return `padrao-${((x % cols) + cols) % cols}-${((y % rows) + rows) % rows}`;
}

// ================================================================================================================================================================================================================================================
// spriteFrame
// Onde desenhar a peça na folha: { url, x, y, size, frames, ms } — x, y do
// 1º quadro; os outros quadros seguem à direita, um a cada ms (0: o ciclo
// padrão). Piso animado: cada peça com os quadros dela lado a lado. Objeto
// que gira: uma linha por direção. null se a folha não existe.

export function spriteFrame(type) {
  const { asset: assetId, piece } = splitType(type);
  const asset = getAsset(assetId);
  if (!asset) return null;
  const size = asset.quadro;
  if (asset.ferramenta === 'pisos') {
    const middle = /^meio-(\d+)$/.exec(piece || 'meio-1');
    const pattern = /^padrao-(\d+)-(\d+)$/.exec(piece || '');
    const [col, row] = pattern ? [Number(pattern[1]), 4 + Number(pattern[2])]
      : middle ? [Math.min(Number(middle[1]), asset.variacoes || 1) - 1, 0] : (FLOOR_CELLS[piece] || [0, 0]);
    const frames = asset.quadros || 1;
    return { url: asset.url, x: col * frames * size, y: row * size, size, frames, ms: asset.msPorQuadro || 0 };
  }
  if (asset.ferramenta === 'paredes') {
    const index = Math.max(0, (asset.ordem || WALL_PIECES).indexOf(piece || 'x'));
    return { url: asset.url, x: (index % 4) * size, y: Math.floor(index / 4) * size, size, frames: 1, ms: 0 };
  }
  const row = Math.max(0, objectDirections(assetId).indexOf(objectDirection(type)));
  return { url: asset.url, x: 0, y: row * size, size, frames: asset.quadros || 1, ms: 0 };
}
