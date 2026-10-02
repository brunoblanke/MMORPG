// shared/floor-variant.js

// ================================================================================================================================================================================================================================================
// hashTile

function hashTile(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return h >>> 0;
}

// ================================================================================================================================================================================================================================================
// pickWeightedInteriorVariant

export function pickWeightedInteriorVariant(x, y, z) {
  const roll = hashTile(x, y, z) % 100;
  if (roll < 70) return 'a';
  const others = ['b', 'c', 'd'];
  return others[hashTile(x + 1000003, y + 1000003, z) % others.length];
}

// ================================================================================================================================================================================================================================================
// computeBorderPieces
//
// Bordas são sempre desenhadas PRA FORA: numa célula sem piso (naquela
// camada), empilhamos um sprite por lado que encosta em piso (n/s/o/l) e um
// sprite de quina (no/nl/so/sl) quando o piso só encosta pela diagonal.
// Um canto interno vira naturalmente dois lados juntos (ex.: n + o).
//
// getFloor(x, y) devolve o piso VISÍVEL da célula ({ type, seq }) ou null
// (sem piso ou buraco). cellFloor é o piso visível da própria célula.
//
// Cada piso desenha a própria borda pra fora, e a borda segue a ordem do
// piso: ela só aparece sobre o que foi colocado ANTES dele (célula vazia ou
// piso de seq menor). Sobre um piso mais novo ela ficaria por baixo — então
// nem entra. Borda do mesmo tipo do piso da célula também não entra (o piso
// é contínuo). As peças voltam ordenadas da mais antiga pra mais nova.

const NEIGHBORS = [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]];

export function computeBorderPieces(x, y, getFloor, cellFloor = null) {
  const casts = (floor) => !!floor && (!cellFloor || (floor.type !== cellFloor.type && floor.seq > cellFloor.seq));
  const castingType = (dx, dy) => {
    const floor = getFloor(x + dx, y + dy);
    return casts(floor) ? floor.type : null;
  };

  // Tipo → seq mais novo entre os vizinhos que soltam borda aqui.
  const neighborTypes = new Map();
  for (const [dx, dy] of NEIGHBORS) {
    const floor = getFloor(x + dx, y + dy);
    if (casts(floor)) neighborTypes.set(floor.type, Math.max(neighborTypes.get(floor.type) || 0, floor.seq));
  }
  const typesOldestFirst = [...neighborTypes.keys()].sort((a, b) => neighborTypes.get(a) - neighborTypes.get(b));

  const pieces = [];
  for (const type of typesOldestFirst) {
    // is: vizinho desse tipo solta borda aqui. has: vizinho é desse tipo (qualquer
    // ordem) — usado só pra saber se a quina diagonal é mesmo uma ponta do piso.
    const is = (dx, dy) => castingType(dx, dy) === type;
    const has = (dx, dy) => getFloor(x + dx, y + dy)?.type === type;

    if (is(0, 1)) pieces.push({ variant: 'n', type });
    if (is(0, -1)) pieces.push({ variant: 's', type });
    if (is(1, 0)) pieces.push({ variant: 'o', type });
    if (is(-1, 0)) pieces.push({ variant: 'l', type });

    if (!has(0, 1) && !has(1, 0) && is(1, 1)) pieces.push({ variant: 'no', type });
    if (!has(0, 1) && !has(-1, 0) && is(-1, 1)) pieces.push({ variant: 'nl', type });
    if (!has(0, -1) && !has(1, 0) && is(1, -1)) pieces.push({ variant: 'so', type });
    if (!has(0, -1) && !has(-1, 0) && is(-1, -1)) pieces.push({ variant: 'sl', type });
  }

  return pieces;
}
