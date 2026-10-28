// shared/explored.js

// Mini mapa descoberto: os sqm que o player já viu, como no Tibia. Cada passo marca o retângulo em volta dele
// (EXPLORE_RANGE_X × EXPLORE_RANGE_Y pra cada lado, no andar dele), o "pincel". Guardado em blocos de EXPLORE_CHUNK ×
// EXPLORE_CHUNK sqm, 1 bit por sqm (128 bytes por bloco, em base64 no personagem), só os blocos visitados. O servidor
// marca e guarda no personagem (o mesmo mapa em qualquer aparelho) e manda tudo uma vez ao entrar; o navegador marca
// do mesmo jeito sozinho a cada passo, então o mini mapa se desenha na hora.

export const EXPLORE_CHUNK = 32;
export const EXPLORE_RANGE_X = 8;
export const EXPLORE_RANGE_Y = 6;
export const EXPLORE_MAX_CHUNKS = 20000;
const CHUNK_BYTES = EXPLORE_CHUNK * EXPLORE_CHUNK / 8;
const KEY = /^-?\d+,-?\d+,-?\d+$/;

// ================================================================================================================================================================================================================================================
// toBase64

function toBase64(bytes) {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

// ================================================================================================================================================================================================================================================
// fromBase64
// Os bytes do bloco, ou null se o texto não é um bloco válido.

function fromBase64(text) {
  if (typeof text !== 'string') return null;
  try {
    const raw = atob(text);
    if (raw.length !== CHUNK_BYTES) return null;
    const bytes = new Uint8Array(CHUNK_BYTES);
    for (let i = 0; i < CHUNK_BYTES; i++) bytes[i] = raw.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

export class Explored {
  // ================================================================================================================================================================================================================================================
  // constructor
  // saved = o que toSave devolveu (o que não serve é ignorado).

  constructor(saved = null) {
    this.chunks = new Map();
    this.last = null;
    this.merge(saved);
  }

  // ================================================================================================================================================================================================================================================
  // merge
  // Junta um mapa guardado ao que já está marcado.

  merge(saved) {
    if (!saved || typeof saved !== 'object') return;
    for (const [key, text] of Object.entries(saved)) {
      if (!KEY.test(key) || (!this.chunks.has(key) && this.chunks.size >= EXPLORE_MAX_CHUNKS)) continue;
      const bytes = fromBase64(text);
      if (!bytes) continue;
      const mine = this.chunks.get(key);
      if (!mine) this.chunks.set(key, bytes);
      else for (let i = 0; i < CHUNK_BYTES; i++) mine[i] |= bytes[i];
    }
  }

  // ================================================================================================================================================================================================================================================
  // place
  // O bloco e o bit do sqm.

  place(x, y, z) {
    const cx = Math.floor(x / EXPLORE_CHUNK);
    const cy = Math.floor(y / EXPLORE_CHUNK);
    const bit = (y - cy * EXPLORE_CHUNK) * EXPLORE_CHUNK + (x - cx * EXPLORE_CHUNK);
    return { key: `${cx},${cy},${z}`, index: bit >> 3, mask: 1 << (bit & 7) };
  }

  // ================================================================================================================================================================================================================================================
  // has

  has(x, y, z) {
    const { key, index, mask } = this.place(x, y, z);
    const bytes = this.chunks.get(key);
    return !!bytes && (bytes[index] & mask) !== 0;
  }

  // ================================================================================================================================================================================================================================================
  // mark

  mark(x, y, z) {
    const { key, index, mask } = this.place(x, y, z);
    let bytes = this.chunks.get(key);
    if (!bytes) {
      if (this.chunks.size >= EXPLORE_MAX_CHUNKS) return;
      bytes = new Uint8Array(CHUNK_BYTES);
      this.chunks.set(key, bytes);
    }
    bytes[index] |= mask;
  }

  // ================================================================================================================================================================================================================================================
  // visit
  // O player num sqm: marca o retângulo em volta dele, só quando mudou de sqm ou de andar.

  visit(entity) {
    const z = entity.z || 0;
    const last = this.last;
    if (last && last.x === entity.x && last.y === entity.y && last.z === z) return;
    this.last = { x: entity.x, y: entity.y, z };
    for (let y = entity.y - EXPLORE_RANGE_Y; y <= entity.y + EXPLORE_RANGE_Y; y++) {
      for (let x = entity.x - EXPLORE_RANGE_X; x <= entity.x + EXPLORE_RANGE_X; x++) this.mark(x, y, z);
    }
  }

  // ================================================================================================================================================================================================================================================
  // toSave

  toSave() {
    const saved = {};
    for (const [key, bytes] of this.chunks) saved[key] = toBase64(bytes);
    return saved;
  }
}
