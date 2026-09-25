// editor/js/view/sprite-thumb.js

import { getAsset, splitType, spriteFrame, WALL_PIECES } from '../../../shared/assets.js';

// Miniatura de uma peça de folha do gerador num elemento (fundo em CSS):
// recorta a peça e amplia/reduz pro tamanho pedido.

// ================================================================================================================================================================================================================================================
// sheetSize
// Largura e altura da folha inteira, pelo formato de cada ferramenta.

function sheetSize(asset) {
  const size = asset.quadro;
  if (asset.ferramenta === 'pisos') return [4 * size, 4 * size];
  if (asset.ferramenta === 'paredes') return [4 * size, Math.ceil((asset.ordem || WALL_PIECES).length / 4) * size];
  if (asset.ferramenta === 'criaturas') return [Math.max(asset.quadros, 3) * size, 5 * size];
  return [Math.max(1, asset.quadros) * size, size];
}

// ================================================================================================================================================================================================================================================
// setThumb
// type: folha ou '<folha>#<peça>'; size: lado da miniatura em px.

export function setThumb(el, type, size) {
  const asset = getAsset(splitType(type).asset);
  const frame = asset && (asset.ferramenta === 'criaturas' ? { url: asset.url, x: 0, y: 0, size: asset.quadro } : spriteFrame(type));
  if (!frame) return;
  const scale = size / frame.size;
  const [width, height] = sheetSize(asset);
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.backgroundImage = `url(${frame.url})`;
  el.style.backgroundRepeat = 'no-repeat';
  el.style.backgroundSize = `${width * scale}px ${height * scale}px`;
  el.style.backgroundPosition = `${-frame.x * scale}px ${-frame.y * scale}px`;
  el.style.imageRendering = 'pixelated';
}
