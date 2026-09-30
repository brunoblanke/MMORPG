// shared/items.js

import { getAsset, displayName, splitType } from './assets.js';

// Regras dos itens que o player carrega (inventário e containers). Um item é
// { uid, type, count?, items? }: type é a folha do gerador, count só em pilha
// e items (espaços, null = vazio) só em container. O que cada tipo é vem da
// pasta e das propriedades da folha (gerador → Objetos).

export const EQUIP_SLOTS = ['amuleto', 'cabeca', 'mochila', 'arma', 'corpo', 'escudo', 'anel', 'pernas', 'municao', 'pes'];
export const STACK_MAX = 100;
export const THROW_RANGE = 25;
export const DEFAULT_WEIGHT = 10;
export const DEFAULT_CONTAINER_SIZE = 8;

// Morte do player: a mochila vai sempre pro corpo; cada outro item do
// inventário, com esta chance (provisório).
export const DEATH_DROP_CHANCE = 0.3;

// Intervalo entre um item de usar (potion) e o seguinte, como no Tibia.
export const USE_COOLDOWN_MS = 1000;

// Potion: usada com a mira em player (cura) ou no chão (vaza), até
// POTION_RANGE sqm (o mesmo alcance de jogar item); sempre vira EMPTY_VIAL. O respingo some em
// SPLASH_STAGES quadros de SPLASH_STAGE_MS.
export const POTION_RANGE = THROW_RANGE;
export const EMPTY_VIAL = 'itens/liquidos/vial';
export const SPLASH_HP = 'itens/liquidos/respingo-vida';
export const SPLASH_MANA = 'itens/liquidos/respingo-mana';
export const SPLASH_STAGES = 3;
export const SPLASH_STAGE_MS = 20000;

// Comida como no Tibia (sem vocação): cada item soma segundos de
// regeneração, até FOOD_MAX_SECONDS; enquanto dura, recupera REGEN_HP de
// vida e REGEN_MANA de mana a cada REGEN_MS.
export const FOOD_MAX_SECONDS = 1200;
export const REGEN_MS = 6000;
export const REGEN_HP = 1;
export const REGEN_MANA = 1;

// Cap como no Tibia (sem vocação): 400 oz no nível 1 e +10 por nível.
export const CAP_BASE_LEVEL = 1;
export const CAP_AT_BASE = 400;
export const CAP_PER_LEVEL = 10;

// Skill que o atk de cada tipo de arma soma (o resto: fist).
const SKILL_BY_WEAPON_FOLDER = {
  espadas: 'sword', machados: 'axe', clavas: 'club', distancia: 'distance', municao: 'distance',
  rods: 'magic', wands: 'magic', 'wands-e-rods-antigas': 'magic', punhos: 'fist'
};

// Espaço do inventário de cada pasta de Itens.
const SLOT_BY_FOLDER = {
  capacetes: 'cabeca', armaduras: 'corpo', escudos: 'escudo', spellbooks: 'escudo',
  calcas: 'pernas', botas: 'pes', aljavas: 'municao', 'extra-slot': 'municao', municao: 'municao',
  machados: 'arma', clavas: 'arma', espadas: 'arma', rods: 'arma', wands: 'arma',
  'wands-e-rods-antigas': 'arma', distancia: 'arma', 'replicas-de-armas': 'arma', punhos: 'arma',
  'amuletos-e-colares': 'amuleto', aneis: 'anel', recipientes: 'mochila'
};

// ================================================================================================================================================================================================================================================
// itemInfo
// { name, slot, weight, stack, size, atk, def, ml, speed, heal } do tipo: slot é o espaço
// do inventário (ou null), weight o peso de uma unidade (oz), stack o máximo
// da pilha (0 = não empilha; equipamento e container nunca empilham, mesmo
// marcados no gerador), size os espaços, se for container (0 = não é),
// atk/def/ml/speed os bônus de quem usa o item (0 = não tem) e heal o que
// ele recupera ao ser usado ({ hp: [min, max], mana: [min, max] }, ou null)
// e food os segundos de regeneração, se for comida (0 = não é).

export function itemInfo(type) {
  const asset = getAsset(splitType(type).asset);
  const props = (asset && asset.propriedades) || {};
  const folder = asset ? asset.pasta : null;
  const weight = Number(props.peso);
  const size = Number(props.espacos);
  const slot = SLOT_BY_FOLDER[folder] || null;
  const containerSize = size > 0 ? Math.floor(size) : (folder === 'recipientes' ? DEFAULT_CONTAINER_SIZE : 0);
  return {
    name: displayName(type),
    slot,
    weight: weight > 0 ? weight : DEFAULT_WEIGHT,
    stack: props.empilhavel && !slot && !containerSize ? STACK_MAX : 0,
    size: containerSize,
    atk: bonusValue(props.atk),
    def: bonusValue(props.def),
    ml: bonusValue(props.ml),
    speed: bonusValue(props.speed),
    heal: healOf(props),
    food: bonusValue(props.alimento),
    weaponSkill: SKILL_BY_WEAPON_FOLDER[folder] || null
  };
}

