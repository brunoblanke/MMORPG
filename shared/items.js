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

// Cap: 300 oz no nível 8 e mais um tanto por nível (provisório).
export const CAP_BASE_LEVEL = 8;
export const CAP_AT_BASE = 300;
export const CAP_PER_LEVEL = 10;

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
// { name, slot, weight, stack, size } do tipo: slot é o espaço do inventário
// (ou null), weight o peso de uma unidade (oz), stack o máximo da pilha (0 =
// não empilha) e size os espaços, se for container (0 = não é).

export function itemInfo(type) {
  const asset = getAsset(splitType(type).asset);
  const props = (asset && asset.propriedades) || {};
  const folder = asset ? asset.pasta : null;
  const weight = Number(props.peso);
  const size = Number(props.espacos);
  return {
    name: displayName(type),
    slot: SLOT_BY_FOLDER[folder] || null,
    weight: weight > 0 ? weight : DEFAULT_WEIGHT,
    stack: props.empilhavel ? STACK_MAX : 0,
    size: size > 0 ? Math.floor(size) : (folder === 'recipientes' ? DEFAULT_CONTAINER_SIZE : 0)
  };
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
  return item;
}
