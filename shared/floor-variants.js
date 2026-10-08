// shared/floor-variants.js

export const MAX_RARE = 8;

// ================================================================================================================================================================================================================================================
// rareVariantAt
// Variações raras do piso (gerador → Pisos → Raras): em chance % dos sqms (sorteio fixo pela posição) o desenho do meio é trocado por uma das count variações; devolve o número dela (1…count) ou 0 se o sqm fica com o desenho normal.

export function rareVariantAt(x, y, z, count, chance) {
  if (!count || !chance) return 0;
  let h = (x * 668265263 + y * 374761393 + z * 2147483647 + 40503) | 0;
  h = (h ^ (h >>> 15)) * 2246822519;
  h = (h ^ (h >>> 13)) * 3266489917;
  h = (h ^ (h >>> 16)) >>> 0;
  if ((h % 1000) >= chance * 10) return 0;
  return ((h >>> 10) % count) + 1;
}
