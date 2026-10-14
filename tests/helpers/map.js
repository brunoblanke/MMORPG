// tests/helpers/map.js

// ================================================================================================================================================================================================================================================
// testMapData
// Um mapa pequeno pros testes de servidor: um campo de grama de 40 × 40 e o spawn no meio.

export function testMapData() {
  const objetosData = [];
  for (let x = 0; x < 40; x++) {
    for (let y = 0; y < 40; y++) objetosData.push(['estrutura/pisos/grama-1', x, y, 0, 0, false, false, false]);
  }
  return { version: 3, objetosData, transicoesData: [], enemyData: [], npcData: [], botData: [], safeZoneData: [], houseData: [], spawn: { x: 20, y: 20, z: 0 } };
}