// ================================================================================================================================================================================================================================================
// stackFrame
// Quadro da folha de um item de pilha (gerador: 8 quadros, um por
// quantidade, como no Tibia): 1, 2, 3, 4, 5–9, 10–24, 25–49 e 50+.

export function stackFrame(count) {
  const n = Math.max(1, Math.floor(count) || 1);
  if (n < 5) return n - 1;
  if (n < 10) return 4;
  if (n < 25) return 5;
  if (n < 50) return 6;
  return 7;
}

// ================================================================================================================================================================================================================================================
// healOf
// Faixas de vida e mana que o item recupera (vidaMin/vidaMax, manaMin/manaMax
// no gerador); null se não recupera nada.

function healOf(props) {
  const range = (min, max) => {
    const low = bonusValue(min);
    return [low, Math.max(low, bonusValue(max))];
  };
  const hp = range(props.vidaMin, props.vidaMax);
  const mana = range(props.manaMin, props.manaMax);
  return hp[1] > 0 || mana[1] > 0 ? { hp, mana } : null;
}

// ================================================================================================================================================================================================================================================
// bonusValue

function bonusValue(value) {
  const number = Math.floor(Number(value));
  return number > 0 ? number : 0;
}

// ================================================================================================================================================================================================================================================
// equipBonus
// Soma dos bônus do que está nos espaços do inventário (o que está dentro da
// mochila não conta). atkSkill: o skill que recebe o atk — o da arma na mão
// (espada → sword…) ou fist, sem arma.

export function equipBonus(equip) {
  const bonus = { atk: 0, def: 0, ml: 0, speed: 0, atkSkill: 'fist' };
  if (!equip) return bonus;
  for (const key of EQUIP_SLOTS) {
    const item = equip[key];
    if (!item) continue;
    const info = itemInfo(item.type);
    bonus.atk += info.atk;
    bonus.def += info.def;
    bonus.ml += info.ml;
    bonus.speed += info.speed;
    if (key === 'arma' && info.weaponSkill) bonus.atkSkill = info.weaponSkill;
  }
  return bonus;
}

// ================================================================================================================================================================================================================================================
// capacityFor
// Cap do player no nível (oz).

export function capacityFor(level) {
  return CAP_AT_BASE + Math.max(0, level - CAP_BASE_LEVEL) * CAP_PER_LEVEL;
}

// ================================================================================================================================================================================================================================================
// newItem
// Item novo do tipo (count na pilha, espaços vazios no container).

export function newItem(uid, type, count = 1) {
  const info = itemInfo(type);
  const item = { uid, type };
  if (info.stack) item.count = Math.max(1, Math.min(info.stack, count));
  if (info.size) item.items = new Array(info.size).fill(null);
  return item;
}

// ================================================================================================================================================================================================================================================
// weightOf
// Peso do item com tudo que está dentro dele.

export function weightOf(item) {
  if (!item) return 0;
  const own = itemInfo(item.type).weight * (item.count || 1);
  const inside = item.items ? item.items.reduce((sum, child) => sum + weightOf(child), 0) : 0;
  return Math.round((own + inside) * 100) / 100;
}

// ================================================================================================================================================================================================================================================
// contains
// O container tem o alvo dentro dele (em qualquer nível)?

export function contains(container, target) {
  if (!container || !container.items) return false;
  return container.items.some(child => child && (child.uid === target.uid || contains(child, target)));
}

// ================================================================================================================================================================================================================================================
// findInTree
// Procura o item de uid dentro de roots (itens soltos): { item, parent, index }
// (parent null = é uma das raízes) ou null.

export function findInTree(roots, uid) {
  for (let i = 0; i < roots.length; i++) {
    const root = roots[i];
    if (!root) continue;
    if (root.uid === uid) return { item: root, parent: null, index: i };
    const found = findInside(root, uid);
    if (found) return found;
  }
  return null;
}

function findInside(container, uid) {
  if (!container.items) return null;
  for (let i = 0; i < container.items.length; i++) {
    const child = container.items[i];
    if (!child) continue;
    if (child.uid === uid) return { item: child, parent: container, index: i };
    const found = findInside(child, uid);
    if (found) return found;
  }
  return null;
}

// ================================================================================================================================================================================================================================================
// toPlain
// Cópia do item sem uid (pra gravar ou mandar pela rede).

export function toPlain(item) {
  if (!item) return null;
  const plain = { type: item.type };
  if (item.count) plain.count = item.count;
  if (item.items) plain.items = item.items.map(toPlain);
  if (item.texto) plain.texto = item.texto;
  return plain;
}

// ================================================================================================================================================================================================================================================
// fromPlain
// Item gravado de volta, com uids novos (nextUid()). Tipo que não existe mais
// some; container gravado maior ou menor que a folha atual se ajusta.

export function fromPlain(plain, nextUid) {
  if (!plain || typeof plain.type !== 'string' || !getAsset(splitType(plain.type).asset)) return null;
  const item = newItem(nextUid(), plain.type, Number(plain.count) || 1);
  if (item.items && Array.isArray(plain.items)) {
    plain.items.slice(0, item.items.length).forEach((child, i) => { item.items[i] = fromPlain(child, nextUid); });
  }
  if (typeof plain.texto === 'string' && plain.texto) item.texto = plain.texto.slice(0, 2000);
  return item;
}
